<?php
/**
 * Manage accounts from the command line. People also register in the app
 * (register.php) and an admin approves them in the admin panel; this is for the
 * first admin and for emergencies.
 *
 *   php api/cli/user.php add <email>       create an account (asks for the password twice)
 *   php api/cli/user.php passwd <email>    set a new password (signs out every session)
 *   php api/cli/user.php remove <email>    delete the account and its sessions now
 *   php api/cli/user.php list              list accounts with state and role
 *   php api/cli/user.php admin <email>     make the account an admin (role <email> user|admin to change back)
 *   php api/cli/user.php state <email> active|paused|frozen|pending
 *                                          set the account state (frozen and pending end its sessions)
 *   php api/cli/user.php delete <email>    schedule deletion in 30 days (ends sessions); undelete <email> cancels
 *   php api/cli/user.php purge             remove accounts whose 30 days have run out
 *
 * Locally the password is typed at a hidden prompt. On the server, where
 * shell_exec is disabled and typing cannot be hidden, pipe it in from your own
 * machine (read -s hides it there; nothing is stored):
 *   read -rs PW && printf '%s\n' "$PW" | ssh -p 722 USER@HOST \
 *     'php ~/fairflow.co.uk/astro/api/cli/user.php add you@example.com'; unset PW
 * When standard input is not a terminal, the first line of input is the password.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ASTRO_API', 1);
require __DIR__ . '/../lib/bootstrap.php';

function fail(string $m): never { fwrite(STDERR, "$m\n"); exit(1); }

function ask_password(string $prompt): string {
  $tty = stream_isatty(STDIN);
  // the host disables shell_exec even for command-line PHP, so typing cannot be
  // hidden there: refuse rather than echo a password, and say how to pipe it in
  $canHide = function_exists('shell_exec');
  if ($tty && !$canHide) {
    fail("Can't hide typing on this server. Pipe the password in instead, from your own machine:\n"
      . "  read -rs PW && printf '%s\\n' \"\$PW\" | ssh -p 722 USER@HOST 'php ~/fairflow.co.uk/astro/api/cli/user.php "
      . ($GLOBALS['argv'][1] ?? 'add') . ' ' . ($GLOBALS['argv'][2] ?? 'you@example.com') . "'; unset PW");
  }
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
if (in_array($cmd, ['add', 'passwd', 'remove', 'admin', 'role', 'state', 'delete', 'undelete'], true)
    && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
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
    $rows = db()->query('SELECT email, created_at, status, role, delete_after FROM users ORDER BY created_at')->fetchAll();
    foreach ($rows as $r) {
      echo $r['email'], '  ', $r['status'], $r['role'] === 'admin' ? ' admin' : '',
        '  created ', gmdate('Y-m-d H:i', (int)$r['created_at']), ' UTC',
        $r['delete_after'] ? '  deleted on ' . gmdate('Y-m-d', (int)$r['delete_after']) : '', "\n";
    }
    if (!$rows) echo "No accounts.\n";
    break;
  case 'admin':
  case 'role':
    $u = find_user($email) ?? fail("No account for $email.");
    $role = $cmd === 'admin' ? 'admin' : ($argv[3] ?? '');
    if (!in_array($role, ROLES, true)) fail('Role must be user or admin.');
    set_role($u['id'], $role);
    echo "$email is now $role\n";
    break;
  case 'state':
    $u = find_user($email) ?? fail("No account for $email.");
    $state = $argv[3] ?? '';
    if (!in_array($state, ['active', 'paused', 'frozen', 'pending'], true)) {
      fail('State must be active, paused, frozen or pending (use delete / undelete for deletion).');
    }
    set_status($u['id'], $state);
    echo "$email is now $state", in_array($state, SIGN_IN_STATES, true) ? '' : '; its sessions were ended', "\n";
    break;
  case 'delete':
    $u = find_user($email) ?? fail("No account for $email.");
    set_status($u['id'], 'deleting');
    echo "$email will be deleted on ", gmdate('Y-m-d', time() + DELETE_GRACE), " unless cancelled (undelete); signed out now\n";
    break;
  case 'undelete':
    $q = db()->prepare("SELECT id FROM users WHERE email = ? AND status = 'deleting'");
    $q->execute([$email]);
    $id = $q->fetchColumn() ?: fail("$email is not scheduled for deletion.");
    echo "Deletion of $email cancelled; it is ", cancel_deletion($id), " again\n";
    break;
  case 'purge':
    echo 'Removed ', purge_due_deletions(), " account(s) past their 30 days\n";
    break;
  default:
    fail('Usage: php api/cli/user.php add|passwd|remove|admin|delete|undelete <email>, role <email> user|admin,'
      . ' state <email> active|paused|frozen|pending, list, purge');
}
