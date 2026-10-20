/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public URL of the Cloudflare Worker that proxies the Anthropic API
   *  (the "Ask Claude" spike). Unset ⇒ the feature is disabled. */
  readonly VITE_AI_WORKER_URL?: string;
  /** Comma-separated page origins the Worker accepts; elsewhere the panel is hidden. */
  readonly VITE_AI_ORIGINS?: string;
  /** Development only (.env.local, never committed): the relay's DEV_KEY, so
   *  Ask Claude works from the dev server on localhost without a pass. */
  readonly VITE_AI_DEV_KEY?: string;
}

// Build-time version stamp, injected by vite.config.ts `define`.
declare const __GIT_HASH__: string;
declare const __GIT_DATE__: string;
/** package.json "version": bump it with each release so builds are told apart at a glance. */
declare const __APP_VERSION__: string;
/** '<version>+<5-hex commit>', '.dirty' appended for a build with uncommitted changes (buildstamp.ts). */
declare const __BUILD_ID__: string;
