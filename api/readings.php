<?php
/**
 * Ask Claude readings synced to the signed-in account (astro-cbi; docs/DESIGN.md §5a).
 *
 * GET ?since=REV → 200 {readings: [...], cursor, more}: readings changed after
 *   REV (0 for all), oldest change first, at most PAGE per call; call again with
 *   `cursor` while `more`. Deleted readings come as {id, deleted: true}. Active
 *   and paused accounts.
 * POST {readings: [...], deleted: [id, ...]} → 200 {rev, saved: [id...], refused: [{id, reason}]}:
 *   save readings (new, or a longer text for one the browser saved mid-stream)
 *   and delete others. Saving needs an active account (paused accounts may still
 *   delete). A deleted reading stays deleted: a device that has not heard yet
 *   cannot bring it back. Deleting clears the reading's content on the server.
 *
 * The cursor is server time in microseconds. When a pull reaches the end, the
 * returned cursor stays OVERLAP_US behind the present, so a write that commits
 * a moment late is fetched next time (saving by id makes repeats harmless).
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

const PAGE = 200;
const OVERLAP_US = 5_000_000;
const MAX_READINGS = 1000;               // per account, not counting deleted ones
const MAX_TEXT_BYTES = 200 * 1024;       // per reading
const MAX_SYNC_BYTES = 2 * 1024 * 1024;  // per request
const TABS = ['natal', 'transits', 'couple-transits', 'synastry', 'composite', 'orrery'];
const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';

function now_us(): int {
  static $last = 0;
  return $last = max($last + 1, (int)(microtime(true) * 1e6));
}

/** A reading from the browser, checked; or the reason it is refused. */
function clean_reading(mixed $r): array|string {
  if (!is_array($r)) return 'not an object';
  $s = fn(string $k, int $max): ?string => is_string($r[$k] ?? null) && strlen($r[$k]) <= $max ? $r[$k] : null;
  $out = [
    'id' => is_string($r['id'] ?? null) && preg_match(UUID_RE, $r['id']) ? $r['id'] : null,
    'rkey' => $s('key', 2000), 'grp' => $s('group', 2000), 'title' => $s('title', 2000),
    'question' => $s('question', 8000), 'preset' => $s('preset', 40),
    'tab' => in_array($r['tab'] ?? null, TABS, true) ? $r['tab'] : null,
    'body' => $s('text', MAX_TEXT_BYTES),
    'created_at' => is_int($r['createdAt'] ?? null) && $r['createdAt'] > 0 ? $r['createdAt'] : null,
  ];
  foreach ($out as $k => $v) if ($v === null) return $k === 'body' ? 'text missing or too long' : "bad $k";
  if (trim($out['body']) === '') return 'empty text';
  $out['anonymised'] = !empty($r['anonymised']) ? 1 : 0;
  $out['stopped'] = !empty($r['stopped']) ? 1 : 0;
  $out['interrupted'] = !empty($r['interrupted']) ? 1 : 0;
  return $out;
}

function reading_json(array $row): array {
  if ((int)$row['deleted'] === 1) return ['id' => $row['id'], 'deleted' => true];
  return [
    'id' => $row['id'], 'key' => $row['rkey'], 'group' => $row['grp'], 'tab' => $row['tab'],
    'title' => $row['title'], 'question' => $row['question'], 'preset' => $row['preset'],
    'anonymised' => (int)$row['anonymised'] === 1, 'text' => $row['body'],
    'stopped' => (int)$row['stopped'] === 1, 'interrupted' => (int)$row['interrupted'] === 1,
    'createdAt' => (int)$row['created_at'],
  ];
}

handle(function (): void {
  $method = $_SERVER['REQUEST_METHOD'] ?? '';
  if ($method === 'GET') {
    $u = require_user();
    $since = max(0, (int)($_GET['since'] ?? 0));
    $q = db()->prepare('SELECT * FROM readings WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT ' . (PAGE + 1));
    $q->execute([$u['id'], $since]);
    $rows = $q->fetchAll();
    $more = count($rows) > PAGE;
    $rows = array_slice($rows, 0, PAGE);
    $last = $rows ? (int)end($rows)['rev'] : $since;
    $cursor = $more ? $last : max($since, min($last, now_us() - OVERLAP_US));
    reply(200, ['readings' => array_map('reading_json', $rows), 'cursor' => $cursor, 'more' => $more]);
  }

  require_same_origin_post();
  $u = require_user();
  $b = json_body(MAX_SYNC_BYTES);
  $incoming = is_array($b['readings'] ?? null) ? $b['readings'] : [];
  $deletes = is_array($b['deleted'] ?? null) ? $b['deleted'] : [];
  if ($incoming) require_writer();

  $pdo = db();
  $saved = [];
  $refused = [];
  $pdo->beginTransaction();
  try {
    $find = $pdo->prepare('SELECT deleted, body, stopped, interrupted FROM readings WHERE user_id = ? AND id = ?');
    foreach ($deletes as $id) {
      if (!is_string($id) || !preg_match(UUID_RE, $id)) continue;
      $pdo->prepare('UPDATE readings SET deleted = 1, rkey = NULL, grp = NULL, title = NULL, question = NULL,
          body = NULL, rev = ? WHERE user_id = ? AND id = ? AND deleted = 0')
        ->execute([now_us(), $u['id'], $id]);
    }
    $count = $pdo->prepare('SELECT COUNT(*) FROM readings WHERE user_id = ? AND deleted = 0');
    $count->execute([$u['id']]);
    $n = (int)$count->fetchColumn();
    foreach ($incoming as $raw) {
      $r = clean_reading($raw);
      $id = is_array($raw) && is_string($raw['id'] ?? null) ? $raw['id'] : '';
      if (is_string($r)) { $refused[] = ['id' => $id, 'reason' => $r]; continue; }
      $find->execute([$u['id'], $r['id']]);
      $old = $find->fetch();
      if ($old && (int)$old['deleted'] === 1) { $refused[] = ['id' => $r['id'], 'reason' => 'deleted']; continue; }
      if ($old) {
        // the same reading again: only a change (more text, now finished) is written
        if ($old['body'] !== $r['body'] || (int)$old['stopped'] !== $r['stopped'] || (int)$old['interrupted'] !== $r['interrupted']) {
          $pdo->prepare('UPDATE readings SET body = ?, stopped = ?, interrupted = ?, rev = ? WHERE user_id = ? AND id = ?')
            ->execute([$r['body'], $r['stopped'], $r['interrupted'], now_us(), $u['id'], $r['id']]);
        }
      } else {
        if ($n >= MAX_READINGS) { $refused[] = ['id' => $r['id'], 'reason' => 'full']; continue; }
        $pdo->prepare('INSERT INTO readings (user_id, id, rkey, grp, tab, title, question, preset, anonymised,
            body, stopped, interrupted, created_at, rev, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
          ->execute([$u['id'], $r['id'], $r['rkey'], $r['grp'], $r['tab'], $r['title'], $r['question'], $r['preset'],
            $r['anonymised'], $r['body'], $r['stopped'], $r['interrupted'], $r['created_at'], now_us()]);
        $n++;
      }
      $saved[] = $r['id'];
    }
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
  reply(200, ['rev' => now_us(), 'saved' => $saved, 'refused' => $refused]);
});
