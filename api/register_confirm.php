<?php
/**
 * POST {email, password, code} → 200 {ok, message}: the emailed code confirms
 * the address of a new registration. The password must be the one most recently
 * registered for it: otherwise someone re-registering an unconfirmed address
 * with their own password could have the owner confirm it for them. The
 * account stays pending until an admin approves it; the admins are told by
 * email. 400 for a wrong or expired code or a different password.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $b = json_body();
  $email = normal_email((string)($b['email'] ?? ''));
  $wrong = ['error' => 'code', 'message' => 'That code is wrong or has expired. Register again to get a new one.'];
  $q = db()->prepare("SELECT id, email, pass_hash FROM users WHERE email = ? AND email_confirmed = 0 AND status = 'pending'");
  $q->execute([$email]);
  $u = $q->fetch();
  // the password first, so a wrong one does not use up the code's tries
  if (!$u || !password_verify((string)($b['password'] ?? ''), $u['pass_hash'])) reply(400, $wrong);
  if (check_code($email, 'register', (string)($b['code'] ?? '')) !== $u['id']) reply(400, $wrong);
  db()->prepare('UPDATE users SET email_confirmed = 1, status_changed_at = ? WHERE id = ?')->execute([time(), $u['id']]);

  $admins = db()->query("SELECT email FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
  foreach ($admins as $a) {
    send_notice($a, 'newuser', 'Astrodynamics: a registration awaits approval',
      "{$u['email']} has registered and confirmed the address.\n\n"
      . "Approve or reject it in the app: Settings, Account, Admin panel.");
  }
  reply(200, ['ok' => true, 'message' => 'Thank you: your address is confirmed. Your account now waits for approval, '
    . 'and we will email you when it is approved.']);
});
