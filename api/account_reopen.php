<?php
/**
 * POST {email, password} → 200 {ok, message}: cancel the removal of an account
 * that is in its 30 days (astro-tbb.5). The account goes back to the state it
 * had before (a paused account stays paused); the user then signs in as usual
 * (with the emailed code if two-step is on). 401 for a wrong pair, with the
 * sign-in lockout; 409 when the account is not waiting to be removed.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $b = json_body();
  $email = normal_email((string)($b['email'] ?? ''));
  $pw = (string)($b['password'] ?? '');
  $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
  $wait = login_wait($email, $ip);
  if ($wait > 0) reply(429, ['error' => 'too many attempts', 'retryAfter' => $wait], ['Retry-After' => (string)$wait]);
  purge_due_deletions();
  $q = db()->prepare('SELECT id, email, pass_hash, status FROM users WHERE email = ?');
  $q->execute([$email]);
  $u = $q->fetch() ?: null;
  if (!password_verify($pw, $u['pass_hash'] ?? DUMMY_HASH) || !$u) {
    record_login_failure($email, $ip);
    reply(401, ['error' => 'wrong email or password']);
  }
  clear_login_failures($email);
  if ($u['status'] !== 'deleting') reply(409, ['error' => 'state', 'message' => 'This account is not waiting to be removed.']);
  $state = cancel_deletion($u['id']);
  send_notice($u['email'], 'reopened', 'Your Astrodynamics account will not be removed',
    'The removal of your Astrodynamics account was cancelled just now; it stays as it was.');
  reply(200, ['ok' => true, 'status' => $state, 'message' => 'The removal is cancelled. Sign in again to continue.']);
});
