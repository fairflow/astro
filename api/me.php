<?php
/** GET → 200 {user: {email}} when signed in, else 200 {user: null}. The app also uses it to see whether the API exists. */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  $u = current_user();
  reply(200, ['user' => $u ? ['email' => $u['email']] : null]);
});
