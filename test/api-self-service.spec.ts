// Self-service (astro-tbb.5): download my data, change password, close my
// account and cancel within 30 days. A real `php -S` over SQLite; mail goes
// to mail.log. Skipped without PHP.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = 8790 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const ME = 'self@example.com';
const BOSS = 'boss@example.com';
const PW = 'a long password 1';
const PW2 = 'another password 2';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
const jars: Record<string, string> = {};

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const sql = (q: string) => spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');${q}`], { encoding: 'utf8' }).stdout;
const mails = (): { to: string; subject: string; body: string }[] => {
  const f = join(dir, 'mail.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
};
const lastMailTo = (to: string) => mails().filter(m => m.to === to).at(-1);

async function call(who: string, path: string, json?: unknown) {
  const h: Record<string, string> = { 'x-astro': '1' };
  if (json !== undefined) h['content-type'] = 'application/json';
  if (jars[who]) h.cookie = jars[who]!;
  const res = await fetch(BASE + path, json === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) { const pair = set.split(';')[0]!; jars[who] = pair.endsWith('=') ? '' : pair; }
  return { status: res.status, body: await res.json(), headers: res.headers };
}
const signIn = (who: string, email = ME, password = PW) => { jars[who] = ''; return call(who, '/api/login.php', { email, password }); };
const me = async (who: string) => (await call(who, '/api/me.php')).body.user;
const clearLimits = () => sql(`$p->exec("DELETE FROM login_failures");`);

describe.skipIf(!hasPhp)('API self-service (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-self-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n[passwords]\npwned_check = off\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    cli(['api/cli/migrate.php']);
    for (const e of [ME, BOSS]) cli(['api/cli/user.php', 'add', e], `${PW}\n`);
    cli(['api/cli/user.php', 'admin', BOSS]);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    expect((await signIn('laptop')).status).toBe(200);
  });
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('download my data: the account, live readings (not deleted ones) and admin actions on it', async () => {
    const keep = randomUUID(); const gone = randomUUID();
    const r = (id: string, text: string) => ({ id, key: 'natal|A@1990-01-01', group: 'natal|A@1990-01-01', tab: 'natal',
      title: 'Natal · A', question: 'q', preset: 'sonnet-medium', anonymised: true, text, stopped: false, createdAt: Date.now() });
    await call('laptop', '/api/readings.php', { readings: [r(keep, 'kept'), r(gone, 'gone')] });
    await call('laptop', '/api/readings.php', { deleted: [gone] });
    sql(`$p->exec("INSERT INTO admin_log (id, admin_id, admin_email, action, target_id, target_email, detail, at) SELECT '0000000000000001-x', 'a', 'boss@example.com', 'pause', id, email, 'active → paused', 1 FROM users WHERE email='${ME}'");`);
    const x = await call('laptop', '/api/account_export.php');
    expect(x.status).toBe(200);
    expect(x.headers.get('content-disposition')).toContain('astrodynamics-account.json');
    expect(x.body.account).toMatchObject({ email: ME, status: 'active', role: 'user', twoStep: false, activeSessions: 1 });
    expect(x.body.readings.map((y: { id: string }) => y.id)).toEqual([keep]);
    expect(x.body.adminActions).toEqual([{ action: 'pause', detail: 'active → paused', at: '1970-01-01T00:00:01+00:00' }]);
    expect(JSON.stringify(x.body)).not.toMatch(/pass_hash|\$2y\$|id_hash/);
    jars.nobody = '';
    expect((await call('nobody', '/api/account_export.php')).status).toBe(401);
  });

  it('change password: needs the current one; ends other sessions, keeps this one, and emails a notice', async () => {
    expect((await signIn('phone')).status).toBe(200);
    clearLimits();
    expect(await call('laptop', '/api/account_password.php', { current: 'wrong password!', password: PW2 }))
      .toMatchObject({ status: 400, body: { error: 'current password' } });
    expect(await call('laptop', '/api/account_password.php', { current: PW, password: 'short' }))
      .toMatchObject({ status: 400, body: { error: 'password' } });
    const r = await call('laptop', '/api/account_password.php', { current: PW, password: PW2 });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    expect(r.body.message).toContain('1 other session was signed out');
    expect(await me('laptop')).toMatchObject({ email: ME });
    expect(await me('phone')).toBeNull();
    expect(lastMailTo(ME)!.subject).toBe('Your Astrodynamics password was changed');
    expect((await signIn('phone', ME, PW2)).status).toBe(200);
  });

  it('wrong current passwords count towards the sign-in lockout', async () => {
    clearLimits();
    for (let i = 0; i < 5; i++) await call('laptop', '/api/account_password.php', { current: 'nope nope nope', password: PW });
    expect((await call('laptop', '/api/account_password.php', { current: PW2, password: PW })).status).toBe(429);
    clearLimits();
  });

  it('close my account: needs the password, signs out everywhere, emails, and sign-in then offers to cancel', async () => {
    expect((await call('laptop', '/api/account_close.php', { password: 'wrong password!' })).status).toBe(400);
    expect(await me('laptop')).not.toBeNull();
    const r = await call('laptop', '/api/account_close.php', { password: PW2 });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    expect(r.body.deleteAfter - Date.now() / 1000).toBeGreaterThan(29 * 86400);
    expect(await me('laptop')).toBeNull();
    expect(await me('phone')).toBeNull();
    expect(lastMailTo(ME)!.subject).toBe('Your Astrodynamics account will be removed');
    const s = await signIn('laptop', ME, PW2);
    expect(s).toMatchObject({ status: 403, body: { error: 'deleting', canCancel: true } });
    expect(s.body.message).toMatch(/removed on \d+ \w+ \d{4}/);
  });

  it('cancel the removal: needs the right password; the account is back as it was', async () => {
    clearLimits();
    expect((await call('anon', '/api/account_reopen.php', { email: ME, password: 'wrong password!' })).status).toBe(401);
    expect((await call('anon', '/api/account_reopen.php', { email: 'nobody@example.com', password: PW2 })).status).toBe(401);
    const r = await call('anon', '/api/account_reopen.php', { email: ME, password: PW2 });
    expect(r).toMatchObject({ status: 200, body: { ok: true, status: 'active' } });
    expect(lastMailTo(ME)!.subject).toBe('Your Astrodynamics account will not be removed');
    expect((await call('anon', '/api/account_reopen.php', { email: ME, password: PW2 })).status).toBe(409);
    expect((await signIn('laptop', ME, PW2)).status).toBe(200);
  });

  it('an admin account cannot close itself', async () => {
    clearLimits();
    jars.boss = '';
    await call('boss', '/api/login.php', { email: BOSS, password: PW });
    const code = /code is (\d{6})/.exec(lastMailTo(BOSS)!.body)![1];
    await call('boss', '/api/login.php', { email: BOSS, password: PW, code });
    expect(await call('boss', '/api/account_close.php', { password: PW })).toMatchObject({ status: 403, body: { error: 'admin' } });
  });

  it('after 30 days the account and its readings are gone', async () => {
    await call('laptop', '/api/account_close.php', { password: PW2 });
    sql(`$p->exec("UPDATE users SET delete_after = strftime('%s','now') - 1 WHERE email='${ME}'");`);
    await me('anon'); // housekeeping
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM users WHERE email='${ME}'")->fetchColumn(), '/', $p->query("SELECT COUNT(*) FROM readings")->fetchColumn();`)).toBe('0/0');
  });
});
