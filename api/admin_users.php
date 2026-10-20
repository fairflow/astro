<?php
/**
 * GET → 200 {users: [...]}: every account, pending registrations first, for the
 * admin panel (astro-tbb.4). Admins only, with a session that passed the
 * email-code step.
 */
define('ASTRO_API', 1);
require __DIR__ . '/lib/bootstrap.php';

handle(function (): void {
  require_method('GET');
  require_admin();
  // sessions made before users.last_seen_at existed still say when they were last used
  $q = db()->prepare("SELECT u.id, u.email, u.status, u.role, u.created_at, u.delete_after,
      COALESCE(u.last_seen_at, (SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.user_id = u.id)) AS last_seen_at,
      u.two_step, u.email_confirmed,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessions
    FROM users u ORDER BY CASE WHEN u.status = 'pending' THEN 0 ELSE 1 END, u.created_at DESC");
  $q->execute([time()]);
  $users = array_map(fn(array $r): array => [
    'id' => $r['id'], 'email' => $r['email'], 'status' => $r['status'], 'role' => $r['role'],
    'created' => (int)$r['created_at'],
    'lastSeen' => $r['last_seen_at'] === null ? null : (int)$r['last_seen_at'],
    'deleteAfter' => $r['delete_after'] === null ? null : (int)$r['delete_after'],
    'twoStep' => (int)$r['two_step'] === 1 || $r['role'] === 'admin',
    'confirmed' => (int)$r['email_confirmed'] === 1,
    'sessions' => (int)$r['sessions'],
  ], $q->fetchAll());
  reply(200, ['users' => $users]);
});
