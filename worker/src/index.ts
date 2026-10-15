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
