import { AI_WORKER_URL } from './config.js';

/**
 * Minimal streaming client for the "Ask Claude" spike. POSTs a system prompt
 * and a single user message to the Cloudflare Worker proxy, which forwards to
 * the Anthropic Messages API with streaming on, and reads back the
 * Server-Sent-Events stream, emitting text deltas as they arrive.
 *
 * The client deliberately sends only `system` + `messages`; model, token cap
 * and effort are fixed server-side so the browser cannot request an expensive
 * configuration.
 */
export interface AskOpts {
  system: string;
  /** The full user turn: the raw-factor snapshot followed by the request. */
  userContent: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function askClaude(opts: AskOpts): Promise<void> {
  if (!AI_WORKER_URL) {
    throw new Error('AI endpoint not configured (VITE_AI_WORKER_URL is unset).');
  }
  const res = await fetch(AI_WORKER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system: opts.system,
      messages: [{ role: 'user', content: opts.userContent }],
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`AI request failed (HTTP ${res.status}).${detail ? ' ' + detail.slice(0, 300) : ''}`);
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

/** Parse one SSE frame and surface text deltas (and upstream errors). */
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
    // thinking_delta blocks are intentionally not shown in the spike.
  } else if (e.type === 'error') {
    const err = e.error as Record<string, unknown> | undefined;
    const msg = err && typeof err.message === 'string' ? err.message : 'stream error';
    throw new Error(`AI stream error: ${msg}`);
  }
}
