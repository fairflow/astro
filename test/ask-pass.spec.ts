// Ask Claude asks the server for a pass unless the app knows it is signed out
// (2026-10-25: a signed-in admin was told to sign in while the app's sign-in
// state was "checking" or "unreachable", because no pass was requested).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askClaude } from '../src/ai/ask.js';
import { account } from '../src/api/account.svelte.js';

type Call = { url: string; headers: Record<string, string> };
let calls: Call[] = [];
let passReply: () => Response | Promise<Response>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  calls = [];
  passReply = () => json(200, { pass: 'p-123', remaining: null });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.endsWith('ask_pass.php')) return passReply();
    if (url.endsWith('me.php')) return json(200, { user: { email: 'admin@example.com', status: 'active', role: 'admin' } });
    return new Response('data: [DONE]\n\n', { status: 200 });   // the relay
  }));
});
afterEach(() => vi.unstubAllGlobals());

const ask = () => askClaude({ system: 's', userContent: 'u', preset: 'sonnet-medium', onDelta: () => {} });
const relayCall = () => calls.find(c => !c.url.endsWith('.php'));

describe('the pass for a reading', () => {
  for (const status of ['signedIn', 'checking', 'unreachable'] as const) {
    it(`is requested when the sign-in is ${status}, and sent to the relay`, async () => {
      account.status = status;
      await ask();
      expect(calls.some(c => c.url.endsWith('ask_pass.php'))).toBe(true);
      expect(relayCall()?.headers['x-astro-pass']).toBe('p-123');
    });
  }

  it('is not requested when the app knows it is signed out', async () => {
    account.status = 'signedOut';
    await ask();
    expect(calls.some(c => c.url.endsWith('ask_pass.php'))).toBe(false);
    expect(relayCall()?.headers['x-astro-pass']).toBeUndefined();
  });

  it('a 401 from the server says to sign in again, and the relay is not called', async () => {
    account.status = 'unreachable';
    passReply = () => json(401, { error: 'not signed in' });
    await expect(ask()).rejects.toThrow(/sign in again/);
    expect(relayCall()).toBeUndefined();
  });

  it('a failed connection says so, rather than "sign in"', async () => {
    account.status = 'checking';
    passReply = () => { throw new TypeError('Failed to fetch'); };
    await expect(ask()).rejects.toThrow(/Could not reach the site/);
  });

  it('no API here (not JSON): no pass, and the relay decides', async () => {
    account.status = 'checking';
    passReply = () => new Response('<html>not found</html>', { status: 404, headers: { 'content-type': 'text/html' } });
    await ask();
    expect(relayCall()?.headers['x-astro-pass']).toBeUndefined();
  });
});
