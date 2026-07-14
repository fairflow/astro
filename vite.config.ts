import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Personal-data guard: reaction exports (a named reader's comments) must never
// sit under data/ — it is the publicDir, so anything here is bundled into dist/
// and served world-readable. Fail the build if a *reactions* file is found.
// (A leak of one such file to the live site prompted this — 2026-07-14.)
function guardNoServedPersonalData(): Plugin {
  return {
    name: 'guard-no-served-personal-data',
    apply: 'build',
    buildStart() {
      const root = resolve(__dirname, 'data');
      const bad: string[] = [];
      const walk = (d: string) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = resolve(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/reactions/i.test(e.name)) bad.push(p);
        }
      };
      if (existsSync(root)) walk(root);
      if (bad.length) {
        throw new Error(
          'Build blocked — personal-data file(s) under data/ (served publicly):\n'
          + bad.map(p => '  ' + p).join('\n')
          + '\nMove reaction exports out of data/ (e.g. to repo-root authoring/).');
      }
    },
  };
}

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
// First 5 hex of the commit hash — matches git's front-truncation convention
// and the header build stamp (App.svelte). Header and cache key stay in sync.
const hashHead = git.hash ? git.hash.slice(0, 5) : 'v1';

// sw.js is copied verbatim from publicDir (data/) — `define` doesn't reach
// it. Patch its cache-key VERSION post-build so every deploy busts old
// caches, including unhashed data fetches (authoring batches, text packs)
// that would otherwise be stuck cache-first forever (see PITFALLS).
function swVersionStamp(): Plugin {
  return {
    name: 'sw-version-stamp',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js');
      if (!existsSync(swPath)) return;
      const patched = readFileSync(swPath, 'utf8')
        .replace(/const VERSION = '[^']*';/, `const VERSION = 'astrodynamics-${hashHead}';`);
      writeFileSync(swPath, patched);
    },
  };
}

export default defineConfig({
  // relative base so dist/ works from any subdirectory (e.g. /astro/)
  base: './',
  plugins: [svelte(), swVersionStamp(), guardNoServedPersonalData()],
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
