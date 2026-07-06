import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // relative base so dist/ works from any subdirectory (e.g. /astro/)
  base: './',
  plugins: [svelte()],
  // data/ holds the committed ephemeris packs, gazetteer, text packs and
  // web-app files (manifest, service worker, icons); serving it as
  // publicDir exposes them at the site root and copies them into dist/.
  publicDir: 'data',
  server: { port: 8322, strictPort: true },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
