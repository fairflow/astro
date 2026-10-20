// Readings synced to the account (astro-cbi): api/readings.php under a real
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
const A = 'reader-a@example.com';
const B = 'reader-b@example.com';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
const jars: Record<string, string> = {};

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const sql = (q: string) => spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');${q}`], { encoding: 'utf8' }).stdout;

async function call(who: string, path: string, json?: unknown, headers: Record<string, string> = { 'x-astro': '1' }) {
  const h: Record<string, string> = { ...headers };
  if (json !== undefined) h['content-type'] = 'application/json';
  if (jars[who]) h.cookie = jars[who]!;
  const res = await fetch(BASE + path, json === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) jars[who] = set.split(';')[0]!;
  return { status: res.status, body: await res.json() };
}
const pull = (who: string, since = 0) => call(who, `/api/readings.php?since=${since}`);
const push = (who: string, body: unknown) => call(who, '/api/readings.php', body);

const reading = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(), key: 'natal|Ann@1990-01-01', group: 'natal|Ann@1990-01-01', tab: 'natal',
  title: 'Natal · Ann', question: 'Core personality sketch', preset: 'sonnet-medium', anonymised: true,
  text: 'Ann is a **Capricorn** sun…', stopped: false, createdAt: Date.now(), ...over,
});

describe.skipIf(!hasPhp)('API readings sync (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-read-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n[passwords]\npwned_check = off\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 005_readings.sql');
    for (const e of [A, B]) cli(['api/cli/user.php', 'add', e], `${PW}\n`);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    for (const e of [A, B]) expect((await call(e, '/api/login.php', { email: e, password: PW })).status).toBe(200);
  }, 30_000); // setup runs migrations, bcrypt and php -S: more room than the 10 s default
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('needs a signed-in account, and the X-Astro header to write', async () => {
    expect((await call('nobody', '/api/readings.php?since=0')).status).toBe(401);
    expect((await call(A, '/api/readings.php', { readings: [reading()] }, {})).status).toBe(403);
  });

  it('saves readings and gives them back; another account sees none of them', async () => {
    const r = reading();
    const s = await push(A, { readings: [r] });
    expect(s).toMatchObject({ status: 200, body: { saved: [r.id], refused: [] } });
    const p = await pull(A);
    expect(p.body.readings).toEqual([{ ...r, interrupted: false }]);
    expect(p.body.more).toBe(false);
    expect((await pull(B)).body.readings).toEqual([]);
    // B cannot write over A's reading by reusing its id: it becomes B's own
    await push(B, { readings: [{ ...r, text: 'B wrote this' }] });
    expect((await pull(A)).body.readings[0].text).toBe(r.text);
  });

  it('a later pull from the cursor brings only what changed since (plus a short overlap)', async () => {
    const first = await pull(A);
    const r2 = reading({ text: 'second' });
    await push(A, { readings: [r2] });
    const next = await pull(A, first.body.cursor);
    expect(next.body.readings.map((x: { id: string }) => x.id)).toContain(r2.id);
    // well past the overlap, nothing is repeated
    sql(`$p->exec("UPDATE readings SET rev = rev - 60000000");`);
    const later = await pull(A, (await pull(A)).body.cursor);
    expect(later.body.readings).toEqual([]);
  });

  it('a reading saved mid-stream is updated when it finishes; pushing it unchanged changes nothing', async () => {
    const r = reading({ text: 'partial', interrupted: true, stopped: true });
    await push(A, { readings: [r] });
    const rev = sql(`echo $p->query("SELECT rev FROM readings WHERE id='${r.id}'")->fetchColumn();`);
    await push(A, { readings: [r] });
    expect(sql(`echo $p->query("SELECT rev FROM readings WHERE id='${r.id}'")->fetchColumn();`)).toBe(rev);
    await push(A, { readings: [{ ...r, text: 'partial and the rest', interrupted: false, stopped: false }] });
    const got = (await pull(A)).body.readings.find((x: { id: string }) => x.id === r.id);
    expect(got).toMatchObject({ text: 'partial and the rest', interrupted: false, stopped: false });
  });

  it('deleting clears the content on the server, reaches other devices, and cannot be undone by a stale device', async () => {
    const r = reading({ text: 'private words' });
    await push(A, { readings: [r] });
    const cursor = (await pull(A)).body.cursor;
    expect((await push(A, { deleted: [r.id] })).status).toBe(200);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM readings WHERE body LIKE '%private words%'")->fetchColumn();`)).toBe('0');
    expect((await pull(A, cursor - 10_000_000)).body.readings).toContainEqual({ id: r.id, deleted: true });
    // a device that had not heard pushes it again: it stays deleted
    expect((await push(A, { readings: [r] })).body.refused).toEqual([{ id: r.id, reason: 'deleted' }]);
    expect((await pull(A)).body.readings).toContainEqual({ id: r.id, deleted: true });
  });

  it('bad readings are refused one by one, the rest are saved', async () => {
    const good = reading();
    const s = await push(A, { readings: [
      good, reading({ id: 'not-a-uuid' }), reading({ tab: 'weather' }), reading({ text: '  ' }),
      reading({ text: 'x'.repeat(200 * 1024 + 1) }), 'nonsense',
    ] });
    expect(s.body.saved).toEqual([good.id]);
    expect(s.body.refused.map((x: { reason: string }) => x.reason))
      .toEqual(['bad id', 'bad tab', 'empty text', 'text missing or too long', 'not an object']);
  });

  it('a paused account can read and delete but not save', async () => {
    cli(['api/cli/user.php', 'state', B, 'paused']);
    expect((await pull(B)).status).toBe(200);
    expect(await push(B, { readings: [reading()] })).toMatchObject({ status: 403, body: { error: 'paused' } });
    const own = (await pull(B)).body.readings[0].id;
    expect((await push(B, { deleted: [own] })).status).toBe(200);
    cli(['api/cli/user.php', 'state', B, 'active']);
  });

  it('pulls page through many readings', async () => {
    const many = Array.from({ length: 450 }, (_, i) => reading({ text: `reading ${i}` }));
    for (let i = 0; i < many.length; i += 150) await push(B, { readings: many.slice(i, i + 150) });
    let since = 0; let seen = 0; let calls = 0;
    for (;;) {
      const p = await pull(B, since);
      seen += p.body.readings.filter((x: { deleted?: boolean }) => !x.deleted).length;
      since = p.body.cursor; calls++;
      if (!p.body.more) break;
    }
    expect(seen).toBe(450); // B's earlier reading was deleted in the paused test (a tombstone now)
    expect(calls).toBe(3);  // 451 rows, 200 per page
  });

  it('an account holds at most 1000 readings', async () => {
    sql(`$s=$p->prepare("INSERT INTO readings (user_id, id, body, created_at, rev) SELECT id, ?, 'x', 1, 1 FROM users WHERE email='${B}'");`
      + `for($i=0;$i<600;$i++)$s->execute([sprintf('00000000-0000-4000-8000-%012d',$i)]);`);
    expect((await push(B, { readings: [reading()] })).body.refused).toEqual([expect.objectContaining({ reason: 'full' })]);
  });

  it('removing the account removes its readings', async () => {
    cli(['api/cli/user.php', 'remove', B]);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM readings r LEFT JOIN users u ON u.id = r.user_id WHERE u.id IS NULL")->fetchColumn();`)).toBe('0');
  });
});
