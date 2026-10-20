<?php
/**
 * Saved charts (birth data) synced to the signed-in account (astro-ag1;
 * docs/DESIGN.md §5a). The same shape as readings.php:
 *
 * GET ?since=REV → 200 {charts: [{id, data, createdAt, updatedAt} | {id, deleted: true}], cursor, more}
 * POST {charts: [{id, data, createdAt, updatedAt}], deleted: [id, ...]} → 200 {rev, saved, refused}
 *
 * Charts can be edited, so the later edit wins: a chart whose updatedAt is not
 * newer than the server's copy is refused as 'older' (the browser then takes
 * the server's copy on its next pull). A deleted chart stays deleted. Saving
 * needs an active account; paused accounts may pull and delete.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

const PAGE = 200;
const OVERLAP_US = 5_000_000;
const MAX_CHARTS = 2000;
const ACCURACY = ['exact', '5min', '30min', '2h', 'unknown'];
const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

function now_us(): int {
  static $last = 0;
  return $last = max($last + 1, (int)(microtime(true) * 1e6));
}

/** Birth data from the browser, checked and reduced to the known fields; or why it is refused. */
function clean_chart(mixed $c): array|string {
  if (!is_array($c)) return 'not an object';
  if (!is_string($c['id'] ?? null) || !preg_match(UUID_RE, $c['id'])) return 'bad id';
  foreach (['createdAt', 'updatedAt'] as $k) if (!is_int($c[$k] ?? null) || $c[$k] <= 0) return "bad $k";
  $d = $c['data'] ?? null;
  if (!is_array($d)) return 'bad data';
  $str = fn(mixed $v, int $max): bool => is_string($v) && strlen($v) <= $max;
  $p = $d['place'] ?? null;
  $num = fn(mixed $v, float $lim): bool => (is_int($v) || is_float($v)) && abs($v) <= $lim;
  if (!$str($d['name'] ?? null, 200)) return 'bad name';
  if (!is_string($d['date'] ?? null) || !preg_match('/^-?\d{4}-\d{2}-\d{2}$/', $d['date'])) return 'bad date';
  if (!is_string($d['time'] ?? null) || !preg_match('/^\d{2}:\d{2}$/', $d['time'])) return 'bad time';
  if (!in_array($d['accuracy'] ?? null, ACCURACY, true)) return 'bad accuracy';
  if (!is_array($p) || !$str($p['name'] ?? null, 200) || !$str($p['country'] ?? null, 100)
      || !$num($p['lat'] ?? null, 90) || !$num($p['lon'] ?? null, 180) || !$str($p['zone'] ?? null, 64)) return 'bad place';
  if (isset($d['notes']) && !$str($d['notes'], 5000)) return 'bad notes';
  if (isset($d['set']) && !$str($d['set'], 100)) return 'bad set';
  $data = [
    'name' => $d['name'], 'date' => $d['date'], 'time' => $d['time'], 'accuracy' => $d['accuracy'],
    'place' => ['name' => $p['name'], 'country' => $p['country'], 'lat' => $p['lat'], 'lon' => $p['lon'], 'zone' => $p['zone']],
  ];
  if (isset($d['notes'])) $data['notes'] = $d['notes'];
  if (isset($d['set'])) $data['set'] = $d['set'];
  return ['id' => $c['id'], 'data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    'created_at' => $c['createdAt'], 'updated_at' => $c['updatedAt']];
}

function chart_json(array $row): array {
  if ((int)$row['deleted'] === 1) return ['id' => $row['id'], 'deleted' => true];
  return ['id' => $row['id'], 'data' => json_decode((string)$row['data'], true),
    'createdAt' => (int)$row['created_at'], 'updatedAt' => (int)$row['updated_at']];
}

handle(function (): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $u = require_user();
    $since = max(0, (int)($_GET['since'] ?? 0));
    $q = db()->prepare('SELECT * FROM charts WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ' . (PAGE + 1));
    $q->execute([$u['id'], $since]);
    $rows = $q->fetchAll();
    $more = count($rows) > PAGE;
    $rows = array_slice($rows, 0, PAGE);
    $last = $rows ? (int)end($rows)['rev'] : $since;
    $cursor = $more ? $last : max($since, min($last, now_us() - OVERLAP_US));
    reply(200, ['charts' => array_map('chart_json', $rows), 'cursor' => $cursor, 'more' => $more]);
  }

  require_same_origin_post();
  $u = require_user();
  $b = json_body(1024 * 1024);
  $incoming = is_array($b['charts'] ?? null) ? $b['charts'] : [];
  $deletes = is_array($b['deleted'] ?? null) ? $b['deleted'] : [];
  if ($incoming) require_writer();

  $pdo = db();
  $saved = [];
  $refused = [];
  $pdo->beginTransaction();
  try {
    foreach ($deletes as $id) {
      if (!is_string($id) || !preg_match(UUID_RE, $id)) continue;
      $pdo->prepare('UPDATE charts SET deleted = 1, data = NULL, rev = ? WHERE user_id = ? AND id = ? AND deleted = 0')
        ->execute([now_us(), $u['id'], $id]);
    }
    $count = $pdo->prepare('SELECT COUNT(*) FROM charts WHERE user_id = ? AND deleted = 0');
    $count->execute([$u['id']]);
    $n = (int)$count->fetchColumn();
    $find = $pdo->prepare('SELECT deleted, updated_at FROM charts WHERE user_id = ? AND id = ?');
    foreach ($incoming as $raw) {
      $c = clean_chart($raw);
      $id = is_array($raw) && is_string($raw['id'] ?? null) ? $raw['id'] : '';
      if (is_string($c)) { $refused[] = ['id' => $id, 'reason' => $c]; continue; }
      $find->execute([$u['id'], $c['id']]);
      $old = $find->fetch();
      if ($old && (int)$old['deleted'] === 1) { $refused[] = ['id' => $c['id'], 'reason' => 'deleted']; continue; }
      if ($old) {
        if ($c['updated_at'] <= (int)$old['updated_at']) { $refused[] = ['id' => $c['id'], 'reason' => 'older']; continue; }
        $pdo->prepare('UPDATE charts SET data = ?, updated_at = ?, rev = ? WHERE user_id = ? AND id = ?')
          ->execute([$c['data'], $c['updated_at'], now_us(), $u['id'], $c['id']]);
      } else {
        if ($n >= MAX_CHARTS) { $refused[] = ['id' => $c['id'], 'reason' => 'full']; continue; }
        $pdo->prepare('INSERT INTO charts (user_id, id, data, created_at, updated_at, rev, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)')
          ->execute([$u['id'], $c['id'], $c['data'], $c['created_at'], $c['updated_at'], now_us()]);
        $n++;
      }
      $saved[] = $c['id'];
    }
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
  reply(200, ['rev' => now_us(), 'saved' => $saved, 'refused' => $refused]);
});
