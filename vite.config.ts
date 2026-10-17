import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { buildStamp, stampDefines } from './buildstamp';

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

// Build identity (buildstamp.ts), shared with the standalone Retrograde build:
// version + commit, shown in the header and written to dist/version.json.
const stamp = buildStamp(__dirname);
// Matches the header build stamp (App.svelte). Header and cache key stay in sync.
const hashHead = stamp.short || 'v1';

// dist/version.json: the build identity in machine-readable form, so the live
// site can be checked against a commit (deploy workflow; tools/check_live.sh).
function versionJson(): Plugin {
  return {
    name: 'version-json',
    apply: 'build',
    closeBundle() {
      const { version, hash, date, dirty, id } = stamp;
      writeFileSync(resolve(__dirname, 'dist/version.json'),
        JSON.stringify({ version, hash, date, dirty, id }, null, 2) + '\n');
    },
  };
}

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
  plugins: [svelte(), swVersionStamp(), versionJson(), guardNoServedPersonalData()],
  define: stampDefines(stamp),
  // data/ holds the committed ephemeris packs, gazetteer, text packs and
  // web-app files (manifest, service worker, icons); serving it as
  // publicDir exposes them at the site root and copies them into dist/.
  publicDir: 'data',
  server: { port: 8322, strictPort: true },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
