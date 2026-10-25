<?php
/**
 * POST {on: true|false} → 200 {user}: turn two-step sign-in (an emailed code
 * after the password) on or off for the signed-in account. Sessions already
 * signed in stay signed in either way. Turning it off needs a session that
 * passed the code step. Admins too may turn it off (2026-10-25): their admin
 * pages then need only the password.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $u = require_user();
  $on = (json_body()['on'] ?? null);
  if (!is_bool($on)) reply(400, ['error' => 'expected {on: true|false}']);
  if (!$on && !$u['verified']) {
    reply(403, ['error' => 'second step', 'message' => 'To turn this off, sign out and sign in again with the emailed code first.']);
  }
  db()->prepare('UPDATE users SET two_step = ? WHERE id = ?')->execute([$on ? 1 : 0, $u['id']]);
  reply(200, ['user' => user_json(['two_step' => $on ? 1 : 0] + $u)]);
});
