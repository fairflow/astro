/**
 * Astrodynamics "Ask Claude" proxy (Phase-1 spike).
 *
 * A Cloudflare Worker that holds the Anthropic API key (as an encrypted
 * secret) and forwards streaming requests to the Messages API. The static
 * app only ever talks to this Worker, never to api.anthropic.com directly,
 * so the key never ships in the browser bundle.
 *
 * The client may send ONLY `system` + `messages`. Model, token cap and effort
 * are fixed here so the browser cannot request an expensive configuration.
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
  /** Model id (default claude-sonnet-5-5). */
  MODEL?: string;
  /** Output token cap (default 6000). */
  MAX_TOKENS?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-5-5';
const DEFAULT_MAX_TOKENS = 6000;
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

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: 'invalid JSON body' }, 400, cors); }
    const b = (body ?? {}) as Record<string, unknown>;
    const messages = b.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages[] is required' }, 400, cors);
    }

    const payload = {
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: Number(env.MAX_TOKENS) || DEFAULT_MAX_TOKENS,
      stream: true,
      output_config: { effort: 'medium' },
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

function corsHeaders(origin: string, ok: boolean): Record<string, string> {
  return {
    'access-control-allow-origin': ok && origin ? origin : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
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
