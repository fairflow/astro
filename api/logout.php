<?php
/** POST → 200; ends this browser's session (other devices stay signed in). */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_same_origin_post();
  end_session();
  reply(200, ['ok' => true]);
});
