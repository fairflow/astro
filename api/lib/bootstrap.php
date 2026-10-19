<?php
/**
 * Shared code for the Astrodynamics API (docs/DESIGN.md §5a).
 *
 * Every endpoint defines ASTRO_API and requires this file. Nothing here takes
 * a file path or SQL from a request: the only file read is the server-side
 * config, at a fixed location outside the web root.
 */
declare(strict_types=1);

if (!defined('ASTRO_API')) { http_response_code(404); exit; }

/** A session lasts this long after it was last used: anyone who uses the app
 *  at least every 90 days stays signed in indefinitely (sliding renewal). */
const SESSION_SECONDS = 90 * 24 * 3600;
/** How often a session in use is renewed (the database write and a fresh cookie). */
const RENEW_SECONDS = 24 * 3600;
const LOGIN_WINDOW = 15 * 60;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Account states (docs/DESIGN.md §5a): pending (awaiting approval), active,
 * paused (sign in, read and download own data, request removal; no new data,
 * no Ask Claude), frozen (no sign-in; sessions ended), deleting (no sign-in;
 * purged DELETE_GRACE after the request unless cancelled).
 */
const STATES = ['pending', 'active', 'paused', 'frozen', 'deleting'];
const SIGN_IN_STATES = ['active', 'paused'];
const ROLES = ['user', 'admin'];
const DELETE_GRACE = 30 * 24 * 3600;

/** The [db] table of the config: ASTRO_DB_INI if set (local dev, tests), else ~/astro-config/db.ini. */
function config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;
  $path = getenv('ASTRO_DB_INI') ?: (PHP_SAPI === 'cli'
    ? getenv('HOME') . '/astro-config/db.ini'
    : dirname((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) . '/astro-config/db.ini');
  $ini = @parse_ini_file($path, true);
  if (!is_array($ini) || !isset($ini['db'])) throw new RuntimeException('database config missing');
  return $cfg = $ini['db'];
}

function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $c = config();
  $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
  if (($c['driver'] ?? 'mysql') === 'sqlite') {
    $pdo = new PDO('sqlite:' . $c['path'], null, null, $opts);
    $pdo->exec('PRAGMA foreign_keys = ON');
  } else {
    $pdo = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['pass'], $opts);
  }
  return $pdo;
}

function is_sqlite(): bool { return db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'; }

function uuid4(): string {
  $b = random_bytes(16);
  $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
  $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function normal_email(string $e): string { return strtolower(trim($e)); }

/** Send a JSON response and stop. */
function reply(int $status, array $body = [], array $headers = []): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  foreach ($headers as $k => $v) header("$k: $v");
  echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

/** Run an endpoint body; any uncaught error becomes a plain 500 with no details. */
function handle(callable $f): never {
  try { $f(); reply(500, ['error' => 'no response']); }
  catch (Throwable $e) { error_log('astro api: ' . $e->getMessage()); reply(500, ['error' => 'server error']); }
}

function require_method(string $m): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== $m) reply(405, ['error' => "use $m"], ['Allow' => $m]);
}

/**
 * State-changing requests must come from our own pages: the custom header
 * X-Astro cannot be sent cross-site without a CORS preflight, which this API
 * never grants, and a present Origin must be this site.
 */
function require_same_origin_post(): void {
  require_method('POST');
  if (($_SERVER['HTTP_X_ASTRO'] ?? '') !== '1') reply(403, ['error' => 'missing request header']);
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if ($origin !== '' && $origin !== self_origin()) reply(403, ['error' => 'wrong origin']);
}

