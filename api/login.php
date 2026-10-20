<?php
/**
 * POST {email, password} → 200 {user} and a session cookie; 401 for any wrong pair; 429 when limited.
 *
 * Two-step sign-in (always for admins, by choice for users): a correct password
 * gets 200 {step: 'code'} and a 6-digit code by email, and no session. The app
 * then sends {email, password, code}; the password is checked again, so a code
 * is useful only together with it. A wrong code is 400 and changes nothing else.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

// A hash of a random password nobody knows: an unknown email costs the same
// password_verify as a known one, so timing does not reveal which emails exist.
const DUMMY_HASH = '$2y$12$4Ug3Zf9FhsNDvocMhWne3OL1GR2t/Iok9v8Dmid33f/DLlRRozHEm';

handle(function (): void {
  require_same_origin_post();
  $b = json_body();
  $email = normal_email((string)($b['email'] ?? ''));
  $pw = (string)($b['password'] ?? '');
  if ($email === '' || $pw === '' || strlen($email) > 190 || strlen($pw) > 1024) {
    reply(400, ['error' => 'email and password required']);
  }
  $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
  $wait = login_wait($email, $ip);
  if ($wait > 0) {
    reply(429, ['error' => 'too many attempts', 'retryAfter' => $wait], ['Retry-After' => (string)$wait]);
  }

  purge_due_deletions(); // an indexed query; me.php runs it too, so the 30 days hold without a cron job
  $q = db()->prepare('SELECT id, email, pass_hash, status, role, two_step, email_confirmed FROM users WHERE email = ?');
  $q->execute([$email]);
  $u = $q->fetch() ?: null;
  $ok = password_verify($pw, $u['pass_hash'] ?? DUMMY_HASH);
  if (!$u || !$ok) {
    record_login_failure($email, $ip);
    reply(401, ['error' => 'wrong email or password']);
  }
  // only someone who knows the password learns the account's state
  if (!in_array($u['status'], SIGN_IN_STATES, true)) {
    clear_login_failures($email);
    $message = (int)$u['email_confirmed'] === 0
      ? 'This address has not been confirmed yet. Register again to get a new code.'
      : barred_message($u['status']);
    reply(403, ['error' => $u['status'], 'message' => $message]);
  }
  clear_login_failures($email);
  $second = needs_second_step($u);
  if ($second) {
    $code = trim((string)($b['code'] ?? ''));
    if ($code === '') {
      $c = issue_code($u['id'], $email, 'signin');
      if ($c === null) {
        reply(429, ['error' => 'codes', 'message' => 'Several codes have been sent to this address recently. Use the latest, or try again in 15 minutes.']);
      }
      [$subject, $body] = code_message($c, 'signin');
      if (!send_mail($email, $subject, $body)) error_log('astro api: sign-in code not accepted for sending');
      reply(200, ['step' => 'code', 'message' => "We have emailed a code to $email. It is valid for 10 minutes."]);
    }
    if (check_code($email, 'signin', $code) !== $u['id']) {
      reply(400, ['error' => 'code', 'message' => 'That code is wrong or has expired. Check the latest email, or ask for a new code.']);
    }
  }
  if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) {
    db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password($pw), $u['id']]);
  }
  start_session($u['id'], $second); // a new token on every sign-in
  reply(200, ['user' => user_json($u + ['verified' => $second])]);
});
