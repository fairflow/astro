<?php
/**
 * POST {password} → 200 {ok, deleteAfter, message}: the signed-in user asks for
 * their account to be removed (astro-tbb.5). It is signed out everywhere at
 * once and removed, with everything stored for it, DELETE_GRACE (30 days)
 * later; until then the user can cancel (account_reopen.php) or ask the admin.
 * The user is emailed, so a removal they did not ask for is noticed. Admin
 * accounts cannot close themselves here (another admin, or the command line).
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $u = require_user();
  if ($u['role'] === 'admin') {
    reply(403, ['error' => 'admin', 'message' => 'An admin account cannot close itself here: remove the admin role first (another admin can).']);
  }
  require_own_password($u, (string)(json_body()['password'] ?? ''));
  set_status($u['id'], 'deleting');
  set_session_cookie('', 1);
  $when = gmdate('j F Y', time() + DELETE_GRACE);
  send_notice($u['email'], 'closing', 'Your Astrodynamics account will be removed',
    "You asked for your Astrodynamics account to be closed. It will be removed, with everything stored\n"
    . "for it, on $when.\n\n"
    . "To cancel before then, sign in at https://fairflow.co.uk/astro/ (Settings, Account) and choose\n"
    . '"Cancel the removal". If you did not ask for this, do that now and change your password.');
  reply(200, ['ok' => true, 'deleteAfter' => time() + DELETE_GRACE,
    'message' => "Your account is closed and will be removed on $when. Until then you can cancel by signing in again."]);
});
