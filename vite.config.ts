import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // data/ holds the committed ephemeris packs and gazetteer; serving it as
  // publicDir exposes them at /packs/*.json and /gazetteer.json and copies
  // them into dist/ on build.
  publicDir: 'data',
  server: { port: 8322, strictPort: true },
});
