/// <reference types="vite/client" />

// Build-time version stamp, injected by vite.config.ts `define`.
declare const __GIT_HASH__: string;
declare const __GIT_DATE__: string;
/** package.json "version": bump it with each release so builds are told apart at a glance. */
declare const __APP_VERSION__: string;