function is_https(): bool {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function self_origin(): string {
  return (is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');
}

/** The JSON object in the request body (at most MAX_BODY_BYTES). */
function json_body(): array {
  $raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
  if ($raw === false || strlen($raw) > MAX_BODY_BYTES) reply(413, ['error' => 'request too large']);
  $v = json_decode($raw, true);
  if (!is_array($v)) reply(400, ['error' => 'expected a JSON object']);
  return $v;
}

// ---- sessions ---------------------------------------------------------------

function cookie_name(): string { return is_https() ? '__Secure-astro_sid' : 'astro_sid'; }

/** The API directory as a URL path, e.g. /astro/api/: the cookie is sent only there. */
function cookie_path(): string {
  return rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/x'))), '/') . '/';
}

function set_session_cookie(string $value, int $expires): void {
  setcookie(cookie_name(), $value, [
    'expires' => $expires, 'path' => cookie_path(), 'secure' => is_https(),
    'httponly' => true, 'samesite' => 'Strict',
  ]);
}

function start_session(string $userId): void {
  $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
  $now = time();
  db()->prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
    ->execute([hash('sha256', $token), $userId, $now, $now + SESSION_SECONDS, $now]);
  db()->prepare('DELETE FROM sessions WHERE expires_at < ?')->execute([$now]); // tidy expired ones
  set_session_cookie($token, $now + SESSION_SECONDS);
}

/**
 * The signed-in user ['id','email','status','role'], or null. A session is ended
 * only by signing out, a password change, a change of state that bars sign-in
 * (frozen, deleting, pending), removing the account, or 90 days unused: never
 * by an error. If the database cannot be reached this throws, the request
 * fails with a 500, and the cookie and the session row are untouched.
 */
function current_user(): ?array {
  $token = $_COOKIE[cookie_name()] ?? '';
  if (!is_string($token) || $token === '' || strlen($token) > 100) return null;
  $q = db()->prepare('SELECT u.id, u.email, u.status, u.role, s.id_hash, s.last_seen_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?');
  $q->execute([hash('sha256', $token), time()]);
  $row = $q->fetch();
  // a state that bars sign-in also bars an existing session (set_status ends
  // those sessions anyway; this covers any made before the change)
  if (!$row || !in_array($row['status'], SIGN_IN_STATES, true)) return null;
  $now = time();
  if ($now - (int)$row['last_seen_at'] >= RENEW_SECONDS) {
    // in use: push the expiry out again, in the database and in the browser
    db()->prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?')
      ->execute([$now, $now + SESSION_SECONDS, $row['id_hash']]);
    set_session_cookie($token, $now + SESSION_SECONDS);
  }
  return ['id' => $row['id'], 'email' => $row['email'], 'status' => $row['status'], 'role' => $row['role']];
}

/** The signed-in user, or a 401. */
function require_user(): array {
  return current_user() ?? reply(401, ['error' => 'not signed in']);
}

/** The signed-in user if they may create or change data (and use Ask Claude): not paused. */
function require_writer(): array {
  $u = require_user();
  if ($u['status'] !== 'active') reply(403, ['error' => 'paused', 'message' => 'This account is paused: you can read and download your data, but not add to it.']);
  return $u;
}

/** The signed-in admin, or a 403. (The email second step joins this check in astro-tbb.10.) */
function require_admin(): array {
  $u = require_user();
  if ($u['role'] !== 'admin') reply(403, ['error' => 'admin only']);
  return $u;
}

/** What the reader is told when a correct password meets a state that bars sign-in. */
function barred_message(string $status): string {
  return match ($status) {
    'pending' => 'Your account is waiting for approval.',
    'frozen' => 'This account is frozen. Contact the site owner.',
    'deleting' => 'This account is scheduled for deletion. Contact the site owner to cancel.',
    default => 'This account cannot sign in.',
  };
}

/**
 * Move an account to a state. Barring states end its sessions at once;
 * 'deleting' starts the DELETE_GRACE clock and remembers the state it left,
 * so cancelling restores that (a paused account does not come back active).
 */
function set_status(string $userId, string $status): void {
  if (!in_array($status, STATES, true)) throw new InvalidArgumentException("unknown state $status");
  $now = time();
  if ($status === 'deleting') {
    db()->prepare("UPDATE users SET state_before_delete = status WHERE id = ? AND status <> 'deleting'")->execute([$userId]);
  }
  db()->prepare('UPDATE users SET status = ?, status_changed_at = ?, delete_after = ? WHERE id = ?')
    ->execute([$status, $now, $status === 'deleting' ? $now + DELETE_GRACE : null, $userId]);
  if (!in_array($status, SIGN_IN_STATES, true)) {
    db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
  }
}

/** Cancel a scheduled deletion: back to the state the account had before. Returns that state. */
function cancel_deletion(string $userId): string {
  $q = db()->prepare("SELECT state_before_delete FROM users WHERE id = ? AND status = 'deleting'");
  $q->execute([$userId]);
  $before = $q->fetchColumn();
  if ($before === false) throw new RuntimeException('not scheduled for deletion');
  $state = in_array($before, STATES, true) && $before !== 'deleting' ? $before : 'active';
  set_status($userId, $state);
  db()->prepare('UPDATE users SET state_before_delete = NULL WHERE id = ?')->execute([$userId]);
  return $state;
}

function set_role(string $userId, string $role): void {
  if (!in_array($role, ROLES, true)) throw new InvalidArgumentException("unknown role $role");
  db()->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $userId]);
}

