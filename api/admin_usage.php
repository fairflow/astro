<?php
/**
 * GET → 200 {days, users, states, presets}: usage for the admin panel (astro-6yh).
 *   days:   [{day, preset, n}] Ask Claude readings per UTC day and model, the last 30 days
 *   users:  [{id, email, ask24, ask7, ask30, models: {preset: n}, readings, charts}]
 *           (ask24 from the passes used in the last 24 hours; 7 and 30 days from the daily counts)
 *   states: {state: number of accounts}
 * Counts only; no content. Admins only, with a session that passed the email-code step.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  require_admin();
  $today = gmdate('Y-m-d');
  $d7 = gmdate('Y-m-d', time() - 6 * 86400);
  $d30 = gmdate('Y-m-d', time() - 29 * 86400);

  $q = db()->prepare('SELECT day, preset, SUM(n) AS n FROM ask_daily WHERE day >= ? GROUP BY day, preset ORDER BY day');
  $q->execute([$d30]);
  $days = array_map(fn(array $r): array => ['day' => $r['day'], 'preset' => $r['preset'], 'n' => (int)$r['n']], $q->fetchAll());

  $users = [];
  foreach (db()->query('SELECT id, email FROM users ORDER BY email')->fetchAll() as $u) {
    $users[$u['id']] = ['id' => $u['id'], 'email' => $u['email'], 'ask24' => 0, 'ask7' => 0, 'ask30' => 0,
      'models' => (object)[], 'readings' => 0, 'charts' => 0];
  }
  $q = db()->prepare('SELECT user_id, COUNT(*) AS n FROM ask_passes WHERE used_at > ? GROUP BY user_id');
  $q->execute([time() - 86400]);
  foreach ($q->fetchAll() as $r) if (isset($users[$r['user_id']])) $users[$r['user_id']]['ask24'] = (int)$r['n'];
  $q = db()->prepare('SELECT user_id, day, preset, n FROM ask_daily WHERE day >= ?');
  $q->execute([$d30]);
  $models = [];
  foreach ($q->fetchAll() as $r) {
    if (!isset($users[$r['user_id']])) continue;
    $n = (int)$r['n'];
    $users[$r['user_id']]['ask30'] += $n;
    if ($r['day'] >= $d7) $users[$r['user_id']]['ask7'] += $n;
    $models[$r['user_id']][$r['preset']] = ($models[$r['user_id']][$r['preset']] ?? 0) + $n;
  }
  foreach ($models as $id => $m) $users[$id]['models'] = $m;
  foreach (['readings', 'charts'] as $t) {
    foreach (db()->query("SELECT user_id, COUNT(*) AS n FROM $t WHERE deleted = 0 GROUP BY user_id")->fetchAll() as $r) {
      if (isset($users[$r['user_id']])) $users[$r['user_id']][$t] = (int)$r['n'];
    }
  }
  $states = [];
  foreach (db()->query('SELECT status, COUNT(*) AS n FROM users GROUP BY status')->fetchAll() as $r) $states[$r['status']] = (int)$r['n'];

  reply(200, ['today' => $today, 'days' => $days, 'users' => array_values($users), 'states' => (object)$states,
    'presets' => ASK_PRESETS, 'limit' => ask_daily_limit()]);
});
