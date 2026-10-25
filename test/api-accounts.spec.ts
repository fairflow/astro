// Two-step sign-in (astro-tbb.10), registration with approval (astro-tbb.3) and
// the admin panel's API (astro-tbb.4): a real `php -S` over SQLite, with mail
// written to mail.log beside the config (codes are read from there). The
// breach-list check is off here (no network in tests); its parser is tested
// directly. Skipped without PHP.
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
const ADMIN = 'boss@example.com';
const USER = 'two@example.com';
const NEWBIE = 'newbie@example.com';
const PW = 'a long password 1';

let dir = '';
let server: ChildProcess | undefined;
let env: NodeJS.ProcessEnv = {};
let jar = '';

const cli = (args: string[], input = '') => spawnSync('php', args, { cwd: root, env, input, encoding: 'utf8' });
const sql = (q: string) => spawnSync('php', ['-r', `$p=new PDO('sqlite:${join(dir, 'test.sqlite')}');${q}`], { encoding: 'utf8' }).stdout;
const mails = (): { to: string; subject: string; body: string }[] => {
  const f = join(dir, 'mail.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
};
const lastMailTo = (to: string) => mails().filter(m => m.to === to).at(-1);
const codeFor = (to: string) => /code is (\d{6})/.exec(lastMailTo(to)?.body ?? '')?.[1] ?? '';
/** Forget recent sends and registrations, so a test starts with a fresh 15-minute allowance. */
const clearLimits = () => sql(`$p->exec("DELETE FROM login_failures");`);

async function call(path: string, json?: unknown, headers: Record<string, string> = { 'x-astro': '1' }) {
  const h: Record<string, string> = { ...headers };
  if (json !== undefined) h['content-type'] = 'application/json';
  if (jar) h.cookie = jar;
  const res = await fetch(BASE + path, json === undefined ? { headers: h } : { method: 'POST', headers: h, body: JSON.stringify(json) });
  const set = res.headers.get('set-cookie');
  if (set) { const pair = set.split(';')[0]!; jar = pair.endsWith('=') ? '' : pair; }
  return { status: res.status, body: await res.json(), setCookie: set };
}
const me = async () => (await call('/api/me.php')).body.user;

/** Sign in fully, through the code step when the account has one. */
async function signInAs(email: string, password = PW) {
  jar = '';
  const first = await call('/api/login.php', { email, password });
  if (first.body.step !== 'code') return first;
  return call('/api/login.php', { email, password, code: codeFor(email) });
}

describe.skipIf(!hasPhp)('API two-step sign-in, registration and admin (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-acct-'));
    writeFileSync(join(dir, 'db.ini'), `[db]\ndriver = sqlite\npath = "${join(dir, 'test.sqlite')}"\n[passwords]\npwned_check = off\n`);
    env = { ...process.env, ASTRO_DB_INI: join(dir, 'db.ini') };
    expect(cli(['api/cli/migrate.php']).stdout).toContain('applied 004_two_step_admin.sql');
    for (const e of [ADMIN, USER]) expect(cli(['api/cli/user.php', 'add', e], `${PW}\n`).stdout).toContain('Created');
    cli(['api/cli/user.php', 'admin', ADMIN]);
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', root, 'tools/api-dev-router.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); return; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    throw new Error('php -S did not start');
  }, 30_000); // setup runs migrations, bcrypt and php -S: more room than the 10 s default
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  // ---- two-step sign-in (astro-tbb.10) ----

  it('a user without two-step signs in with the password alone; the session is not "verified"', async () => {
    const r = await signInAs(USER);
    expect(r).toMatchObject({ status: 200, body: { user: { email: USER, twoStep: false, verified: false } } });
  });

  it('a user can turn two-step on; turning it off needs a session that passed the code step', async () => {
    expect((await call('/api/two_step.php', { on: true })).body.user).toMatchObject({ twoStep: true });
    expect(await me()).toMatchObject({ twoStep: true });
    expect(await call('/api/two_step.php', { on: false })).toMatchObject({ status: 403, body: { error: 'second step' } });
    expect((await call('/api/two_step.php', { on: 'no' })).status).toBe(400);
    expect((await call('/api/two_step.php', { on: true }, {})).status).toBe(403); // no X-Astro header
  });

  it('with two-step on, a correct password gets a code by email and no session', async () => {
    jar = ''; clearLimits();
    const n = mails().length;
    const r = await call('/api/login.php', { email: USER, password: PW });
    expect(r).toMatchObject({ status: 200, body: { step: 'code' } });
    expect(r.setCookie).toBeNull();
    expect(await me()).toBeNull();
    expect(mails().length).toBe(n + 1);
    expect(lastMailTo(USER)!.body).toContain('to finish signing in');
    // a wrong password sends nothing and says nothing about two-step
    expect(await call('/api/login.php', { email: USER, password: 'wrong password' })).toMatchObject({ status: 401 });
    expect(mails().length).toBe(n + 1);
  });

  it('a wrong code is refused without a session; the right one signs in, verified, and works once', async () => {
    const code = codeFor(USER);
    const wrong = code === '000000' ? '111111' : '000000';
    expect(await call('/api/login.php', { email: USER, password: PW, code: wrong })).toMatchObject({ status: 400, body: { error: 'code' } });
    expect(await me()).toBeNull();
    // the code is useless without the password
    expect((await call('/api/login.php', { email: USER, password: 'wrong password', code })).status).toBe(401);
    const r = await call('/api/login.php', { email: USER, password: PW, code });
    expect(r).toMatchObject({ status: 200, body: { user: { email: USER, twoStep: true, verified: true } } });
    expect(await me()).toMatchObject({ verified: true });
    jar = '';
    expect((await call('/api/login.php', { email: USER, password: PW, code })).status).toBe(400);
  });

  it('from a verified session two-step can be turned off; then the password alone signs in', async () => {
    expect((await signInAs(USER)).body.user).toMatchObject({ verified: true });
    expect((await call('/api/two_step.php', { on: false })).body.user).toMatchObject({ twoStep: false });
    jar = '';
    expect((await call('/api/login.php', { email: USER, password: PW })).body.user).toMatchObject({ twoStep: false });
  });

  it('a new admin has two-step on, and with it on needs a verified session for admin pages', async () => {
    clearLimits();
    expect((await call('/api/login.php', { email: ADMIN, password: PW })).body).toMatchObject({ step: 'code' });
    expect((await signInAs(ADMIN)).body.user).toMatchObject({ role: 'admin', twoStep: true, verified: true });
    expect((await call('/api/admin_users.php')).status).toBe(200);
    // a session made before two-step existed (no second step) is still signed in, but not for admin pages
    sql(`$p->exec("UPDATE sessions SET second_step_at = NULL");`);
    expect(await me()).toMatchObject({ role: 'admin', verified: false });
    expect(await call('/api/admin_users.php')).toMatchObject({ status: 403, body: { error: 'second step' } });
  });

  it('an admin may turn two-step off (2026-10-25): then the password alone signs in and opens admin pages', async () => {
    jar = ''; clearLimits();
    await signInAs(ADMIN);                                                         // with the code: verified
    expect((await call('/api/two_step.php', { on: false })).body.user).toMatchObject({ role: 'admin', twoStep: false });
    jar = '';
    const r = await call('/api/login.php', { email: ADMIN, password: PW });
    expect(r).toMatchObject({ status: 200, body: { user: { role: 'admin', twoStep: false, verified: false } } });
    expect((await call('/api/admin_users.php')).status).toBe(200);
    // turning it back on needs no code; the next sign-in asks for one again
    expect((await call('/api/two_step.php', { on: true })).body.user).toMatchObject({ twoStep: true });
    expect(await call('/api/admin_users.php')).toMatchObject({ status: 403, body: { error: 'second step' } });
    jar = ''; clearLimits();
    expect((await call('/api/login.php', { email: ADMIN, password: PW })).body).toMatchObject({ step: 'code' });
  });

  it('a password reset by emailed code counts as the second step', async () => {
    jar = ''; clearLimits();
    await call('/api/reset_request.php', { email: ADMIN });
    const r = await call('/api/reset_confirm.php', { email: ADMIN, code: codeFor(ADMIN), password: PW });
    expect(r.body.user).toMatchObject({ role: 'admin', verified: true });
    expect((await call('/api/admin_users.php')).status).toBe(200);
  });

  // ---- registration (astro-tbb.3) ----

  it('registering checks the address and the password', async () => {
    jar = ''; clearLimits();
    expect(await call('/api/register.php', { email: 'not an address', password: PW })).toMatchObject({ status: 400, body: { error: 'email' } });
    expect(await call('/api/register.php', { email: NEWBIE, password: 'short' })).toMatchObject({ status: 400, body: { error: 'password' } });
  });

  it('a new address gets a code; the account is pending and unconfirmed, and cannot sign in', async () => {
    const r = await call('/api/register.php', { email: NEWBIE, password: PW });
    expect(r).toMatchObject({ status: 200, body: { step: 'code' } });
    expect(r.setCookie).toBeNull();
    expect(lastMailTo(NEWBIE)!.body).toContain('to confirm your email address');
    expect(sql(`echo $p->query("SELECT status || '/' || email_confirmed FROM users WHERE email='${NEWBIE}'")->fetchColumn();`)).toBe('pending/0');
    const s = await call('/api/login.php', { email: NEWBIE, password: PW });
    expect(s).toMatchObject({ status: 403, body: { error: 'pending' } });
    expect(s.body.message).toContain('not been confirmed');
  });

  it('registering again before confirming sends a new code; the old one stops working', async () => {
    const old = codeFor(NEWBIE);
    await call('/api/register.php', { email: NEWBIE, password: PW + '2' });
    const fresh = codeFor(NEWBIE);
    if (old !== fresh) expect((await call('/api/register_confirm.php', { email: NEWBIE, password: PW + '2', code: old })).status).toBe(400);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM users WHERE email='${NEWBIE}'")->fetchColumn();`)).toBe('1');
  });

  it('confirming needs the password registered last, and a wrong one does not use up the code', async () => {
    // e.g. someone else re-registered the unconfirmed address with their own password
    for (let i = 0; i < 6; i++) {
      expect(await call('/api/register_confirm.php', { email: NEWBIE, password: PW, code: codeFor(NEWBIE) }))
        .toMatchObject({ status: 400, body: { error: 'code' } });
    }
  });

  it('the right code confirms the address, tells the admins, and the account waits for approval', async () => {
    const r = await call('/api/register_confirm.php', { email: NEWBIE, password: PW + '2', code: codeFor(NEWBIE) });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    expect(r.body.message).toContain('waits for approval');
    expect(lastMailTo(ADMIN)!).toMatchObject({ subject: 'Astrodynamics: a registration awaits approval' });
    expect(lastMailTo(ADMIN)!.body).toContain(NEWBIE);
    // the latest password is the one that counts
    const s = await call('/api/login.php', { email: NEWBIE, password: PW + '2' });
    expect(s).toMatchObject({ status: 403, body: { error: 'pending' } });
    expect(s.body.message).toContain('waiting for approval');
  });

  it('registering an address that has an account gives the same answer, sends a notice, and changes nothing', async () => {
    const a = await call('/api/register.php', { email: 'someone-new@example.com', password: PW });
    const b = await call('/api/register.php', { email: USER, password: 'another password 9' });
    expect(b.status).toBe(a.status);
    expect(Object.keys(b.body)).toEqual(Object.keys(a.body));
    expect(b.body.message.replace(USER, 'X')).toBe(a.body.message.replace('someone-new@example.com', 'X'));
    expect(lastMailTo(USER)!).toMatchObject({ subject: 'Your Astrodynamics account' });
    expect(lastMailTo(USER)!.body).toContain('already has an account');
    expect((await signInAs(USER)).status).toBe(200); // the old password still works
    jar = '';
  });

  it('registrations are limited per IP (5 per 15 minutes)', async () => {
    clearLimits();
    for (let i = 0; i < 5; i++) expect((await call('/api/register.php', { email: `r${i}@example.com`, password: PW })).status).toBe(200);
    expect(await call('/api/register.php', { email: 'r9@example.com', password: PW })).toMatchObject({ status: 429 });
  });

  it('unconfirmed registrations are removed after 7 days; confirmed pending ones stay', async () => {
    sql(`$p->exec("UPDATE users SET created_at = strftime('%s','now') - 8*86400 WHERE email IN ('r0@example.com', '${NEWBIE}')");`);
    await me();
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM users WHERE email='r0@example.com'")->fetchColumn(), '/', $p->query("SELECT COUNT(*) FROM users WHERE email='${NEWBIE}'")->fetchColumn();`)).toBe('0/1');
  });

  it('the breach-list parser finds the suffix and ignores padding', () => {
    const php = `define('ASTRO_API',1);require 'api/lib/bootstrap.php';`
      + `echo pwned_in_range("0018A45C4D1DEF81644B54AB7F969B88D65:10\\r\\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\\r\\nABC:7", "00D4F6E8FA6EECAD2A3AA415EEC418D38EC"), '/',`
      + `pwned_in_range("0018A45C4D1DEF81644B54AB7F969B88D65:10\\r\\n", "0018A45C4D1DEF81644B54AB7F969B88D65"), '/',`
      + `pwned_in_range("0018A45C4D1DEF81644B54AB7F969B88D65:10", "FFFF");`;
    expect(spawnSync('php', ['-r', php], { cwd: root, env, encoding: 'utf8' }).stdout).toBe('0/10/0');
  });

  // ---- the admin panel's API (astro-tbb.4) ----

  const idOf = (email: string) => sql(`echo $p->query("SELECT id FROM users WHERE email='${email}'")->fetchColumn();`);
  const act = (email: string, action: string, extra: Record<string, unknown> = {}) =>
    call('/api/admin_action.php', { userId: idOf(email), action, ...extra });
  const stateOf = (email: string) => sql(`echo $p->query("SELECT status FROM users WHERE email='${email}'")->fetchColumn();`);

  it('only a verified admin may use the admin API', async () => {
    clearLimits();
    await signInAs(USER);
    expect(await call('/api/admin_users.php')).toMatchObject({ status: 403, body: { error: 'admin only' } });
    expect((await call('/api/admin_log.php')).status).toBe(403);
    expect((await act(NEWBIE, 'approve')).status).toBe(403);
    jar = '';
    expect((await call('/api/admin_users.php')).status).toBe(401);
  });

  it('the user list puts pending registrations first and shows what the panel needs', async () => {
    await signInAs(ADMIN);
    const { status, body } = await call('/api/admin_users.php');
    expect(status).toBe(200);
    expect(body.users[0].status).toBe('pending');
    const u = body.users.find((x: { email: string }) => x.email === USER);
    expect(u).toMatchObject({ status: 'active', role: 'user', confirmed: true, twoStep: false });
    expect(u.sessions).toBeGreaterThan(0);
    expect(typeof u.created).toBe('number');
    expect(typeof u.lastSeen).toBe('number');
    expect(body.users.find((x: { email: string }) => x.email === ADMIN)).toMatchObject({ role: 'admin', twoStep: true });
  });

  it('approve: only a confirmed pending account; the user is emailed and can then sign in', async () => {
    expect(await act('r1@example.com', 'approve')).toMatchObject({ status: 409, body: { error: 'unconfirmed' } });
    expect(await act(USER, 'approve')).toMatchObject({ status: 409, body: { error: 'state' } });
    expect((await act(NEWBIE, 'approve')).status).toBe(200);
    expect(stateOf(NEWBIE)).toBe('active');
    expect(lastMailTo(NEWBIE)!).toMatchObject({ subject: 'Your Astrodynamics account is approved' });
    const admin = jar;
    expect((await signInAs(NEWBIE, PW + '2')).body.user).toMatchObject({ email: NEWBIE, status: 'active' });
    jar = admin;
  });

  it('pause, unpause, freeze and unfreeze follow the states; freezing signs the user out', async () => {
    expect((await act(USER, 'unpause')).status).toBe(409);
    expect((await act(USER, 'pause')).status).toBe(200);
    expect(stateOf(USER)).toBe('paused');
    expect((await act(USER, 'unpause')).status).toBe(200);
    expect((await act(USER, 'freeze')).body.message).toContain('frozen');
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email='${USER}'")->fetchColumn();`)).toBe('0');
    expect((await act(USER, 'freeze')).status).toBe(409);
    expect((await act(USER, 'unfreeze')).status).toBe(200);
    expect(stateOf(USER)).toBe('active');
  });

  it('delete starts the 30 days; cancelling restores the earlier state', async () => {
    await act(USER, 'pause');
    expect((await act(USER, 'delete')).body.message).toMatch(/will be removed on \d+ \w+ \d{4}/);
    expect(stateOf(USER)).toBe('deleting');
    expect((await act(USER, 'pause')).status).toBe(409);
    expect((await act(USER, 'cancel_delete')).body.message).toContain('paused again');
    await act(USER, 'unpause');
  });

  it('set_password checks the password, sets it and ends the sessions; sign_out ends them too', async () => {
    const admin = jar;
    await signInAs(USER);
    jar = admin;
    expect(await act(USER, 'set_password', { password: 'short' })).toMatchObject({ status: 400, body: { error: 'password' } });
    expect((await act(USER, 'set_password', { password: 'brand new password' })).status).toBe(200);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email='${USER}'")->fetchColumn();`)).toBe('0');
    expect((await signInAs(USER, 'brand new password')).status).toBe(200);
    jar = admin;
    expect((await act(USER, 'sign_out')).status).toBe(200);
    expect(sql(`echo $p->query("SELECT COUNT(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.email='${USER}'")->fetchColumn();`)).toBe('0');
  });

  it('roles can be changed; an admin cannot act on their own account', async () => {
    expect((await act(USER, 'make_admin')).status).toBe(200);
    expect((await act(USER, 'make_admin')).status).toBe(409);
    expect((await act(USER, 'make_user')).status).toBe(200);
    for (const a of ['freeze', 'delete', 'make_user', 'pause', 'sign_out']) {
      expect(await act(ADMIN, a)).toMatchObject({ status: 403, body: { error: 'self' } });
    }
    expect((await act(USER, 'explode')).status).toBe(400);
    expect((await call('/api/admin_action.php', { userId: 'nope', action: 'pause' })).status).toBe(404);
    expect((await call('/api/admin_action.php', { userId: idOf(USER), action: 'pause' }, {})).status).toBe(403); // no X-Astro
  });

  it('reject removes a pending registration at once', async () => {
    expect((await act('r2@example.com', 'reject')).status).toBe(200);
    expect(idOf('r2@example.com')).toBe('');
    expect((await act(USER, 'reject')).status).toBe(409);
  });

  it('every action is in the admin log, newest first; a removed account\'s address is cleared from it', async () => {
    const { body } = await call('/api/admin_log.php');
    expect(body.log[0]).toMatchObject({ admin: ADMIN, action: 'reject', detail: 'registration removed' });
    const actions = body.log.map((e: { action: string }) => e.action);
    for (const a of ['approve', 'pause', 'unpause', 'freeze', 'unfreeze', 'delete', 'cancel_delete', 'set_password', 'sign_out', 'make_admin', 'make_user']) {
      expect(actions).toContain(a);
    }
    expect(body.log.find((e: { action: string }) => e.action === 'pause')).toMatchObject({ target: USER, detail: 'active → paused' });
    // refused actions are not logged
    expect(actions).not.toContain('explode');
    await me(); // housekeeping
    expect((await call('/api/admin_log.php')).body.log[0].target).toBeNull();
    expect(JSON.stringify((await call('/api/admin_log.php')).body)).not.toContain('r2@example.com');
  });
});
