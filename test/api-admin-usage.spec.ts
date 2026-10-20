// Admin: add users by invitation, and usage monitoring (astro-6yh). A real
// `php -S` over SQLite; mail goes to mail.log. Skipped without PHP.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freePort } from './freeport.js';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'a long password 1';
const ADMIN = 'boss@example.com';
const USER = 'busy@example.com';

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
const lastTo = (to: string) => mails().filter(m => m.to === to).at(-1)!;

async function call(who: string, path: string, json?: unknown, headers: Record<string, string> = { 'x-astro': '1' }) {
  const h: Record<string, string> = { ...headers };
  if (json !== undefined) h['content-type'] = 'application/json';
  if (jars[who]) h.cookie = jars[who]!;
  const res = await fetch(BASE + path, json === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) jars[who] = set.split(';')[0]!;
  return { status: res.status, body: await res.json() };
}
/** One reading's worth: a pass for `preset`, used up as the relay would. */
async function read(who: string, preset?: string) {
  const p = await call(who, '/api/ask_pass.php', preset ? { preset } : {});
  expect(p.status).toBe(200);
  expect((await call('worker', '/api/ask_consume.php', { pass: p.body.pass }, {})).status).toBe(200);
}

describe.skipIf(!hasPhp)('API admin invitations and usage (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-usage-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n[passwords]\npwned_check = off\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 008_ask_daily.sql');
    for (const e of [ADMIN, USER]) cli(['api/cli/user.php', 'add', e], `${PW}\n`);
    cli(['api/cli/user.php', 'admin', ADMIN]);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    await call(USER, '/api/login.php', { email: USER, password: PW });
    await call(ADMIN, '/api/login.php', { email: ADMIN, password: PW });
    const code = /code is (\d{6})/.exec(lastTo(ADMIN).body)![1];
    expect((await call(ADMIN, '/api/login.php', { email: ADMIN, password: PW, code })).status).toBe(200);
  }, 30_000);
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  // ---- invitations ----

  it('only a verified admin can invite', async () => {
    expect((await call(USER, '/api/admin_invite.php', { email: 'x@example.com' })).status).toBe(403);
    expect((await call(ADMIN, '/api/admin_invite.php', { email: 'x@example.com' }, {})).status).toBe(403); // no X-Astro
  });

  it('inviting makes an active account with no usable password and emails the person how to choose one', async () => {
    const r = await call(ADMIN, '/api/admin_invite.php', { email: ' New.Person@Example.com ' });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    const m = lastTo('new.person@example.com');
    expect(m.subject).toBe('You have an Astrodynamics account');
    expect(m.body).toContain('"Forgot password?"');
    expect(m.body).not.toMatch(/password\s*(is|:)/i); // no password is ever sent
    expect(sql(`echo $p->query("SELECT status || '/' || role || '/' || email_confirmed FROM users WHERE email='new.person@example.com'")->fetchColumn();`)).toBe('active/user/1');
    // no password works until they choose one
    for (const pw of ['', PW, 'password123']) {
      expect((await call('guess', '/api/login.php', { email: 'new.person@example.com', password: pw })).status).not.toBe(200);
    }
  });

  it('the invited person sets a password through the forgotten-password code, then signs in', async () => {
    sql(`$p->exec("DELETE FROM login_failures");`);
    await call('new', '/api/reset_request.php', { email: 'new.person@example.com' });
    const code = /code is (\d{6})/.exec(lastTo('new.person@example.com').body)![1];
    expect((await call('new', '/api/reset_confirm.php', { email: 'new.person@example.com', code, password: 'my own password 9' })).status).toBe(200);
    jars.new2 = '';
    expect((await call('new2', '/api/login.php', { email: 'new.person@example.com', password: 'my own password 9' })).status).toBe(200);
  });

  it('inviting an address with an account is refused; bad addresses too; the log records invitations', async () => {
    expect(await call(ADMIN, '/api/admin_invite.php', { email: USER })).toMatchObject({ status: 409, body: { error: 'exists' } });
    expect((await call(ADMIN, '/api/admin_invite.php', { email: 'not an address' })).status).toBe(400);
    const log = (await call(ADMIN, '/api/admin_log.php')).body.log;
    expect(log[0]).toMatchObject({ admin: ADMIN, action: 'invite', target: 'new.person@example.com' });
  });

  // ---- usage ----

  it('each reading is counted for its day and model; unknown models count as other', async () => {
    await read(USER, 'sonnet-medium');
    await read(USER, 'sonnet-medium');
    await read(USER, 'opus-medium');
    await read(USER);                 // no preset sent
    await read(USER, 'gpt-9');        // not a preset this app knows
    const rows = sql(`foreach($p->query("SELECT preset, n FROM ask_daily ORDER BY preset") as $r) echo $r['preset'], '=', $r['n'], ' ';`);
    expect(rows.trim()).toBe('opus-medium=1 other=2 sonnet-medium=2');
  });

  it('the usage report: per account (24 h, 7 and 30 days, by model, saved data), per day, and accounts by state', async () => {
    // older days: 3 readings 10 days ago, 4 readings 40 days ago (outside the 30)
    const id = sql(`echo $p->query("SELECT id FROM users WHERE email='${USER}'")->fetchColumn();`);
    const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    sql(`$p->exec("INSERT INTO ask_daily (user_id, day, preset, n) VALUES ('${id}', '${ago(10)}', 'sonnet-high', 3), ('${id}', '${ago(40)}', 'sonnet-high', 4)");`);
    const r = await call(ADMIN, '/api/admin_usage.php');
    expect(r.status).toBe(200);
    const u = r.body.users.find((x: { email: string }) => x.email === USER);
    expect(u).toMatchObject({ ask24: 5, ask7: 5, ask30: 8, readings: 0, charts: 0 });
    expect(u.models).toEqual({ 'sonnet-medium': 2, 'opus-medium': 1, other: 2, 'sonnet-high': 3 });
    expect(r.body.days).toContainEqual({ day: ago(10), preset: 'sonnet-high', n: 3 });
    expect(r.body.days.find((x: { day: string }) => x.day === ago(40))).toBeUndefined();
    expect(r.body.states).toMatchObject({ active: 3 });
    expect(r.body.limit).toBe(20);
    expect((await call(USER, '/api/admin_usage.php')).status).toBe(403);
  });

  it('daily counts older than 13 months are tidied away', async () => {
    const id = sql(`echo $p->query("SELECT id FROM users WHERE email='${USER}'")->fetchColumn();`);
    sql(`$p->exec("INSERT INTO ask_daily (user_id, day, preset, n) VALUES ('${id}', '2020-01-01', 'sonnet-medium', 9)");`);
    await fetch(`${BASE}/api/me.php`);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM ask_daily WHERE day = '2020-01-01'")->fetchColumn();`)).toBe('0');
  });
});
