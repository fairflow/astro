<?php
/**
 * POST {preset?} → 200 {pass, remaining}: a one-use pass for one Ask Claude reading
 * (astro-tbb.7, astro-bk6). The app sends it to the relay Worker, which checks
 * it with ask_consume.php before calling Claude. Active accounts only (paused
 * accounts cannot use Ask Claude); at most [askclaude] daily_limit readings per
 * account in any 24 hours, counting passes issued and not yet used or expired,
 * so a page cannot collect passes ahead; admins have no limit. 429 when used up.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  $u = require_writer();
  $admin = $u['role'] === 'admin';
  [$used, $open, $nextAt] = ask_usage($u['id']);
  $limit = ask_daily_limit();
  if (!$admin && $used + $open >= $limit) {
    reply(429, ['error' => 'limit', 'message' => ask_limit_message($nextAt), 'nextAt' => $nextAt]);
  }
  // the model preset, for the usage counts in the admin panel (the relay picks the model itself)
  $preset = json_body()['preset'] ?? null;
  $preset = is_string($preset) && in_array($preset, ASK_PRESETS, true) ? $preset : null;
  $pass = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
  $now = time();
  db()->prepare('INSERT INTO ask_passes (id_hash, user_id, created_at, expires_at, preset) VALUES (?, ?, ?, ?, ?)')
    ->execute([hash('sha256', $pass), $u['id'], $now, $now + ASK_PASS_SECONDS, $preset]);
  reply(200, ['pass' => $pass, 'remaining' => $admin ? null : $limit - $used - $open - 1]);
});
