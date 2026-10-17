<?php
/**
 * Router for PHP's built-in server, for local development and tests only (never deployed):
 *   ASTRO_DB_INI=.local/dev.ini php -S 127.0.0.1:8323 -t . tools/api-dev-router.php
 * Serves only the top-level endpoints api/<name>.php, as the host does; lib/,
 * cli/ and sql/ answer 404 here (on the host their .htaccess denies them).
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#^/api/([a-z_]+)\.php$#', $path, $m)) {
  $file = dirname(__DIR__) . '/api/' . $m[1] . '.php';
  if (is_file($file)) {
    $_SERVER['SCRIPT_NAME'] = $path;
    require $file;
    return true;
  }
}
http_response_code(404);
header('Content-Type: text/plain');
echo "not found\n";
return true;
