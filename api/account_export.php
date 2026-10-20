<?php
/**
 * GET → 200 {exportedAt, account, readings, adminActions}: everything stored for
 * the signed-in account (astro-tbb.5), for "Download my data". Active and paused
 * accounts. Password hashes, session tokens and codes are not data about the
 * person in any useful form and are left out; the privacy notice lists them.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  $u = require_user();
  $q = db()->prepare('SELECT email, status, role, two_step, created_at, last_seen_at, delete_after FROM users WHERE id = ?');
  $q->execute([$u['id']]);
  $a = $q->fetch();
  $r = db()->prepare('SELECT * FROM readings WHERE user_id = ? AND deleted = 0 ORDER BY created_at');
  $r->execute([$u['id']]);
  $l = db()->prepare('SELECT action, detail, at FROM admin_log WHERE target_id = ? ORDER BY id');
  $l->execute([$u['id']]);
  $s = db()->prepare('SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > ?');
  $s->execute([$u['id'], time()]);
  reply(200, [
    'exportedAt' => gmdate('c'),
    'account' => [
      'email' => $a['email'], 'status' => $a['status'], 'role' => $a['role'],
      'twoStep' => needs_second_step($a), 'created' => gmdate('c', (int)$a['created_at']),
      'lastSeen' => $a['last_seen_at'] === null ? null : gmdate('c', (int)$a['last_seen_at']),
      'activeSessions' => (int)$s->fetchColumn(),
    ],
    'readings' => array_map('reading_json', $r->fetchAll()),
    'adminActions' => array_map(fn(array $x): array => [
      'action' => $x['action'], 'detail' => $x['detail'], 'at' => gmdate('c', (int)$x['at']),
    ], $l->fetchAll()),
  ], ['Content-Disposition' => 'attachment; filename="astrodynamics-account.json"']);
});
