<?php
/**
 * Outgoing mail and one-time email codes (astro-tbb.8; docs/DESIGN.md §5a).
 *
 * Mail goes through the host's own mail server with PHP's mail() (sendmail),
 * from noreply@fairflow.co.uk: the host signs it with the domain's DKIM key
 * and its servers are in the domain's SPF, so no mailbox password is stored.
 * Under PHP's built-in server (local development, tests) messages are appended
 * to mail.log beside the config file instead of being sent, unless the config's
 * [mail] table says transport = mail.
 */
declare(strict_types=1);

if (!defined('ASTRO_API')) { http_response_code(404); exit; }

const CODE_SECONDS = 600;          // a code is valid for 10 minutes
const CODE_TRIES = 5;              // wrong guesses allowed per code
const SEND_WINDOW = 15 * 60;
const MAX_SENDS_PER_EMAIL = 3;     // codes per address and purpose per 15 minutes
const MAX_SENDS_PER_IP = 10;
const CODE_PURPOSES = ['register', 'signin', 'reset'];
// Fresh codes can be requested, so per-code tries alone allow 15 guesses per 15
// minutes, about a 40% chance a year of hitting one 6-digit code. A daily cap on
// wrong codes per address keeps that below 1%.
const MAX_WRONG_CODES_PER_DAY = 20;

/** The [mail] table of the config, with defaults for the live site. */
function mail_config(): array {
  static $m = null;
  if ($m !== null) return $m;
  $path = config_path();
  $cfg = config_table('mail');
  // PHP's built-in server (npm run api, the tests) never sends real mail unless
  // its config says so: messages go to mail.log beside the config file
  $dev = PHP_SAPI === 'cli-server';
  return $m = $cfg + [
    'from' => 'noreply@fairflow.co.uk', 'from_name' => 'Astrodynamics',
    'transport' => $dev ? 'log' : 'mail', 'log' => dirname($path) . '/mail.log',
  ];
}

/** Send a plain-text message. Returns whether it was handed to the mail server (or logged). */
function send_mail(string $to, string $subject, string $body): bool {
  $m = mail_config();
  if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to . $subject)) {
    throw new InvalidArgumentException('bad recipient or subject');
  }
  if ($m['transport'] === 'log') {
    $line = json_encode(['to' => $to, 'subject' => $subject, 'body' => $body, 'at' => time()], JSON_UNESCAPED_UNICODE);
    return file_put_contents($m['log'], $line . "\n", FILE_APPEND | LOCK_EX) !== false;
  }
  $domain = substr(strrchr($m['from'], '@') ?: '@localhost', 1);
  $headers = [
    'From' => mb_encode_mimeheader($m['from_name'], 'UTF-8', 'Q') . ' <' . $m['from'] . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
    'Auto-Submitted' => 'auto-generated',     // no out-of-office replies to this
    'X-Auto-Response-Suppress' => 'All',
  ];
  // -f sets the envelope sender, so SPF is checked against fairflow.co.uk
  return mail($to, mb_encode_mimeheader($subject, 'UTF-8', 'Q'), $body, $headers, '-f' . $m['from']);
}

// ---- one-time codes -----------------------------------------------------------

function count_events(string $k, int $since): int {
  $q = db()->prepare('SELECT COUNT(*) FROM login_failures WHERE k = ? AND at > ?');
  $q->execute([$k, $since]);
  return (int)$q->fetchColumn();
}

function record_event(string $k): void {
  db()->prepare('INSERT INTO login_failures (k, at) VALUES (?, ?)')->execute([$k, time()]);
}

/**
 * A fresh 6-digit code for this address and purpose, or null when too many
 * have been sent recently. Earlier unused codes for the same purpose stop working.
 */
