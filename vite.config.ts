import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { buildStamp, stampDefines } from './buildstamp';
import { renderMarkdown } from './src/ai/markdown';

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

// The server API (api/, PHP) ships beside the app: dist/api/ is deployed with
// everything else, so it is served at <app>/api/ (docs/DESIGN.md §5a).
function copyApi(staging: boolean): Plugin {
  return {
    name: 'copy-api',
    apply: 'build',
    closeBundle() {
      cpSync(resolve(__dirname, 'api'), resolve(__dirname, 'dist/api'), { recursive: true });
      // The staging build's API reads staging.ini and never db.ini (api/lib/bootstrap.php,
      // is_staging). lib/ is not served, so the marker is not reachable over HTTP.
      if (staging) writeFileSync(resolve(__dirname, 'dist/api/lib/STAGING'), 'staging build: uses astro-config/staging.ini, never db.ini\n');
    },
  };
}

// Staging build (`npm run build:staging`, mode "staging"): the page title and the
// web manifest's names say so, so a home-screen icon is told apart from the live app's.
// The in-app indicator is __STAGING__ (App.svelte).
function stagingNames(): Plugin {
  return {
    name: 'staging-names',
    apply: 'build',
    transformIndexHtml: html => html.replace('<title>Astrodynamics</title>', '<title>Staging · Astrodynamics</title>'),
    closeBundle() {
      const path = resolve(__dirname, 'dist/manifest.webmanifest');
      const m = JSON.parse(readFileSync(path, 'utf8'));
      m.name = 'Astrodynamics staging';
      m.short_name = 'Astro staging';
      writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
    },
  };
}

// The privacy notice (docs/privacy-notice.md) as its own page at <app>/privacy/:
// written to dist/ by the build, served on the fly by the dev server. The
// Markdown goes through the same escape-first renderer as Ask Claude readings.
function privacyHtml(): string {
  const md = readFileSync(resolve(__dirname, 'docs/privacy-notice.md'), 'utf8');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy notice · Astrodynamics</title>
<style>
  :root { --bg: #f4f0e6; --panel: #fff; --line: #c9c0aa; --ink: #2c2820; --dim: #6d6656; --gold: #8f6f2f; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0e1220; --panel: #171e33; --line: #28304d; --ink: #e8e4d8; --dim: #9aa0b5; --gold: #d4af6a; color-scheme: dark; }
  }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 16px 4rem; }
  a { color: var(--gold); }
  .back { font-size: .9rem; }
  h2 { font-family: "Iowan Old Style", Palatino, Georgia, serif; font-weight: 400; color: var(--gold); font-size: 2rem; margin: 1rem 0 .5rem; }
  h3 { font-family: "Iowan Old Style", Palatino, Georgia, serif; color: var(--gold); font-size: 1.25rem; margin: 1.8rem 0 .4rem; }
  p, li { max-width: 65ch; }
  .tablewrap { overflow-x: auto; margin: .5rem 0 1rem; }
  table { border-collapse: collapse; font-size: .95rem; }
  th, td { border: 1px solid var(--line); padding: .4rem .7rem; text-align: left; vertical-align: top; }
  th { background: var(--panel); color: var(--gold); }
</style>
</head>
<body>
<main>
<p class="back"><a href="../">← Astrodynamics</a></p>
${renderMarkdown(md)}
</main>
</body>
</html>
`;
}

function privacyPage(): Plugin {
  return {
    name: 'privacy-page',
    configureServer(server) {
      server.middlewares.use('/privacy', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(privacyHtml());
      });
    },
    closeBundle() {
      if (!existsSync(resolve(__dirname, 'dist'))) return;
      mkdirSync(resolve(__dirname, 'dist/privacy'), { recursive: true });
      writeFileSync(resolve(__dirname, 'dist/privacy/index.html'), privacyHtml());
    },
  };
}

export default defineConfig(({ mode }) => ({
  // relative base so dist/ works from any subdirectory (e.g. /astro/)
  base: './',
  plugins: [svelte(), swVersionStamp(), versionJson(), copyApi(mode === 'staging'), privacyPage(), guardNoServedPersonalData(),
    ...(mode === 'staging' ? [stagingNames()] : [])],
  define: { ...stampDefines(stamp), __STAGING__: JSON.stringify(mode === 'staging') },
  // data/ holds the committed ephemeris packs, gazetteer, text packs and
  // web-app files (manifest, service worker, icons); serving it as
  // publicDir exposes them at the site root and copies them into dist/.
  publicDir: 'data',
  // /api/ goes to PHP's built-in server (`npm run api`); without it the app
  // simply finds no API and hides the account section
  // (keeping the Host header, so the API's same-origin check sees localhost:8322)
  server: { port: 8322, strictPort: true, proxy: { '/api/': { target: 'http://127.0.0.1:8323', changeOrigin: false } } },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
}));
