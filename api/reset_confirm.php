<?php
/**
 * POST {email, code, password} → 200 {user} and signed in: the new password
 * is set and every other session of the account ends. 400 for a wrong or
 * expired code (the code stops working after 5 wrong tries) or an unacceptable
 * password; 403 if the account cannot sign in (frozen, pending, deleting).
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $b = json_body();
  $email = normal_email((string)($b['email'] ?? ''));
  $pw = (string)($b['password'] ?? '');
  if ($p = new_password_problem($pw)) reply(400, ['error' => 'password', 'message' => "New password not accepted: $p."]);

  $userId = check_code($email, 'reset', (string)($b['code'] ?? ''));
  if (!$userId) reply(400, ['error' => 'code', 'message' => 'That code is wrong or has expired. Ask for a new one.']);

  $q = db()->prepare('SELECT id, email, status, role, two_step FROM users WHERE id = ?');
  $q->execute([$userId]);
  $u = $q->fetch();
  if (!$u) reply(400, ['error' => 'code', 'message' => 'That code is wrong or has expired. Ask for a new one.']);
  if (!in_array($u['status'], SIGN_IN_STATES, true)) {
    reply(403, ['error' => $u['status'], 'message' => barred_message($u['status'])]);
  }
  db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password($pw), $u['id']]);
  db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
  clear_login_failures($email);
  start_session($u['id'], true); // the emailed code proved the address: this counts as the second step
  reply(200, ['user' => user_json($u + ['verified' => true])]);
});
