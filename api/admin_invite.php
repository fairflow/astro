<?php
/**
 * POST {email} → 200 {ok, message}: an admin adds an account (astro-6yh). It is
 * active at once, with no usable password: the person is emailed an invitation
 * to choose one through "Forgot password?" (a code to their address), so no
 * password is ever sent by email or chosen for them. 409 if the address has an
 * account already. Admins only, with a session that passed the email-code step;
 * logged in admin_log.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $admin = require_admin();
  $email = normal_email((string)(json_body()['email'] ?? ''));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    reply(400, ['error' => 'email', 'message' => 'Enter an email address.']);
  }
  $q = db()->prepare('SELECT id FROM users WHERE email = ?');
  $q->execute([$email]);
  if ($q->fetchColumn()) reply(409, ['error' => 'exists', 'message' => "$email already has an account."]);

  $id = uuid4();
  $now = time();
  // a hash of 32 random bytes nobody knows: the account cannot be signed in to until a password is chosen
  db()->prepare("INSERT INTO users (id, email, pass_hash, created_at, status, role, status_changed_at, email_confirmed, two_step)
    VALUES (?, ?, ?, ?, 'active', 'user', ?, 1, 0)")
    ->execute([$id, $email, hash_password(bin2hex(random_bytes(32))), $now, $now]);
  log_admin($admin, 'invite', ['id' => $id, 'email' => $email]);
  send_notice($email, 'invite', 'You have an Astrodynamics account',
    "An account has been made for you at Astrodynamics, https://fairflow.co.uk/astro/\n\n"
    . "To start, choose a password. Open the site, go to Settings, then Account, choose\n"
    . "\"Forgot password?\" and enter this address. We will email you a code to set it.\n\n"
    . "If you were not expecting this, you can ignore it; nothing happens unless you set a password.");
  reply(200, ['ok' => true, 'message' => "Account made for $email and invitation sent."]);
});
