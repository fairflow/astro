import { account } from '../api/account.svelte.js';
import { AI_WORKER_URL, type AiPresetId } from './config.js';

/** Development only: the relay's DEV_KEY (from .env.local), sent from the dev server instead of a pass. */
const DEV_KEY: string = import.meta.env.DEV ? (import.meta.env.VITE_AI_DEV_KEY ?? '').trim() : '';

/**
 * A one-use pass for one reading from the site's API (ask_pass.php), or null
 * when not signed in (the relay will then refuse with "sign in"). Throws with
 * the server's message when the account may not ask now (daily limit, paused).
 */
async function getPass(): Promise<string | null> {
  if (account.status !== 'signedIn') return null;
  const res = await fetch('api/ask_pass.php', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-astro': '1' }, body: '{}',
  });
  let j: { pass?: unknown; message?: unknown } = {};
  try { j = await res.json() as typeof j; } catch { /* not JSON */ }
  if (res.ok && typeof j.pass === 'string') return j.pass;
  throw new Error(typeof j.message === 'string' ? j.message : `Could not start a reading (HTTP ${res.status}).`);
}

/**
 * Minimal streaming client for "Ask Claude". POSTs a system prompt, a single
 * user message and a model preset id to the Cloudflare Worker proxy, which
 * forwards to the Anthropic Messages API with streaming on, and reads back the
 * Server-Sent-Events stream, emitting text deltas as they arrive.
 *
 * The client sends only `system`, `messages` and a preset id; the Worker maps
 * the id to a model and effort from its own allowlist and fixes the token cap,
 * so the browser cannot request an arbitrary or expensive configuration.
 */
export interface AskOpts {
  system: string;
  /** The full user turn: the raw-factor snapshot followed by the request. */
  userContent: string;
  preset: AiPresetId;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function askClaude(opts: AskOpts): Promise<void> {
  if (!AI_WORKER_URL) {
    throw new Error('Ask Claude is not configured in this build.');
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (DEV_KEY) headers['x-astro-dev-key'] = DEV_KEY;
  else {
    const pass = await getPass();
    if (pass) headers['x-astro-pass'] = pass;
  }
  const res = await fetch(AI_WORKER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      system: opts.system,
      messages: [{ role: 'user', content: opts.userContent }],
      preset: opts.preset,
    }),
    signal: opts.signal,
  });

  if (res.status === 403) {
    throw new Error('Ask Claude only works on the Astrodynamics site itself (fairflow.co.uk), not from this address.');
  }
  if (res.status === 401 || res.status === 429) {
    // not signed in, a pass refused, or the daily limit: the relay says which
    let msg = '';
    try { msg = String((await res.json() as { message?: unknown }).message ?? ''); } catch { /* not JSON */ }
    throw new Error(msg || 'Ask Claude needs an account: sign in, or create one, in Settings, Account.');
  }
  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`Ask Claude failed (HTTP ${res.status}).${detail ? ' ' + detail.slice(0, 300) : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      handleFrame(frame, opts.onDelta);
    }
  }
}

/** Parse one SSE frame and surface text deltas, end-of-reading notes and errors. */
function handleFrame(frame: string, onDelta: (t: string) => void): void {
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data || data === '[DONE]') return;
  let ev: unknown;
  try { ev = JSON.parse(data); } catch { return; }
  if (!ev || typeof ev !== 'object') return;
  const e = ev as Record<string, unknown>;

  if (e.type === 'content_block_delta') {
    const delta = e.delta as Record<string, unknown> | undefined;
    if (delta && delta.type === 'text_delta' && typeof delta.text === 'string') {
      onDelta(delta.text);
    }
    // thinking blocks are not shown
  } else if (e.type === 'message_delta') {
    const delta = e.delta as Record<string, unknown> | undefined;
    const stop = delta?.stop_reason;
    if (stop === 'max_tokens') onDelta('\n\n[The reading was cut short at the length limit.]');
    else if (stop === 'refusal') onDelta('\n\n[Claude declined to answer this one. Try rephrasing the question.]');
  } else if (e.type === 'error') {
    const err = e.error as Record<string, unknown> | undefined;
    const msg = err && typeof err.message === 'string' ? err.message : 'stream error';
    throw new Error(`Ask Claude stream error: ${msg}`);
  }
}
