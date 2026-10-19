<?php
/**
 * POST {email} → 200 always, with the same message whether or not the address
 * has an account (no account discovery). If it belongs to an account that can
 * sign in (active or paused), a 6-digit code is emailed to it.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $email = normal_email((string)(json_body()['email'] ?? ''));
  if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) reply(400, ['error' => 'enter your email address']);

  $q = db()->prepare('SELECT id, status FROM users WHERE email = ?');
  $q->execute([$email]);
  $u = $q->fetch();
  if ($u && in_array($u['status'], SIGN_IN_STATES, true)) {
    $code = issue_code($u['id'], $email, 'reset');
    if ($code !== null) {
      [$subject, $body] = code_message($code, 'reset');
      if (!send_mail($email, $subject, $body)) error_log('astro api: reset mail not accepted for sending');
    }
  }
  reply(200, ['ok' => true, 'message' => 'If that address has an account, a code is on its way. It is valid for 10 minutes.']);
});
