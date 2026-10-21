// The Ask Claude relay's gate (worker/src/index.ts, astro-tbb.7 / astro-bk6):
// signed-in accounts only, by a one-use pass checked with the site's API.
import { describe, expect, it } from 'vitest';
import worker, { gate, type Env } from '../worker/src/index.js';

const env: Env = { ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: 'https://fairflow.co.uk,http://localhost:8322',
  API_BASE: 'https://fairflow.co.uk/astro/api/', DEV_KEY: 'dev-secret-123' };
const SITE = 'https://fairflow.co.uk';
const h = (o: Record<string, string>) => new Headers(o);
const answer = (status: number, body: unknown = {}) => async () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('relay gate', () => {
  it('refuses a request without a pass: sign in', async () => {
    expect(await gate(h({}), SITE, env, answer(200))).toMatchObject({ status: 401, body: { error: 'sign in' } });
  });

  it('checks the pass with the API (POST {pass} to ask_consume.php) and lets it through when accepted', async () => {
    const calls: [string, RequestInit][] = [];
    const check = async (url: string, init: RequestInit) => { calls.push([url, init]); return new Response('{"ok":true}'); };
    expect(await gate(h({ 'x-astro-pass': 'abc' }), SITE, env, check)).toBeNull();
    expect(calls[0]![0]).toBe('https://fairflow.co.uk/astro/api/ask_consume.php');
    expect(JSON.parse(String(calls[0]![1].body))).toEqual({ pass: 'abc' });
  });

  it('checks a staging page\'s pass with the staging API, never the live one', async () => {
    const staging = 'https://staging.fairflow.co.uk';
    const withStaging: Env = { ...env, STAGING_ORIGIN: staging, STAGING_API_BASE: 'https://staging.fairflow.co.uk/astro/api/' };
    const urls: string[] = [];
    const check = async (url: string) => { urls.push(url); return new Response('{"ok":true}'); };
    expect(await gate(h({ 'x-astro-pass': 'p' }), staging, withStaging, check)).toBeNull();
    expect(await gate(h({ 'x-astro-pass': 'p' }), SITE, withStaging, check)).toBeNull();
    expect(urls).toEqual(['https://staging.fairflow.co.uk/astro/api/ask_consume.php', 'https://fairflow.co.uk/astro/api/ask_consume.php']);
    // staging origin but no staging API configured: an error, not a fall back to the live API
    const never = async () => { throw new Error('should not be called'); };
    expect(await gate(h({ 'x-astro-pass': 'p' }), staging, { ...env, STAGING_ORIGIN: staging }, never))
      .toMatchObject({ status: 500 });
  });

  it('passes on the API\'s refusals: used or unknown pass, daily limit', async () => {
    expect(await gate(h({ 'x-astro-pass': 'used' }), SITE, env, answer(403, { error: 'pass' })))
      .toMatchObject({ status: 401, body: { error: 'pass' } });
    expect(await gate(h({ 'x-astro-pass': 'p' }), SITE, env, answer(429, { message: 'You have used your 20 …' })))
      .toEqual({ status: 429, body: { error: 'limit', message: 'You have used your 20 …' } });
    expect(await gate(h({ 'x-astro-pass': 'p' }), SITE, env, async () => { throw new Error('down'); }))
      .toMatchObject({ status: 502 });
  });

  it('lets localhost through with the right dev key only', async () => {
    const never = async () => { throw new Error('should not be called'); };
    expect(await gate(h({ 'x-astro-dev-key': 'dev-secret-123' }), 'http://localhost:8322', env, never)).toBeNull();
    expect(await gate(h({ 'x-astro-dev-key': 'dev-secret-124' }), 'http://localhost:8322', env, answer(200)))
      .toMatchObject({ status: 401 });
    // the key means nothing from the live site, or when the Worker has none
    expect(await gate(h({ 'x-astro-dev-key': 'dev-secret-123' }), SITE, env, answer(200))).toMatchObject({ status: 401 });
    expect(await gate(h({ 'x-astro-dev-key': '' }), 'http://localhost:8322', { ...env, DEV_KEY: '' }, answer(200)))
      .toMatchObject({ status: 401 });
  });

  it('the Worker refuses before reading the body or calling Claude, and allows the pass headers in CORS', async () => {
    const res = await worker.fetch(new Request('https://w.example/', {
      method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: '{}',
    }), env);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'sign in' });
    const pre = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { origin: SITE } }), env);
    expect(pre.headers.get('access-control-allow-headers')).toContain('x-astro-pass');
  });
});
