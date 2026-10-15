/// <reference types="vite/client" />

/**
 * "Ask Claude" configuration.
 *
 * The Anthropic API key NEVER lives here or anywhere in this bundle — it is
 * held by a Cloudflare Worker (see `worker/`). This file only knows the
 * Worker's public URL, injected at build time via `VITE_AI_WORKER_URL`
 * (committed in `.env`, so local and CI builds both include it).
 * With no URL set, the feature is simply disabled (the panel says so).
 */
export const AI_WORKER_URL: string =
  (import.meta.env.VITE_AI_WORKER_URL ?? '').trim();

/** Whether the "Ask Claude" feature is wired up in this build. */
export const AI_ENABLED: boolean = AI_WORKER_URL.length > 0;

/**
 * Model + effort presets the reader can choose. Only the id goes over the
 * wire; the Worker maps it to a model and effort from its own allowlist, so
 * the browser cannot request anything outside this list.
 * Keep in step with PRESETS in worker/src/index.ts.
 */
export const AI_PRESETS = [
  { id: 'sonnet-medium', label: 'Sonnet 5.5 · medium', hint: 'Fast and inexpensive (the default)' },
  { id: 'sonnet-high', label: 'Sonnet 5.5 · high', hint: 'Sonnet thinking harder; a little slower' },
  { id: 'opus-medium', label: 'Opus 5.5 · medium', hint: 'The most capable model; about twice the cost' },
] as const;

export type AiPresetId = typeof AI_PRESETS[number]['id'];
export const DEFAULT_PRESET: AiPresetId = 'sonnet-medium';
export const isPreset = (v: unknown): v is AiPresetId =>
  AI_PRESETS.some(p => p.id === v);
