/// <reference types="vite/client" />

/**
 * Phase-1 "Ask Claude" spike configuration.
 *
 * The Anthropic API key NEVER lives here or anywhere in this bundle — it is
 * held by a Cloudflare Worker (see `worker/`). This file only knows the
 * Worker's public URL, injected at build time via `VITE_AI_WORKER_URL`.
 * With no URL set, the feature is simply disabled (the panel says so).
 */
export const AI_WORKER_URL: string =
  (import.meta.env.VITE_AI_WORKER_URL ?? '').trim();

/** Whether the "Ask Claude" feature is wired up in this build. */
export const AI_ENABLED: boolean = AI_WORKER_URL.length > 0;

/**
 * The model is chosen server-side in the Worker (so the client cannot ask for
 * an expensive one). This string is for display only.
 */
export const AI_MODEL_LABEL = 'Claude Sonnet 5.5';
