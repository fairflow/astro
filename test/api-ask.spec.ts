// Ask Claude passes and the daily limit (astro-tbb.7, astro-bk6): ask_pass.php
// and ask_consume.php under a real `php -S` over SQLite. Skipped without PHP.
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
const U = 'asker@example.com';
const ADMIN = 'boss@example.com';
const LIMIT = 3;

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
const jars: Record<string, string> = {};

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const sql = (q: string) => spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');${q}`], { encoding: 'utf8' }).stdout;

async function call(who: string, path: string, json?: unknown, headers: Record<string, string> = { 'x-astro': '1' }) {
  const h: Record<string, string> = { ...headers, 'content-type': 'application/json' };
  if (jars[who]) h.cookie = jars[who]!;
  const res = await fetch(BASE + path, { method: 'POST', headers: h, body: JSON.stringify(json ?? {}) });
  const set = res.headers.get('set-cookie');
  if (set) jars[who] = set.split(';')[0]!;
  return { status: res.status, body: await res.json() };
}
const getPass = (who: string) => call(who, '/api/ask_pass.php');
/** The Worker's call: no cookie, no X-Astro header. */
const consume = (pass: string) => call('worker', '/api/ask_consume.php', { pass }, {});

describe.skipIf(!hasPhp)('API Ask Claude passes (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-ask-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n`
      + `[passwords]\npwned_check = off\n[askclaude]\ndaily_limit = ${LIMIT}\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 007_ask_passes.sql');
    for (const e of [U, ADMIN]) cli(['api/cli/user.php', 'add', e], `${PW}\n`);
    cli(['api/cli/user.php', 'admin', ADMIN]);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    expect((await call(U, '/api/login.php', { email: U, password: PW })).status).toBe(200);
    await call(ADMIN, '/api/login.php', { email: ADMIN, password: PW });
    const mail = readFileSync(join(dir, 'mail.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).at(-1);
    await call(ADMIN, '/api/login.php', { email: ADMIN, password: PW, code: /code is (\d{6})/.exec(mail.body)![1] });
  }, 30_000);
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('a pass needs a signed-in account and the same-site header', async () => {
    jars.nobody = '';
    expect((await getPass('nobody')).status).toBe(401);
    expect((await call(U, '/api/ask_pass.php', {}, {})).status).toBe(403);
  });

  it('a pass is used once; unknown and malformed passes are refused; only a hash is stored', async () => {
    const p = await getPass(U);
    expect(p).toMatchObject({ status: 200, body: { remaining: LIMIT - 1 } });
    const pass = p.body.pass as string;
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM ask_passes WHERE id_hash = '${pass}'")->fetchColumn();`)).toBe('0');
    expect(await consume(pass)).toMatchObject({ status: 200, body: { ok: true } });
    expect((await consume(pass)).status).toBe(403);
    expect((await consume('x'.repeat(43))).status).toBe(403);
    expect((await consume('short')).status).toBe(403);
  });

  it('an expired pass is refused', async () => {
    const pass = (await getPass(U)).body.pass;
    sql(`$p->exec("UPDATE ask_passes SET expires_at = strftime('%s','now') - 1 WHERE used_at IS NULL");`);
    expect((await consume(pass)).status).toBe(403);
  });

  it('the daily limit counts used passes and ones still open, and says when the next is available', async () => {
    // 1 used so far; 2 more passes reach the limit of 3 (used + open)
    const a = (await getPass(U)).body.pass;
    const b = (await getPass(U)).body;
    expect(b.remaining).toBe(0);
    const refused = await getPass(U);
    expect(refused).toMatchObject({ status: 429, body: { error: 'limit' } });
    expect(refused.body.message).toMatch(/used your 3 Ask Claude readings.*available at \d\d:\d\d UTC/);
    expect((await consume(a)).status).toBe(200);
    expect((await consume(b.pass)).status).toBe(200);
    expect((await getPass(U)).status).toBe(429);
    // 24 hours later the oldest use leaves the window
    sql(`$p->exec("UPDATE ask_passes SET used_at = used_at - 86401, created_at = created_at - 86401 WHERE used_at = (SELECT MIN(used_at) FROM ask_passes)");`);
    expect((await getPass(U)).status).toBe(200);
  });

  it('admins have no limit', async () => {
    for (let i = 0; i < LIMIT + 2; i++) {
      const p = await getPass(ADMIN);
      expect(p).toMatchObject({ status: 200, body: { remaining: null } });
      expect((await consume(p.body.pass)).status).toBe(200);
    }
  });

  it('paused accounts get no pass, and a pass dies with the account\'s right to use it', async () => {
    sql(`$p->exec("DELETE FROM ask_passes WHERE user_id = (SELECT id FROM users WHERE email='${U}')");`);
    const pass = (await getPass(U)).body.pass;
    cli(['api/cli/user.php', 'state', U, 'paused']);
    expect(await getPass(U)).toMatchObject({ status: 403, body: { error: 'paused' } });
    expect((await consume(pass)).status).toBe(403);
    cli(['api/cli/user.php', 'state', U, 'active']);
  });

  it('old passes are tidied by housekeeping', async () => {
    sql(`$p->exec("UPDATE ask_passes SET created_at = created_at - 3*86400");`);
    await fetch(`${BASE}/api/me.php`);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM ask_passes")->fetchColumn();`)).toBe('0');
    expect(existsSync(join(dir, 'test.sqlite'))).toBe(true);
  });
});