/** Remove accounts whose deletion grace has run out (their sessions go with them). Returns how many. */
function purge_due_deletions(): int {
  $q = db()->prepare("DELETE FROM users WHERE status = 'deleting' AND delete_after IS NOT NULL AND delete_after <= ?");
  $q->execute([time()]);
  return $q->rowCount();
}

function end_session(): void {
  $token = $_COOKIE[cookie_name()] ?? '';
  if (is_string($token) && $token !== '') {
    db()->prepare('DELETE FROM sessions WHERE id_hash = ?')->execute([hash('sha256', $token)]);
  }
  set_session_cookie('', 1);
}

// ---- passwords and login limits -----------------------------------------------

function hash_password(string $pw): string { return password_hash($pw, PASSWORD_DEFAULT); }

/** Why a new password is unacceptable, or null. bcrypt reads only the first 72 bytes. */
function password_problem(string $pw): ?string {
  if (strlen($pw) < 10) return 'use at least 10 characters';
  if (strlen($pw) > 72) return 'use at most 72 bytes';
  return null;
}

/** Seconds to wait if this email or IP has failed too often recently, else 0. */
function login_wait(string $email, string $ip): int {
  $since = time() - LOGIN_WINDOW;
  $count = function (string $k) use ($since): array {
    $q = db()->prepare('SELECT COUNT(*) AS n, MIN(at) AS first FROM login_failures WHERE k = ? AND at > ?');
    $q->execute([$k, $since]);
    $r = $q->fetch();
    return [(int)$r['n'], (int)$r['first']];
  };
  [$ne, $fe] = $count('email:' . hash('sha256', $email));
  [$ni, $fi] = $count('ip:' . $ip);
  $wait = 0;
  if ($ne >= MAX_FAILS_PER_EMAIL) $wait = max($wait, $fe + LOGIN_WINDOW - time());
  if ($ni >= MAX_FAILS_PER_IP) $wait = max($wait, $fi + LOGIN_WINDOW - time());
  return max(0, $wait);
}

function record_login_failure(string $email, string $ip): void {
  $ins = db()->prepare('INSERT INTO login_failures (k, at) VALUES (?, ?)');
  $ins->execute(['email:' . hash('sha256', $email), time()]);
  $ins->execute(['ip:' . $ip, time()]);
  db()->prepare('DELETE FROM login_failures WHERE at < ?')->execute([time() - 86400]);
}

function clear_login_failures(string $email): void {
  db()->prepare('DELETE FROM login_failures WHERE k = ?')->execute(['email:' . hash('sha256', $email)]);
}
