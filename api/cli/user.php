<?php
/**
 * Manage accounts. Command line only; there is no public sign-up.
 *
 *   php api/cli/user.php add <email>       create an account (asks for the password twice)
 *   php api/cli/user.php passwd <email>    set a new password (signs out every session)
 *   php api/cli/user.php remove <email>    delete the account and its sessions
 *   php api/cli/user.php list              list accounts
 *
 * On the server: php ~/fairflow.co.uk/astro/api/cli/user.php add you@example.com
 * The password is typed at a hidden prompt; when standard input is not a
 * terminal (tests), it is read from the first line of input.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ASTRO_API', 1);
require __DIR__ . '/../lib/bootstrap.php';

function fail(string $m): never { fwrite(STDERR, "$m\n"); exit(1); }

function ask_password(string $prompt): string {
  $tty = stream_isatty(STDIN);
  if ($tty) { fwrite(STDERR, $prompt); shell_exec('stty -echo'); }
  $line = fgets(STDIN);
  if ($tty) { shell_exec('stty echo'); fwrite(STDERR, "\n"); }
  return rtrim((string)$line, "\r\n");
}

function new_password(): string {
  $pw = ask_password('Password: ');
  if ($p = password_problem($pw)) fail("Password not accepted: $p.");
  if (stream_isatty(STDIN) && ask_password('Again: ') !== $pw) fail('The two passwords differ.');
  return $pw;
}

function find_user(string $email): ?array {
  $q = db()->prepare('SELECT id, email FROM users WHERE email = ?');
  $q->execute([$email]);
  return $q->fetch() ?: null;
}

$cmd = $argv[1] ?? '';
$email = normal_email($argv[2] ?? '');
if (in_array($cmd, ['add', 'passwd', 'remove'], true) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  fail("Give an email address: php api/cli/user.php $cmd you@example.com");
}

switch ($cmd) {
  case 'add':
    if (find_user($email)) fail("$email already has an account.");
    db()->prepare('INSERT INTO users (id, email, pass_hash, created_at) VALUES (?, ?, ?, ?)')
      ->execute([uuid4(), $email, hash_password(new_password()), time()]);
    echo "Created $email\n";
    break;
  case 'passwd':
    $u = find_user($email) ?? fail("No account for $email.");
    db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password(new_password()), $u['id']]);
    db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
    echo "Password changed for $email; its sessions were signed out\n";
    break;
  case 'remove':
    $u = find_user($email) ?? fail("No account for $email.");
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
    echo "Removed $email\n";
    break;
  case 'list':
    $rows = db()->query('SELECT email, created_at FROM users ORDER BY created_at')->fetchAll();
    foreach ($rows as $r) echo $r['email'], '  created ', gmdate('Y-m-d H:i', (int)$r['created_at']), " UTC\n";
    if (!$rows) echo "No accounts.\n";
    break;
  default:
    fail('Usage: php api/cli/user.php add|passwd|remove <email>, or list');
}
