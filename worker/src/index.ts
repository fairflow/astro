/**
 * Astrodynamics "Ask Claude" proxy (Phase-1 spike).
 *
 * A Cloudflare Worker that holds the Anthropic API key (as an encrypted
 * secret) and forwards streaming requests to the Messages API. The static
 * app only ever talks to this Worker, never to api.anthropic.com directly,
 * so the key never ships in the browser bundle.
 *
 * The client may send ONLY `system`, `messages` and a `preset` id. The preset
 * is looked up in PRESETS below (model + effort); anything unknown falls back
 * to the default, and the token cap is fixed here, so the browser cannot
 * request an arbitrary or expensive configuration.
 *
 * Refusal fallbacks are on (`fallbacks: "default"`): if the model's safety
 * classifiers decline, Anthropic re-runs the request on its recommended
 * fallback model within the same call.
 *
 * Who may use it (astro-tbb.7, astro-bk6): signed-in accounts only. Each
 * request carries a one-use pass (header x-astro-pass) that the app got from
 * the site's API (ask_pass.php); before calling Claude this Worker checks it
 * with the API (ask_consume.php at API_BASE), which marks it used and applies
 * the account's daily limit. No shared secret is needed: a pass is 32 random
 * bytes the API issued to that account. A page on localhost (development,
 * whose passes the live API cannot know) may instead send the secret DEV_KEY
 * (header x-astro-dev-key); without DEV_KEY set, localhost is refused.
 *
 * Privacy: this Worker does NOT log request or response bodies. The chart
 * factors pass straight through to Anthropic and back.
 *
 * Setup:
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler deploy
 * See worker/README.md.
 */

export interface Env {
  /** Secret: set with `wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY: string;
  /** Comma-separated allowed site origins. Empty ⇒ allow any (dev only). */
  ALLOWED_ORIGINS?: string;
  /** Output token cap, thinking included (default 10000). */
  MAX_TOKENS?: string;
  /** The site's API, which issues and checks passes, e.g. https://fairflow.co.uk/astro/api/ */
  API_BASE?: string;
  /** The staging site's origin and its API: requests from that origin are checked there, never with API_BASE. */
  STAGING_ORIGIN?: string;
  STAGING_API_BASE?: string;
  /** Secret (optional): lets a localhost page use the Worker without a pass, for development. */
  DEV_KEY?: string;
}

/**
 * May this request use Claude? null if so, else the refusal to send. `check`
 * is the call to the API's ask_consume.php (injectable for tests).
 */
export async function gate(
  headers: Headers, origin: string, env: Env,
  check: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const devKey = headers.get('x-astro-dev-key') ?? '';
  if (/^http:\/\/localhost(:\d+)?$/.test(origin) && env.DEV_KEY && sameSecret(devKey, env.DEV_KEY)) return null;
  const pass = headers.get('x-astro-pass') ?? '';
  if (!pass) {
    return { status: 401, body: { error: 'sign in', message: 'Ask Claude needs an account: sign in, or create one, in Settings, Account.' } };
  }
  // each site's passes are checked with its own API; staging with no STAGING_API_BASE is an error, not the live API
  const base = env.STAGING_ORIGIN && origin === env.STAGING_ORIGIN ? env.STAGING_API_BASE : env.API_BASE;
  if (!base) return { status: 500, body: { error: 'server is missing API_BASE' } };
  let res: Response;
  try {
    res = await check(new URL('ask_consume.php', base).href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'astro-ai-worker' },
      body: JSON.stringify({ pass }),
    });
  } catch {
    return { status: 502, body: { error: 'could not check the pass', message: 'Could not check your sign-in just now. Try again.' } };
  }
  if (res.ok) return null;
  let j: Record<string, unknown> = {};
  try { j = await res.json() as Record<string, unknown>; } catch { /* not JSON */ }
  if (res.status === 429) return { status: 429, body: { error: 'limit', message: j.message ?? 'Daily limit reached.' } };
  if (res.status === 403) return { status: 401, body: { error: 'pass', message: j.message ?? 'Sign in again to use Ask Claude.' } };
  return { status: 502, body: { error: `pass check failed (HTTP ${res.status})` } };
}

/** The only model/effort combinations the app may ask for. Keep in step with
 *  AI_PRESETS in src/ai/config.ts. */
const PRESETS: Record<string, { model: string; effort: 'medium' | 'high' }> = {
  'sonnet-medium': { model: 'claude-sonnet-5-5', effort: 'medium' },
  'sonnet-high': { model: 'claude-sonnet-5-5', effort: 'high' },
  'opus-medium': { model: 'claude-opus-5-5', effort: 'medium' },
};
const DEFAULT_PRESET = 'sonnet-medium';
const DEFAULT_MAX_TOKENS = 10000;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin') ?? '';
    const allow = (env.ALLOWED_ORIGINS ?? '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const originOk = allow.length === 0 || allow.includes(origin);
    const cors = corsHeaders(origin, originOk);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, cors);
    if (!originOk) return json({ error: 'origin not allowed' }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server is missing its API key' }, 500, cors);

    const refused = await gate(req.headers, origin, env);
    if (refused) return json(refused.body, refused.status, cors);

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: 'invalid JSON body' }, 400, cors); }
    const b = (body ?? {}) as Record<string, unknown>;
    const messages = b.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages[] is required' }, 400, cors);
    }

    const preset = (typeof b.preset === 'string' && PRESETS[b.preset]) || PRESETS[DEFAULT_PRESET]!;
    const payload = {
      model: preset.model,
      max_tokens: Number(env.MAX_TOKENS) || DEFAULT_MAX_TOKENS,
      stream: true,
      output_config: { effort: preset.effort },
      fallbacks: 'default',
      ...(typeof b.system === 'string' ? { system: b.system } : {}),
      messages,
    };

    let upstream: Response;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          // gates `fallbacks: "default"` (refusal → recommended fallback model)
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return json({ error: 'could not reach the model service' }, 502, cors);
    }

    if (!upstream.ok || !upstream.body) {
      let detail = '';
      try { detail = await upstream.text(); } catch { /* ignore */ }
      return json({ error: `upstream ${upstream.status}`, detail: detail.slice(0, 500) }, 502, cors);
    }

    // Stream the SSE body straight back to the browser.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  },
};

/** Compare a secret without the time taken revealing how much of it matched. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function corsHeaders(origin: string, ok: boolean): Record<string, string> {
  return {
    'access-control-allow-origin': ok && origin ? origin : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-astro-pass, x-astro-dev-key',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function json(obj: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}
