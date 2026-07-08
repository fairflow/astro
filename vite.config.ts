import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Version stamp injected at build time: the deployed bundle differs from its
// source commit only by these values (see header build tag). Falls back to
// empty strings outside a git checkout (e.g. a source tarball).
function gitStamp(): { hash: string; date: string } {
  try {
    const hash = execSync('git rev-parse HEAD').toString().trim();
    const date = execSync("git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M'")
      .toString().trim();
    return { hash, date };
  } catch {
    return { hash: '', date: '' };
  }
}

const git = gitStamp();

export default defineConfig({
  // relative base so dist/ works from any subdirectory (e.g. /astro/)
  base: './',
  plugins: [svelte()],
  define: {
    __GIT_HASH__: JSON.stringify(git.hash),
    __GIT_DATE__: JSON.stringify(git.date),
  },
  // data/ holds the committed ephemeris packs, gazetteer, text packs and
  // web-app files (manifest, service worker, icons); serving it as
  // publicDir exposes them at the site root and copies them into dist/.
  publicDir: 'data',
  server: { port: 8322, strictPort: true },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
