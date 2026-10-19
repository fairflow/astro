<?php
/** GET → 200 {user: {email, status, role}} when signed in, else 200 {user: null}. The app also uses it to see whether the API exists. */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  // housekeeping on every page load (see login.php); it must never fail the request,
  // e.g. for a visitor who is not signed in, or before the tables exist
  try { purge_due_deletions(); } catch (Throwable $e) { error_log('astro api purge: ' . $e->getMessage()); }
  $u = current_user();
  reply(200, ['user' => $u ? ['email' => $u['email'], 'status' => $u['status'], 'role' => $u['role']] : null]);
});
