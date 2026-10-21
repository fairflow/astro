// The staging build's API must never open the live database. The build writes
// api/lib/STAGING (vite.config.ts); with it the API reads astro-config/staging.ini
// and never db.ini, whatever the host or document root. Here: a copy of api/ with
// the marker, under `php -S`, with a live db.ini beside it and no staging.ini
// (the failure case), then with one. Skipped without PHP.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freePort } from './freeport.js';

const root = resolve(__dirname, '..');
const hasPhp = spawnSync('php', ['-r', 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);']).status === 0;
const PORT = freePort();
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'a long password 1';
const U = 'tester@example.com';

let dir = '';       // stands in for the host's home directory
let server: ChildProcess | undefined;
const live = () => join(dir, 'live.sqlite');
const stg = () => join(dir, 'staging.sqlite');
const ini = (name: string, db: string) => writeFileSync(join(dir, 'astro-config', name),
  `[db]\ndriver = sqlite\npath = "${db}"\n[passwords]\npwned_check = off\n`);

// as on the host: no ASTRO_DB_INI, the config found from the home directory / document root
const env = () => { const e: NodeJS.ProcessEnv = { ...process.env, HOME: dir }; delete e.ASTRO_DB_INI; return e; };
const cli = (script: string, args: string[] = [], input = '') =>
  spawnSync('php', [join(dir, 'site/api/cli', script), ...args], { cwd: dir, env: env(), input, encoding: 'utf8' });
const login = async () => {
  const res = await fetch(`${BASE}/api/login.php`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-astro': '1' },
    body: JSON.stringify({ email: U, password: PW }),
  });
  return { status: res.status, body: await res.json() };
};

describe.skipIf(!hasPhp)('staging API keeps off the live database (php -S + SQLite)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'astro-staging-'));
    mkdirSync(join(dir, 'astro-config'));
    cpSync(join(root, 'api'), join(dir, 'site/api'), { recursive: true });
    writeFileSync(join(dir, 'site/api/lib/STAGING'), 'staging build\n');
    ini('db.ini', live()); // the live config is there, and valid
    server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', join(dir, 'site')], { cwd: dir, env: env(), stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/api/me.php`); break; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
  }, 30_000);
  afterAll(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

  it('with the marker and no staging.ini, requests fail with a clear message and db.ini is not used', async () => {
    const r = await login();
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ error: 'staging config missing' });
    expect(existsSync(live())).toBe(false); // opening the live config would have created its database
  });

  it('with the marker and no staging.ini, the command line stops too', () => {
    const r = cli('migrate.php');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('staging.ini is missing');
    expect(existsSync(live())).toBe(false);
  });

  it('with the marker and a staging.ini, the staging database is used', async () => {
    ini('staging.ini', stg());
    expect(cli('migrate.php').stdout).toContain('applied 001_users.sql');
    const add = cli('user.php', ['add', U], `${PW}\n`);
    expect(add.status, add.stderr).toBe(0);
    expect(existsSync(stg())).toBe(true);
    expect((await login()).status).toBe(200);
    expect(existsSync(live())).toBe(false);
  });

  it('without the marker (the live build) the same setup uses db.ini', () => {
    rmSync(join(dir, 'site/api/lib/STAGING'));
    expect(cli('migrate.php').stdout).toContain('applied 001_users.sql');
    expect(existsSync(live())).toBe(true);
  });
});
