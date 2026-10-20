<?php
/**
 * POST {userId, action, password?} → 200 {ok, message}: one admin action on one
 * account (astro-tbb.4; docs/DESIGN.md §5a). Admins only, with a session that
 * passed the email-code step. Every action is recorded in admin_log.
 *
 *   approve        pending (address confirmed) → active; the user is emailed
 *   reject         pending → removed at once (a registration has no data)
 *   pause/unpause  active ↔ paused
 *   freeze         active or paused → frozen (sessions end); unfreeze → active
 *   delete         → deleting (sessions end; removed after 30 days); cancel_delete undoes it
 *   set_password   {password}: a new password; the account's sessions end
 *   sign_out       end every session of the account
 *   make_admin / make_user   change the role
 *
 * An admin cannot act on their own account here, so the panel cannot lock its
 * last admin out. 409 when the action does not fit the account's state.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

const ACTIONS = ['approve', 'reject', 'pause', 'unpause', 'freeze', 'unfreeze', 'delete', 'cancel_delete',
  'set_password', 'sign_out', 'make_admin', 'make_user'];

handle(function (): void {
  require_same_origin_post();
  $admin = require_admin();
  $b = json_body();
  $action = (string)($b['action'] ?? '');
  if (!in_array($action, ACTIONS, true)) reply(400, ['error' => 'unknown action']);
  $q = db()->prepare('SELECT id, email, status, role, email_confirmed FROM users WHERE id = ?');
  $q->execute([(string)($b['userId'] ?? '')]);
  $t = $q->fetch() ?: reply(404, ['error' => 'no such account']);
  if ($t['id'] === $admin['id']) reply(403, ['error' => 'self', 'message' => "You can't change your own account here."]);

  $s = $t['status'];
  $wrong = fn() => reply(409, ['error' => 'state', 'message' => "Not possible: {$t['email']} is $s."]);
  $move = function (string $to) use ($t, $s, $admin, $action): void {
    set_status($t['id'], $to);
    log_admin($admin, $action, $t, "$s → $to");
  };

  switch ($action) {
    case 'approve':
      if ($s !== 'pending') $wrong();
      if ((int)$t['email_confirmed'] !== 1) reply(409, ['error' => 'unconfirmed', 'message' => 'The address has not been confirmed yet.']);
      $move('active');
      send_notice($t['email'], 'approved', 'Your Astrodynamics account is approved',
        "Your Astrodynamics account has been approved. Sign in at https://fairflow.co.uk/astro/\n"
        . '(Settings, Account) with the email address and password you registered with.');
      $msg = "{$t['email']} approved and told by email.";
      break;
    case 'reject':
      if ($s !== 'pending') $wrong();
      db()->prepare('DELETE FROM users WHERE id = ?')->execute([$t['id']]);
      log_admin($admin, $action, $t, 'registration removed');
      $msg = "Registration of {$t['email']} removed.";
      break;
    case 'pause':    if ($s !== 'active') $wrong(); $move('paused'); $msg = "{$t['email']} paused."; break;
    case 'unpause':  if ($s !== 'paused') $wrong(); $move('active'); $msg = "{$t['email']} active again."; break;
    case 'freeze':
      if ($s !== 'active' && $s !== 'paused') $wrong();
      $move('frozen'); $msg = "{$t['email']} frozen and signed out."; break;
    case 'unfreeze': if ($s !== 'frozen') $wrong(); $move('active'); $msg = "{$t['email']} active again."; break;
    case 'delete':
      if (!in_array($s, ['active', 'paused', 'frozen'], true)) $wrong();
      $move('deleting');
      $msg = "{$t['email']} will be removed on " . gmdate('j M Y', time() + DELETE_GRACE) . ' unless the deletion is cancelled.';
      break;
    case 'cancel_delete':
      if ($s !== 'deleting') $wrong();
      $back = cancel_deletion($t['id']);
      log_admin($admin, $action, $t, "deleting → $back");
      $msg = "Deletion of {$t['email']} cancelled; it is $back again.";
      break;
    case 'set_password':
      $pw = (string)($b['password'] ?? '');
      if ($p = new_password_problem($pw)) reply(400, ['error' => 'password', 'message' => "Password not accepted: $p."]);
      db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([hash_password($pw), $t['id']]);
      db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$t['id']]);
      log_admin($admin, $action, $t);
      $msg = "New password set for {$t['email']}; its sessions were signed out.";
      break;
    case 'sign_out':
      db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$t['id']]);
      log_admin($admin, $action, $t);
      $msg = "{$t['email']} signed out everywhere.";
      break;
    case 'make_admin':
      if ($t['role'] === 'admin') reply(409, ['error' => 'role', 'message' => "{$t['email']} is already an admin."]);
      if ($s !== 'active') $wrong();
      set_role($t['id'], 'admin');
      log_admin($admin, $action, $t, 'user → admin');
      $msg = "{$t['email']} is now an admin (signing in will need an emailed code).";
      break;
    case 'make_user':
      if ($t['role'] !== 'admin') reply(409, ['error' => 'role', 'message' => "{$t['email']} is not an admin."]);
      set_role($t['id'], 'user');
      log_admin($admin, $action, $t, 'admin → user');
      $msg = "{$t['email']} is no longer an admin.";
      break;
  }
  reply(200, ['ok' => true, 'message' => $msg]);
});
