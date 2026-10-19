// Integration tests for the PHP API (api/, astro-yal): a real `php -S` with
// tools/api-dev-router.php over a throwaway SQLite database. Skipped when PHP
// (with pdo_sqlite) is not installed.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = 8390 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'correct horse battery';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};

const cli = (args: string[], input = '') =>
  spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });

/** A tiny cookie jar: the session cookie the server last set, if any. */
let jar = '';
async function call(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) { headers.set('content-type', 'application/json'); init.body = JSON.stringify(init.json); }
  if (jar) headers.set('cookie', jar);
  const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
  const set = res.headers.get('set-cookie');
  if (set) { const [pair] = set.split(';'); jar = pair!.endsWith('=') || /=deleted$/.test(pair!) ? '' : pair!; }
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: set, headers: res.headers };
}
const post = (path: string, json?: unknown, extra: Record<string, string> = { 'x-astro': '1' }) =>
  call(path, { method: 'POST', json: json ?? {}, headers: extra });

describe.skipIf(!hasPhp)('API logins (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-api-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 001_users.sql');
    expect(cli(['api/cli/user.php', 'add', 'Matthew@Example.com'], `${PW}\n`).stdout).toContain('Created matthew@example.com');
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); return; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    throw new Error('php -S did not start');
  });
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('migrations run once', () => {
    expect(cli(['api/cli/migrate.php']).stdout).toContain('already up to date');
  });

  it('the account command refuses short passwords and duplicate accounts', () => {
    expect(cli(['api/cli/user.php', 'add', 'b@example.com'], 'short\n').stderr).toContain('at least 10');
    expect(cli(['api/cli/user.php', 'add', 'matthew@example.com'], `${PW}\n`).stderr).toContain('already has an account');
    expect(cli(['api/cli/user.php', 'list']).stdout).toContain('matthew@example.com');
  });

  it('signed out: me says no user', async () => {
    jar = '';
    expect(await call('/api/me.php')).toMatchObject({ status: 200, body: { user: null } });
  });

  it('login needs POST, the X-Astro header and a same-site Origin', async () => {
    expect((await call('/api/login.php')).status).toBe(405);
    expect((await post('/api/login.php', { email: 'matthew@example.com', password: PW }, {})).status).toBe(403);
    expect((await post('/api/login.php', { email: 'matthew@example.com', password: PW },
      { 'x-astro': '1', origin: 'https://evil.example' })).status).toBe(403);
    expect(jar).toBe('');
  });

  it('a wrong password and an unknown email get the same answer', async () => {
    const a = await post('/api/login.php', { email: 'matthew@example.com', password: 'wrong password!' });
    const b = await post('/api/login.php', { email: 'nobody@example.com', password: 'wrong password!' });
    expect(a).toMatchObject({ status: 401, body: { error: 'wrong email or password' } });
    expect(b).toMatchObject({ status: 401, body: { error: 'wrong email or password' } });
  });

  it('signing in sets an HttpOnly, SameSite=Strict cookie scoped to the API, and me knows you', async () => {
    const r = await post('/api/login.php', { email: '  MATTHEW@example.com ', password: PW });
    expect(r).toMatchObject({ status: 200, body: { user: { email: 'matthew@example.com' } } });
    expect(r.setCookie).toMatch(/^astro_sid=[A-Za-z0-9_-]{43};/);
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/SameSite=Strict/i);
    expect(r.setCookie).toMatch(/path=\/api\//i);
    expect(await call('/api/me.php')).toMatchObject({ body: { user: { email: 'matthew@example.com' } } });
  });

  it('the server stores only a hash of the session token', () => {
    const token = jar.split('=')[1]!;
    const php = `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');`
      + `echo $p->query("SELECT COUNT(*) FROM sessions WHERE id_hash='" . hash('sha256','${token}') . "'")->fetchColumn(),`
      + `'/', $p->query("SELECT COUNT(*) FROM sessions WHERE id_hash='${token}'")->fetchColumn();`;
    expect(spawnSync('php', ['-r', php], { encoding: 'utf8' }).stdout).toBe('1/0');
  });

  it('a session in use is renewed: expiry pushed out 90 days and a fresh cookie sent', async () => {
    const token = jar.split('=')[1]!;
    const sql = (q: string) => spawnSync('php', ['-r',
      `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');$h=hash('sha256','${token}');${q}`], { encoding: 'utf8' }).stdout;
    // pretend it was last used 2 days ago and expires in 1 hour
    sql(`$p->exec("UPDATE sessions SET last_seen_at=strftime('%s','now')-172800, expires_at=strftime('%s','now')+3600 WHERE id_hash='$h'");`);
    const r = await call('/api/me.php');
    expect(r.body.user).not.toBeNull();
    expect(r.setCookie).toMatch(/^astro_sid=/);
    const left = Number(sql(`echo $p->query("SELECT expires_at-strftime('%s','now') FROM sessions WHERE id_hash='$h'")->fetchColumn();`));
    expect(left).toBeGreaterThan(89 * 86400);
    // used again within a day: no write, no new cookie
    expect((await call('/api/me.php')).setCookie).toBeNull();
  });

  it('an expired session is not accepted, but nothing else ends one', async () => {
    const token = jar.split('=')[1]!;
    const run = (q: string) => spawnSync('php', ['-r',
      `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');$h=hash('sha256','${token}');${q}`], { encoding: 'utf8' });
    run(`$p->exec("UPDATE sessions SET expires_at=strftime('%s','now')-1 WHERE id_hash='$h'");`);
    expect((await call('/api/me.php')).body.user).toBeNull();
    run(`$p->exec("UPDATE sessions SET expires_at=strftime('%s','now')+86400 WHERE id_hash='$h'");`);
    expect((await call('/api/me.php')).body.user).not.toBeNull();
  });

  it('a signed-out visitor gets {user: null} even when the database is down (no false "could not check")', async () => {
    const saved = jar; jar = '';
    const ini = join(dir, 'db.ini');
    const good = readFileSync(ini, 'utf8');
    writeFileSync(ini, `[db]\ndriver = sqlite\npath = "${join(dir, 'missing', 'nope.sqlite')}"\n`);
    try {
      expect(await call('/api/me.php')).toMatchObject({ status: 200, body: { user: null } });
    } finally { writeFileSync(ini, good); jar = saved; }
  });

  it('a database failure is a 500 and leaves the session alone', async () => {
    const saved = jar;
    const ini = join(dir, 'db.ini');
    const good = readFileSync(ini, 'utf8');
    writeFileSync(ini, `[db]\ndriver = sqlite\npath = "${join(dir, 'missing', 'nope.sqlite')}"\n`);
    try {
      const r = await call('/api/me.php');
      expect(r.status).toBe(500);
      expect(r.setCookie).toBeNull();
    } finally { writeFileSync(ini, good); }
    jar = saved;
    expect((await call('/api/me.php')).body.user).not.toBeNull();
  });

  it('signing out ends the session', async () => {
    const saved = jar;
    expect((await post('/api/logout.php')).status).toBe(200);
    jar = saved; // even if a copy of the old cookie were replayed
    expect(await call('/api/me.php')).toMatchObject({ body: { user: null } });
  });

  it('changing the password signs out every session', async () => {
    await post('/api/login.php', { email: 'matthew@example.com', password: PW });
    expect((await call('/api/me.php')).body.user).not.toBeNull();
    expect(cli(['api/cli/user.php', 'passwd', 'matthew@example.com'], `${PW} 2\n`).stdout).toContain('signed out');
    expect((await call('/api/me.php')).body.user).toBeNull();
  });

  it('after 5 failures for one email, login waits (429) even with the right password', async () => {
    jar = '';
    for (let i = 0; i < 5; i++) await post('/api/login.php', { email: 'matthew@example.com', password: 'nope nope nope' });
    const r = await post('/api/login.php', { email: 'matthew@example.com', password: `${PW} 2` });
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('internal folders and other paths are not served', async () => {
    for (const p of ['/api/lib/bootstrap.php', '/api/cli/user.php', '/api/sql/001_users.sql', '/package.json']) {
      expect((await fetch(BASE + p)).status).toBe(404);
    }
  });

  it('bad bodies get a 400, not a server error', async () => {
    const r = await call('/api/login.php', { method: 'POST', headers: { 'x-astro': '1', 'content-type': 'application/json' }, body: 'not json' });
    expect(r.status).toBe(400);
  });

  // ---- account states and roles (astro-tbb.2) ----

  const S_EMAIL = 'states@example.com';
  const S_PW = 'states password 1';
  const signIn = () => post('/api/login.php', { email: S_EMAIL, password: S_PW });
  const user = (...a: string[]) => cli(['api/cli/user.php', ...a]);
  /** Run a guard from api/lib with the current session cookie; prints 'allowed' or the refusal JSON. */
  const guard = (fn: string) => spawnSync('php', ['-r',
    `define('ASTRO_API',1);$_COOKIE['astro_sid']=${JSON.stringify(jar.split('=')[1] ?? '')};`
    + `$_SERVER['SCRIPT_NAME']='/api/x.php';require 'api/lib/bootstrap.php';${fn}();echo 'allowed';`],
  { cwd: root, env, encoding: 'utf8' }).stdout;

  it('migration 002 adds states and roles; accounts start active users', () => {
    expect(cli(['api/cli/migrate.php']).stdout).toContain('already up to date');
    expect(cli(['api/cli/user.php', 'add', S_EMAIL], `${S_PW}\n`).stdout).toContain('Created');
    expect(user('list').stdout).toMatch(/states@example\.com {2}active {2}created/);
  });

  it('sign-in and me report the state and role', async () => {
    jar = '';
    expect(await signIn()).toMatchObject({ status: 200, body: { user: { email: S_EMAIL, status: 'active', role: 'user' } } });
    expect((await call('/api/me.php')).body.user).toMatchObject({ status: 'active', role: 'user' });
    expect(guard('require_writer')).toBe('allowed');
    expect(guard('require_admin')).toContain('admin only');
  });

  it('paused: still signed in and can read, but writes are refused', async () => {
    expect(user('state', S_EMAIL, 'paused').stdout).toContain('is now paused');
    expect((await call('/api/me.php')).body.user).toMatchObject({ status: 'paused' });
    expect(guard('require_user')).toBe('allowed');
    expect(guard('require_writer')).toContain('"error":"paused"');
    expect(user('state', S_EMAIL, 'active').stdout).toContain('is now active');
    expect(guard('require_writer')).toBe('allowed');
  });

  it('frozen: sessions end at once and sign-in is refused, but only a correct password learns why', async () => {
    expect(user('state', S_EMAIL, 'frozen').stdout).toContain('sessions were ended');
    expect((await call('/api/me.php')).body.user).toBeNull();
    const refused = await signIn();
    expect(refused).toMatchObject({ status: 403, body: { error: 'frozen' } });
    expect(refused.setCookie).toBeNull(); // no new session is issued
    expect(await post('/api/login.php', { email: S_EMAIL, password: 'not the password' }))
      .toMatchObject({ status: 401, body: { error: 'wrong email or password' } });
  });

  it('pending: sign-in refused with "waiting for approval"', async () => {
    user('state', S_EMAIL, 'pending');
    const r = await signIn();
    expect(r).toMatchObject({ status: 403, body: { error: 'pending' } });
    expect(r.body.message).toContain('waiting for approval');
  });

  it('admin role: require_admin passes, and it can be taken away', async () => {
    user('state', S_EMAIL, 'active');
    expect(user('admin', S_EMAIL).stdout).toContain('is now admin');
    expect((await signIn()).body.user).toMatchObject({ role: 'admin' });
    expect(guard('require_admin')).toBe('allowed');
    expect(user('role', S_EMAIL, 'user').stdout).toContain('is now user');
    expect(guard('require_admin')).toContain('admin only');
  });

  it('deletion: 30 days of grace, cancellable, then purged on the next page load', async () => {
    expect(user('delete', S_EMAIL).stdout).toMatch(/will be deleted on \d{4}-\d\d-\d\d/);
    expect((await call('/api/me.php')).body.user).toBeNull();
    expect(await signIn()).toMatchObject({ status: 403, body: { error: 'deleting' } });
    expect(user('undelete', S_EMAIL).stdout).toContain('cancelled; it is active again');
    expect((await signIn()).status).toBe(200);

    user('delete', S_EMAIL);
    // the 30 days have passed
    spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');`
      + `$p->exec("UPDATE users SET delete_after=strftime('%s','now')-1 WHERE email='${S_EMAIL}'");`]);
    await call('/api/me.php');
    expect(user('list').stdout).not.toContain(S_EMAIL);
    expect(await signIn()).toMatchObject({ status: 401 });
  });

  it('cancelling a deletion restores the earlier state (a paused account stays paused)', () => {
    expect(cli(['api/cli/user.php', 'add', 'p@example.com'], `${S_PW}\n`).stdout).toContain('Created');
    user('state', 'p@example.com', 'paused');
    user('delete', 'p@example.com');
    expect(user('undelete', 'p@example.com').stdout).toContain('it is paused again');
    expect(user('list').stdout).toMatch(/p@example\.com {2}paused/);
  });

  it('the account command rejects unknown states and roles', () => {
    expect(user('state', 'matthew@example.com', 'deleting').stderr).toContain('use delete / undelete');
    expect(user('role', 'matthew@example.com', 'owner').stderr).toContain('user or admin');
  });
});

