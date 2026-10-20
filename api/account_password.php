<?php
/**
 * POST {current, password} → 200 {ok, message}: change the signed-in account's
 * password (astro-tbb.5). Needs the current password (with the sign-in lockout);
 * every other session of the account ends, this one stays signed in.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $u = require_user();
  $b = json_body();
  require_own_password($u, (string)($b['current'] ?? ''));
  $pw = (string)($b['password'] ?? '');
  if ($p = new_password_problem($pw)) reply(400, ['error' => 'password', 'message' => "New password not accepted: $p."]);
  db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password($pw), $u['id']]);
  $q = db()->prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?');
  $q->execute([$u['id'], current_session_hash()]);
  $n = $q->rowCount();
  send_notice($u['email'], 'password', 'Your Astrodynamics password was changed',
    "The password for your Astrodynamics account was changed just now.\n\n"
    . "If that was not you, use \"Forgot password?\" on the sign-in form at once to set a new one,\n"
    . 'and tell admin@fairflow.co.uk.');
  reply(200, ['ok' => true, 'message' => 'Password changed.' . ($n ? " $n other session" . ($n === 1 ? ' was' : 's were') . ' signed out.' : '')]);
});