function issue_code(?string $userId, string $email, string $purpose): ?string {
  if (!in_array($purpose, CODE_PURPOSES, true)) throw new InvalidArgumentException("unknown purpose $purpose");
  $since = time() - SEND_WINDOW;
  $ke = "send:$purpose:" . hash('sha256', $email);
  $ki = 'send:ip:' . (string)($_SERVER['REMOTE_ADDR'] ?? 'cli');
  if (count_events($ke, $since) >= MAX_SENDS_PER_EMAIL || count_events($ki, $since) >= MAX_SENDS_PER_IP) return null;
  record_event($ke);
  record_event($ki);

  $now = time();
  db()->prepare('UPDATE email_codes SET used_at = ? WHERE email = ? AND purpose = ? AND used_at IS NULL')
    ->execute([$now, $email, $purpose]);
  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  $id = uuid4();
  db()->prepare('INSERT INTO email_codes (id, user_id, email, purpose, code_hash, created_at, expires_at, tries)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    ->execute([$id, $userId, $email, $purpose, hash('sha256', "$id:$code"), $now, $now + CODE_SECONDS]);
  db()->prepare('DELETE FROM email_codes WHERE expires_at < ?')->execute([$now - 86400]);
  return $code;
}

/**
 * Check a code. On success it is used up and the account id it was issued for
 * is returned ('' when none); otherwise null. Each wrong try counts against
 * the code, which stops working after CODE_TRIES.
 */
function check_code(string $email, string $purpose, string $code): ?string {
  $code = preg_replace('/\s+/', '', $code);
  $kw = "wrongcode:$purpose:" . hash('sha256', $email);
  if (count_events($kw, time() - 86400) >= MAX_WRONG_CODES_PER_DAY) return null;
  $q = db()->prepare('SELECT id, user_id, code_hash, tries FROM email_codes
    WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1');
  $q->execute([$email, $purpose, time()]);
  $row = $q->fetch();
  if (!$row || (int)$row['tries'] >= CODE_TRIES || !preg_match('/^\d{6}$/', (string)$code)) {
    if ($row) db()->prepare('UPDATE email_codes SET tries = tries + 1 WHERE id = ?')->execute([$row['id']]);
    record_event($kw);
    return null;
  }
  db()->prepare('UPDATE email_codes SET tries = tries + 1 WHERE id = ?')->execute([$row['id']]);
  if (!hash_equals($row['code_hash'], hash('sha256', $row['id'] . ':' . $code))) { record_event($kw); return null; }
  db()->prepare('UPDATE email_codes SET used_at = ? WHERE id = ?')->execute([time(), $row['id']]);
  return (string)($row['user_id'] ?? '');
}

/** The message carrying a code. The code leads the subject so phones can offer to fill it in. */
function code_message(string $code, string $purpose): array {
  $why = [
    'register' => 'to confirm your email address for a new Astrodynamics account',
    'signin' => 'to finish signing in to Astrodynamics',
    'reset' => 'to set a new password for your Astrodynamics account',
  ][$purpose];
  $body = "Your Astrodynamics code is $code\n\n"
    . "Enter it $why. It is valid for 10 minutes and works once.\n\n"
    . "If you did not ask for this, ignore this message: nothing changes unless the code is used.";
  return ["$code is your Astrodynamics code", signed($body)];
}

/** A message body with the standard signature. */
function signed(string $text): string {
  return $text . "\n\n-- \nAstrodynamics, https://fairflow.co.uk/astro/\nThis address does not receive replies.\n";
}

/**
 * Send a notice (no code), at most MAX_SENDS_PER_EMAIL of one kind to one
 * address per 15 minutes, so no form can be used to flood a mailbox.
 */
function send_notice(string $to, string $kind, string $subject, string $text): void {
  $k = "send:$kind:" . hash('sha256', $to);
  if (count_events($k, time() - SEND_WINDOW) >= MAX_SENDS_PER_EMAIL) return;
  record_event($k);
  if (!send_mail($to, $subject, signed($text))) error_log("astro api: $kind mail not accepted for sending");
}
