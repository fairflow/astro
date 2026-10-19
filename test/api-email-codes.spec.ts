// Email codes and "forgot password" (astro-tbb.8): a real `php -S` over
// SQLite; under the built-in server mail is written to mail.log beside the
// config, so the tests read the codes from there. Skipped without PHP.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = 8490 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = 'reset@example.com';
const OLD_PW = 'old password 123';
const NEW_PW = 'new password 456';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
let jar = '';

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const mails = (): { to: string; subject: string; body: string }[] => {
  const f = join(dir, 'mail.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
};
const lastCode = () => /code is (\d{6})/.exec(mails().at(-1)?.body ?? '')?.[1] ?? '';

async function post(path: string, json: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-astro': '1' };
  if (jar) headers.cookie = jar;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) jar = set.split(';')[0]!;
  return { status: res.status, body: await res.json(), setCookie: set };
}
/** Forget recent sends, so a test group starts with a fresh 15-minute allowance. */
const clearSends = () => spawnSync('php', ['-r',
  `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');$p->exec("DELETE FROM login_failures WHERE k LIKE 'send:%'");`]);
const me = async () => (await (await fetch(`${BASE}/api/me.php`, { headers: jar ? { cookie: jar } : {} })).json()).user;

describe.skipIf(!hasPhp)('API email codes and password reset (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-mail-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 003_email_codes.sql');
    expect(cli(['api/cli/user.php', 'add', EMAIL], `${OLD_PW}\n`).stdout).toContain('Created');
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); return; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    throw new Error('php -S did not start');
  });
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('asking for a code gives the same answer for an account and for an unknown address', async () => {
    const a = await post('/api/reset_request.php', { email: EMAIL });
    const b = await post('/api/reset_request.php', { email: 'nobody@example.com' });
    expect(a.status).toBe(200);
    expect(b).toEqual({ ...a, setCookie: b.setCookie });
    // only the real account got mail, and the dev server logged it instead of sending
    expect(mails().map(m => m.to)).toEqual([EMAIL]);
  });

  it('the message carries a 6-digit code, in the subject too, and says how long it lasts', () => {
    const m = mails().at(-1)!;
    expect(m.subject).toMatch(/^\d{6} is your Astrodynamics code$/);
    expect(m.body).toContain('valid for 10 minutes and works once');
    expect(m.body).toContain(`code is ${m.subject.slice(0, 6)}`);
  });

  it('a wrong code is refused, and the code stops working after 5 wrong tries', async () => {
    const good = lastCode();
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      expect(await post('/api/reset_confirm.php', { email: EMAIL, code: wrong, password: NEW_PW }))
        .toMatchObject({ status: 400, body: { error: 'code' } });
    }
    // even the right code no longer works
    expect((await post('/api/reset_confirm.php', { email: EMAIL, code: good, password: NEW_PW })).status).toBe(400);
  });

  it('a new code replaces the old one; the right code sets the password, signs in and ends other sessions', async () => {
    // an existing session elsewhere
    jar = '';
    await post('/api/login.php', { email: EMAIL, password: OLD_PW });
    const elsewhere = jar;
    expect(await me()).toMatchObject({ email: EMAIL });

    jar = '';
    await post('/api/reset_request.php', { email: EMAIL });
    const first = lastCode();
    await post('/api/reset_request.php', { email: EMAIL });
    const second = lastCode();
    if (first !== second) {
      expect((await post('/api/reset_confirm.php', { email: EMAIL, code: first, password: NEW_PW })).status).toBe(400);
    }
    const r = await post('/api/reset_confirm.php', { email: EMAIL, code: ` ${second.slice(0, 3)} ${second.slice(3)} `, password: NEW_PW });
    expect(r).toMatchObject({ status: 200, body: { user: { email: EMAIL } } });
    expect(await me()).toMatchObject({ email: EMAIL });

    // the code works once
    expect((await post('/api/reset_confirm.php', { email: EMAIL, code: second, password: NEW_PW })).status).toBe(400);
    // the other session ended; the old password is gone, the new one works
    const mine = jar;
    jar = elsewhere;
    expect(await me()).toBeNull();
    jar = '';
    expect((await post('/api/login.php', { email: EMAIL, password: OLD_PW })).status).toBe(401);
    expect((await post('/api/login.php', { email: EMAIL, password: NEW_PW })).status).toBe(200);
    jar = mine;
  });

  it('a weak new password is refused before the code is spent', async () => {
    jar = ''; clearSends();
    await post('/api/reset_request.php', { email: EMAIL });
    const code = lastCode();
    expect(await post('/api/reset_confirm.php', { email: EMAIL, code, password: 'short' }))
      .toMatchObject({ status: 400, body: { error: 'password' } });
    expect((await post('/api/reset_confirm.php', { email: EMAIL, code, password: NEW_PW + '!' })).status).toBe(200);
  });

  it('an expired code is refused', async () => {
    clearSends();
    await post('/api/reset_request.php', { email: EMAIL });
    const code = lastCode();
    spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');$p->exec("UPDATE email_codes SET expires_at=strftime('%s','now')-1");`]);
    expect((await post('/api/reset_confirm.php', { email: EMAIL, code, password: NEW_PW })).status).toBe(400);
  });

  it('frozen accounts get no code; sends are limited to 3 per 15 minutes per address', async () => {
    const n = mails().length;
    cli(['api/cli/user.php', 'state', EMAIL, 'frozen']);
    await post('/api/reset_request.php', { email: EMAIL });
    expect(mails().length).toBe(n);
    cli(['api/cli/user.php', 'state', EMAIL, 'active']);
    clearSends();
    const before = mails().length;
    for (let i = 0; i < 5; i++) await post('/api/reset_request.php', { email: EMAIL });
    expect(mails().length - before).toBe(3);
    expect((await post('/api/reset_request.php', { email: EMAIL })).status).toBe(200); // still the same answer
  });

  it('after 20 wrong codes in a day for an address, even the right code is refused', async () => {
    clearSends();
    spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');`
      + `for($i=0;$i<20;$i++)$p->exec("INSERT INTO login_failures (k, at) VALUES ('wrongcode:reset:" . hash('sha256','${EMAIL}') . "', strftime('%s','now'))");`]);
    await post('/api/reset_request.php', { email: EMAIL });
    expect((await post('/api/reset_confirm.php', { email: EMAIL, code: lastCode(), password: NEW_PW + '#' })).status).toBe(400);
    spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');$p->exec("DELETE FROM login_failures WHERE k LIKE 'wrongcode:%'");`]);
  });

  it('only a hash of each code is stored', () => {
    const code = lastCode();
    const php = `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');echo $p->query("SELECT COUNT(*) FROM email_codes WHERE code_hash LIKE '%${code}%'")->fetchColumn();`;
    expect(spawnSync('php', ['-r', php], { encoding: 'utf8' }).stdout).toBe('0');
  });

  it('the mail test command refuses a bad address', () => {
    expect(cli(['api/cli/mail_test.php', 'not-an-address']).stderr).toContain('Usage');
  });
});
