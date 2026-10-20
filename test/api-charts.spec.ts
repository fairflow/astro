// Saved charts synced to the account (astro-ag1): api/charts.php under a real
// `php -S` over SQLite. Skipped without PHP.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freePort } from './freeport.js';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'a long password 1';
const A = 'charts-a@example.com';
const B = 'charts-b@example.com';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
const jars: Record<string, string> = {};

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const sql = (q: string) => spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');${q}`], { encoding: 'utf8' }).stdout;

async function call(who: string, path: string, json?: unknown) {
  const h: Record<string, string> = { 'x-astro': '1' };
  if (json !== undefined) h['content-type'] = 'application/json';
  if (jars[who]) h.cookie = jars[who]!;
  const res = await fetch(BASE + path, json === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) jars[who] = set.split(';')[0]!;
  return { status: res.status, body: await res.json() };
}
const pull = (who: string, since = 0) => call(who, `/api/charts.php?since=${since}`);
const push = (who: string, body: unknown) => call(who, '/api/charts.php', body);

const data = (over: Record<string, unknown> = {}) => ({
  name: 'Ann', date: '1990-01-01', time: '08:30', accuracy: 'exact',
  place: { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278, zone: 'Europe/London' }, set: 'Family', ...over,
});
const chart = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(), data: data(), createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, ...over,
});

describe.skipIf(!hasPhp)('API charts sync (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-charts-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n[passwords]\npwned_check = off\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 006_charts.sql');
    for (const e of [A, B]) cli(['api/cli/user.php', 'add', e], `${PW}\n`);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    for (const e of [A, B]) expect((await call(e, '/api/login.php', { email: e, password: PW })).status).toBe(200);
  }, 30_000); // setup runs migrations, bcrypt and php -S: more room than the 10 s default
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('needs a signed-in account', async () => {
    expect((await call('nobody', '/api/charts.php?since=0')).status).toBe(401);
  });

  it('saves birth data only (unknown fields dropped) and gives it back; other accounts see nothing', async () => {
    const c = chart({ data: { ...data(), positions: [1, 2, 3], notes: 'twin' } });
    expect((await push(A, { charts: [c] })).body).toMatchObject({ saved: [c.id], refused: [] });
    const got = (await pull(A)).body.charts;
    expect(got).toEqual([{ id: c.id, data: { ...data(), notes: 'twin' }, createdAt: c.createdAt, updatedAt: c.updatedAt }]);
    expect((await pull(B)).body.charts).toEqual([]);
  });

  it('the later edit wins; an older one is refused', async () => {
    const c = chart();
    await push(A, { charts: [c] });
    const newer = { ...c, data: data({ name: 'Ann B.' }), updatedAt: c.updatedAt + 1000 };
    expect((await push(A, { charts: [newer] })).body.saved).toEqual([c.id]);
    const stale = { ...c, data: data({ name: 'Ann stale' }), updatedAt: c.updatedAt + 500 };
    expect((await push(A, { charts: [stale] })).body.refused).toEqual([{ id: c.id, reason: 'older' }]);
    const row = (await pull(A)).body.charts.find((x: { id: string }) => x.id === c.id);
    expect(row.data.name).toBe('Ann B.');
  });

  it('deleting clears the birth data and cannot be undone by a stale device', async () => {
    const c = chart({ data: data({ name: 'Secret Person' }) });
    await push(A, { charts: [c] });
    await push(A, { deleted: [c.id] });
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM charts WHERE data LIKE '%Secret Person%'")->fetchColumn();`)).toBe('0');
    expect((await pull(A)).body.charts).toContainEqual({ id: c.id, deleted: true });
    expect((await push(A, { charts: [{ ...c, updatedAt: c.updatedAt + 99999 }] })).body.refused).toEqual([{ id: c.id, reason: 'deleted' }]);
  });

  it('refuses malformed charts one by one', async () => {
    const good = chart();
    const r = await push(A, { charts: [
      good, chart({ id: 'nope' }), chart({ data: data({ date: '1/1/1990' }) }), chart({ data: data({ accuracy: 'roughly' }) }),
      chart({ data: data({ place: { name: 'X', country: 'Y', lat: 95, lon: 0, zone: 'UTC' } }) }), chart({ updatedAt: 'soon' }),
    ] });
    expect(r.body.saved).toEqual([good.id]);
    expect(r.body.refused.map((x: { reason: string }) => x.reason)).toEqual(['bad id', 'bad date', 'bad accuracy', 'bad place', 'bad updatedAt']);
  });

  it('paused accounts may pull and delete but not save; export includes charts; removal takes them', async () => {
    const c = chart();
    await push(B, { charts: [c] });
    cli(['api/cli/user.php', 'state', B, 'paused']);
    expect((await push(B, { charts: [chart()] })).status).toBe(403);
    expect((await pull(B)).status).toBe(200);
    const x = await call(B, '/api/account_export.php');
    expect(x.body.charts).toEqual([expect.objectContaining({ name: 'Ann', set: 'Family', created: '2023-11-14T22:13:20+00:00' })]);
    expect((await push(B, { deleted: [c.id] })).status).toBe(200);
    cli(['api/cli/user.php', 'remove', B]);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM charts c LEFT JOIN users u ON u.id = c.user_id WHERE u.id IS NULL")->fetchColumn();`)).toBe('0');
  });
});
