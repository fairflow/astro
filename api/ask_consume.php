<?php
/**
 * POST {pass} → 200 {ok}: called by the Ask Claude relay Worker (server to
 * server, so no cookie and no X-Astro header) to check and use up a pass from
 * ask_pass.php before it calls Claude (astro-tbb.7, astro-bk6).
 * 403 for an unknown, used or expired pass, or an account that may no longer
 * use Ask Claude (not active); 429 when the account's daily limit is reached.
 * A pass is 32 random bytes and stored only as a hash, so it cannot be guessed.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('POST');
  $pass = json_body()['pass'] ?? '';
  if (!is_string($pass) || strlen($pass) < 20 || strlen($pass) > 100) reply(403, ['error' => 'pass']);
  $q = db()->prepare('SELECT p.id_hash, p.user_id, p.preset, u.status, u.role FROM ask_passes p JOIN users u ON u.id = p.user_id
    WHERE p.id_hash = ? AND p.used_at IS NULL AND p.expires_at > ?');
  $q->execute([hash('sha256', $pass), time()]);
  $p = $q->fetch();
  if (!$p || $p['status'] !== 'active') reply(403, ['error' => 'pass', 'message' => 'Sign in again to use Ask Claude.']);
  if ($p['role'] !== 'admin') {
    [$used, , $nextAt] = ask_usage($p['user_id']);
    if ($used >= ask_daily_limit()) reply(429, ['error' => 'limit', 'message' => ask_limit_message($nextAt)]);
  }
  // used once: of two requests racing with the same pass, only one updates the row
  $u = db()->prepare('UPDATE ask_passes SET used_at = ? WHERE id_hash = ? AND used_at IS NULL');
  $u->execute([time(), $p['id_hash']]);
  if ($u->rowCount() !== 1) reply(403, ['error' => 'pass']);
  // the usage count must never stop a reading the limit allows
  try { count_ask($p['user_id'], $p['preset']); } catch (Throwable $e) { error_log('astro api: usage count: ' . $e->getMessage()); }
  reply(200, ['ok' => true]);
});
