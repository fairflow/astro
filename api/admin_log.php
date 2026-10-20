<?php
/** GET → 200 {log: [...]}: the latest 200 admin actions, newest first (astro-tbb.4). Admins only. */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  require_admin();
  $rows = db()->query('SELECT admin_email, action, target_email, detail, at FROM admin_log ORDER BY id DESC LIMIT 200')->fetchAll();
  reply(200, ['log' => array_map(fn(array $r): array => [
    'admin' => $r['admin_email'], 'action' => $r['action'], 'target' => $r['target_email'],
    'detail' => $r['detail'], 'at' => (int)$r['at'],
  ], $rows)]);
});
