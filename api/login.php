<?php
/** POST {email, password} → 200 {user} and a session cookie; 401 for any wrong pair; 429 when limited. */
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

  $q = db()->prepare('SELECT id, email, pass_hash FROM users WHERE email = ?');
  $q->execute([$email]);
  $u = $q->fetch() ?: null;
  $ok = password_verify($pw, $u['pass_hash'] ?? DUMMY_HASH);
  if (!$u || !$ok) {
    record_login_failure($email, $ip);
    reply(401, ['error' => 'wrong email or password']);
  }
  if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) {
    db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password($pw), $u['id']]);
  }
  clear_login_failures($email);
  start_session($u['id']); // a new token on every sign-in
  reply(200, ['user' => ['email' => $u['email']]]);
});
