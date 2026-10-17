<?php
/**
 * Apply api/sql/*.sql in name order, each once (recorded in schema_migrations).
 * Command line only. On the server:   php ~/fairflow.co.uk/astro/api/cli/migrate.php
 * Locally (dev/tests): ASTRO_DB_INI=.local/dev.ini php api/cli/migrate.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ASTRO_API', 1);
require __DIR__ . '/../lib/bootstrap.php';

$pdo = db();
$opts = is_sqlite() ? '' : 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
$pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) NOT NULL PRIMARY KEY, applied_at BIGINT NOT NULL) $opts");
$done = array_flip($pdo->query('SELECT name FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));

$files = glob(__DIR__ . '/../sql/*.sql');
sort($files);
$applied = 0;
foreach ($files as $f) {
  $name = basename($f);
  if (isset($done[$name])) continue;
  $sql = preg_replace('/^\s*--.*$/m', '', file_get_contents($f));
  $sql = str_replace('/*TABLE_OPTIONS*/', $opts, $sql);
  // MariaDB commits each DDL statement on its own; SQLite can run the file atomically
  if (is_sqlite()) $pdo->beginTransaction();
  foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) $pdo->exec($stmt);
  $pdo->prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')->execute([$name, time()]);
  if (is_sqlite()) $pdo->commit();
  echo "applied $name\n";
  $applied++;
}
echo $applied ? "done\n" : "already up to date\n";
