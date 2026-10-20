<?php
/**
 * POST {email, password} → 200 {step: 'code', message}: register a new account
 * (astro-tbb.3). The answer is the same whether or not the address already
 * has an account (no account discovery):
 *  - a new address, or one registered earlier but never confirmed, gets a
 *    6-digit code by email; the account is pending, with the address unconfirmed;
 *  - an address with an account gets a notice saying so instead, and nothing changes.
 * 400 for an unacceptable password (length, or on the breach list); 429 when
 * this IP has registered too often. Entering the code is register_confirm.php;
 * after that the account waits for an admin's approval.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

const MAX_REGISTERS_PER_IP = 5;   // per 15 minutes

handle(function (): void {
  require_same_origin_post();
  $b = json_body();
  $email = normal_email((string)($b['email'] ?? ''));
  $pw = (string)($b['password'] ?? '');
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    reply(400, ['error' => 'email', 'message' => 'Enter your email address.']);
  }
  $ki = 'register:ip:' . (string)($_SERVER['REMOTE_ADDR'] ?? '');
  if (count_events($ki, time() - SEND_WINDOW) >= MAX_REGISTERS_PER_IP) {
    reply(429, ['error' => 'too many', 'message' => 'Too many registrations from here just now. Try again in 15 minutes.']);
  }
  record_event($ki); // every attempt counts, so the breach-list check cannot be run without limit
  if ($p = new_password_problem($pw)) reply(400, ['error' => 'password', 'message' => "Password not accepted: $p."]);

  // hashed whichever way it goes, so the reply takes as long for an existing address
  $hash = hash_password($pw);
  $now = time();
  $q = db()->prepare('SELECT id, email, email_confirmed FROM users WHERE email = ?');
  $q->execute([$email]);
  $u = $q->fetch() ?: null;

  if ($u && (int)$u['email_confirmed'] === 1) {
    send_notice($email, 'already', 'Your Astrodynamics account',
      "Someone, perhaps you, tried to register this address with Astrodynamics. It already has an account,\n"
      . "so nothing has changed. To get in, sign in, or use \"Forgot password?\" on the sign-in form.\n\n"
      . "If it was not you, you can ignore this message.");
  } else {
    if ($u) {
      // registered before but never confirmed: the new password replaces the old, and the 7 days restart
      db()->prepare('UPDATE users SET pass_hash = ?, created_at = ? WHERE id = ?')->execute([$hash, $now, $u['id']]);
      $id = $u['id'];
    } else {
      $id = uuid4();
      try {
        db()->prepare("INSERT INTO users (id, email, pass_hash, created_at, status, role, status_changed_at, email_confirmed, two_step)
          VALUES (?, ?, ?, ?, 'pending', 'user', ?, 0, 0)")->execute([$id, $email, $hash, $now, $now]);
      } catch (PDOException $e) {
        $id = null; // registered at the same moment by another request: leave that one alone
      }
    }
    if ($id !== null && ($code = issue_code($id, $email, 'register')) !== null) {
      [$subject, $body] = code_message($code, 'register');
      if (!send_mail($email, $subject, $body)) error_log('astro api: registration code not accepted for sending');
    }
  }
  reply(200, ['ok' => true, 'step' => 'code',
    'message' => "We have emailed $email. Enter the code from that message to confirm the address "
      . '(if the address already has an account, the message says so instead).']);
});
