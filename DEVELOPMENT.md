# Development

Architecture and internals, for anyone extending the app. For running it,
see `GUIDE.md`; for what it does, see `MANUAL.md`. Deeper session-by-session
history lives in `docs/BUILDLOG.md`, `HANDOFF.md`, `docs/DECISIONS.md`, and
`docs/PITFALLS.md` — read those before making a non-trivial change; this
file is the map, not the full log.

## Stack

Svelte 5 + TypeScript + Vite 6, tested with Vitest. No server, no backend
framework — the deployable output is a static `dist/` directory. Python
(`pyswisseph`, `numpy`, `pillow`) is dev-tooling only, used to generate
golden test references and asteroid packs; it never ships.

## Directory layout

```
src/
  ephemeris/   providers: astronomy-engine (Sun–Pluto), Chebyshev packs
               (asteroids), analytic Node/Lilith
  chart/       time/civil conversion, houses, aspects, cross-chart maths
               (transits, synastry, composites, Ebertin midpoints)
  interpret/   composer, per-context reading voices, dossiers, markers,
               snapshots; texts load from data/texts/*.json at runtime
  render/      wheel geometry, tunable SVG glyph kit, SVG/PNG export
  ui/          Svelte 5 components, app-wide state/prefs/session/skins
  store/       Dexie (IndexedDB) saved-chart store, gazetteer loader
data/          served at the site root (Vite publicDir): ephemeris packs,
               gazetteer, text packs, PWA manifest/icons/service worker
tools/         Python generators (golden refs, asteroid packs, gazetteer,
               icons, deploy, authoring pipeline)
test/          Vitest specs, incl. test/golden/*.json reference data
docs/          design doc, build log, decisions, pitfalls, plans, research
```

Pure computation (`src/render/wheel.ts`, everything in `src/chart/` and
`src/ephemeris/`) is plain TypeScript with no DOM dependency — keep it that
way so it stays testable without a browser.

## Golden-test methodology

The compute core is checked against real ephemeris data, not just against
itself:

1. `tools/golden_refs.py` uses `pyswisseph` (AGPL, dev-only — the built-in
   Moshier model, `SEFLG_MOSEPH`, so no Swiss Ephemeris data files are
   needed) to compute planetary positions and house cusps at 60 random
   Julian dates between 1900 and 2100, and writes
   `test/golden/{planets,houses}.json`.
2. `test/golden-planets.spec.ts` and `test/golden-houses.spec.ts` assert
   the TypeScript core (`astronomy-engine` + own house-cusp code) matches
   those references — planets to ≤0.03°, houses to ≤0.03° (Porphyry
   fallback checked separately for polar latitudes).
3. Asteroid coverage (Chiron, Ceres, Pallas, Juno, Vesta, Eris) works
   differently: `tools/make_packs.py` fits Chebyshev coefficient packs to
   JPL Horizons data (public domain, no licensing issue), and
   `test/asteroid-packs.spec.ts` validates the packs against a *held-out*
   sample of Horizons positions not used in the fit — ≤0.01° error,
   1900–2100.

Golden tests are **frozen**: a failing golden test means the change under
review is wrong, not the test. Don't edit `test/golden/*.json` or the
tolerance thresholds to make a change pass.

## Commands

```bash
npm install
npm test              # vitest run — includes golden tests
npm run typecheck      # tsc --noEmit
npm run dev            # dev server, :8322 (no service worker)
npm run build           # dist/, ~3.8 MB incl. all data
npm run preview          # serve dist/ — service worker active here, not in dev
npm run build:retro      # dist-retro/retrograde.html: standalone Retrograde page

# Python tooling (one-off / regeneration), from a venv:
python3 -m venv .venv && .venv/bin/pip install pyswisseph numpy pillow
.venv/bin/python tools/golden_refs.py     # regenerate golden references
.venv/bin/python tools/golden_stations.py # regenerate Mercury/Venus station references
.venv/bin/python tools/make_packs.py      # regenerate asteroid packs
.venv/bin/python tools/make_gazetteer.py  # regenerate place index
.venv/bin/python tools/make_icons.py      # regenerate PWA icons
```

`tsc --noEmit` does not check `.svelte` files — it catches type errors in
`.ts` modules, but Svelte markup bugs only surface at build time (syntax)
or in the browser (behaviour). Verify UI changes in a running preview, not
just green `tsc`/`vitest`.

## `vite.config.ts` — subpath portability

The app is deployed at `https://fairflow.co.uk/astro/`, a subdirectory,
not a domain root, so two settings matter:

- `base: './'` — all built asset URLs are relative, so the same `dist/`
  works unmodified from any subdirectory (or the root).
- `publicDir: 'data'` — the `data/` directory (ephemeris packs, gazetteer,
  text packs, PWA manifest/icons/service worker) is served at the site
  root in dev and copied verbatim into `dist/` on build, so runtime
  fetches (`fetch('gazetteer.json')`, `data/texts/*.json`) work the same
  in dev and prod without path rewriting.

## Build-time plugins in `vite.config.ts`

- **`guardNoServedPersonalData`** — a build-only Vite plugin that walks
  `data/` and fails the build if any file matching `/reactions/i` is
  found. `data/` is `publicDir`, so anything there ships to the public
  site; this exists because a reaction-export file (a named reader's
  comments, collected during the interpretation-content authoring
  workflow) once leaked to the live site this way. Reaction exports
  belong in `authoring/` at the repo root, not under `data/`.
- **`swVersionStamp`** — after build, patches the `VERSION` constant in
  `dist/sw.js` to `astrodynamics-<git-hash-5>` (matching the header build
  tag). `sw.js` is copied verbatim from `publicDir`, so Vite's `define`
  doesn't reach it; this plugin is the only thing that keeps the service
  worker's cache key in sync with the deployed commit. Without it, an
  unhashed data fetch (a text pack, an authoring batch) could stay
  cache-first forever across deploys.
- `__GIT_HASH__` / `__GIT_DATE__` are injected via `define` from
  `git rev-parse HEAD` / `git log -1 --date`, and shown as a build stamp
  in the app header, so a running instance can always be traced to a
  commit.

## Interpretation texts: runtime-fetched, not bundled

`src/interpret/textstore.ts` is the runtime registry for interpretation
content. Texts live in `data/texts/*.json` (`library.natal.json`,
`library.transit.json`, `bodyintro.json`, `glossary.json`) and are fetched
at app startup, not compiled into the JS bundle. This was a deliberate
move (bundle dropped from 131→116 KB gzipped) so that:

- the authored-text library can grow through the authoring/ingest
  pipeline without triggering a rebuild,
- text-pack schema changes stay **additive only** — the loader ignores
  unknown fields, so provenance metadata can ride along safely,
- translations become possible later without touching code.

Until texts load (or for pairs with no authored entry), every consumer
degrades to the template composer — there's no error state, just a
different quality of text.

## Interpretation content pipeline (authoring)

A flag-gated `?author` (or `localStorage astro-author=1`) tab
(`AuthoringView.svelte`) drives a human-in-the-loop workflow for writing
the authored texts referenced above:

- `tools/authoring_sheet.py` generates a batch (currently the sign half of
  "wave 0": 6 sign axes + 12 inflections) as both a Markdown worksheet
  (`authoring/batch-NN.md`) and JSON (`data/authoring/batch-NN.json`).
- Texts are drafted in all four registers per slot.
- A reader works through the batch in-app, marking each slot ✓/~/✗ with a
  comment; reactions export as annotated JSON.
- `tools/authoring_ingest.py --validate` checks the schema and register
  lint; pack-merging accepted texts into `data/texts/*` is a separate,
  not-yet-automated step (`--validate` only, as of this writing).
- `test/authoring.spec.ts` locks the batch schema.

This is a live, partially-built pipeline, not a finished feature — check
`HANDOFF.md` and `docs/plans/` for current wave/coverage status before
extending it.

## Testing invariants worth knowing before you touch things

- `styles-distinct.spec.ts` enforces that the four interpretation styles
  never share a sentence, and that natal/transit/synastry/composite voices
  differ too — don't weaken this test to make a new text pass; rewrite
  the text.
- Every colour in a Svelte component's styles must go through a CSS
  custom property — no hardcoded hex values in `.svelte` style blocks.
  This has caused dark-on-dark/light-on-light illegibility bugs three
  times; grep for hex literals if you're adding UI.
- Saved charts store birth data only; never store computed positions as
  the source of truth (they're recomputed on load).
- Never commit Swiss Ephemeris `.se1` files, real personal/birth data, or
  secrets (a deploy secrets file is referenced by path only, never read
  into the repo or a session transcript).

## Deployment

`dist/` is plain static files — any host works, subdirectory included
(that's what `base: './'` is for). HTTPS is required for the service
worker. This project deploys via SFTP (`tools/deploy_sftp.py`,
credentials external to the repo) to a subdirectory of an existing site;
see `docs/reports/2026-07-05-implementation-and-deployment.md` for the
full stack rationale, licensing notes, and other deployment options
considered.

**Version number and build id.** `buildstamp.ts` gives both builds one
identity: `<version>+<5-hex commit>`, with `.dirty` appended when tracked
files differed from the commit. The app header shows `v<version> · <commit
date> · <hash>` (plus `· dirty`), the standalone Retrograde page shows
`(v<version> · <hash>)`, the service worker's cache key is
`astrodynamics-<hash>`, and `dist/version.json` holds the full record
(version, full hash, date, dirty, id). The version is `package.json`
`"version"`; bump it (`npm version minor --no-git-tag-version`, or patch
for fixes) in every change that will be deployed. `test/version.spec.ts`
checks `package.json` and `package-lock.json` agree. After a deploy,
`tools/check_live.sh [SITE] [COMMIT]` checks that version.json, the
standalone page and sw.js on the live site all carry the expected commit
and version (the deploy workflow runs it with the merge commit).

### Automatic deploy to fairflow.co.uk

`.github/workflows/deploy-sftp.yml` runs on every push to `main` (and on
demand from the Actions tab): `npm ci`, `npm test`, `npm run typecheck`,
`npm run build`, then the same `tools/deploy_sftp.py --delete`, and finally
checks that `https://fairflow.co.uk/astro/` serves the new build. It runs
on GitHub's machines because Claude's cloud sessions cannot reach the
host's SSH port. Credentials are repository secrets, never in the repo:
`SSH_HOST`, `SSH_USER`, `SSH_PASSWORD` (and optionally `SSH_PORT`, default 722, Krystal's SSH port);
the target directory is the repository variable `SSH_REMOTE` (default
`/home/fairtlou/fairflow.co.uk/astro`). Without the secrets the deploy
steps are skipped with a notice. A manual deploy from the Mac (HANDOFF.md)
still works and does the same thing.

### Where the app is deployed

There is one deployment: **fairflow.co.uk/astro**, updated by the workflow
above on every merge to `main` and checked with `tools/check_live.sh`. The
standalone Retrograde page is part of it: `npm run build` also runs
`vite.retro.config.ts`, writing the page as a full document to
`dist/retrograde/index.html`, served at `<app>/retrograde/`. The local test
server (`npm run dev`, port 8322) is restarted on `main` after each merge,
so its header build id matches the live one.

Retired on 2026-10-17, to stop maintaining copies by hand (Matthew's
decision): the claude.ai artifact of the Retrograde page (its two artifact
URLs now show a short page linking to the live one) and the GitHub Pages
copy in the `writing` repo (`/writing/astro/` now redirects to
fairflow.co.uk/astro and unregisters its old service worker). Do not
republish either. `npm run build:retro` still writes the single-file
fragment `dist-retro/retrograde.html`, which is no longer published.

### Server API (`api/`)

PHP beside the app, deployed with it to `fairflow.co.uk/astro/api/`
(design: `docs/DESIGN.md` §5a; beads epic astro-tbb). The build copies `api/`
into `dist/api/`. Endpoints are the top-level `api/*.php`; `api/lib/`,
`api/cli/` and `api/sql/` are refused by `.htaccess` on the host and by the dev
router locally, and `tools/check_live.sh` checks that after every deploy. The
service worker never caches `api/`.

- **Staying signed in:** a session lasts 90 days from its last use and is
  renewed (database row and cookie) at most once a day while in use, so a
  regular user is never signed out. Only signing out, a password change,
  removing the account or 90 days unused end a session; a database or network
  error is a 500 that leaves the cookie and the session alone, and the app
  then says it could not check rather than showing you signed out. The
  database is MariaDB on the same host as the PHP (no tunnel).
- **Config and secrets:** only on the server, in `~/astro-config/db.ini`
  (outside the web root). Locally `ASTRO_DB_INI` points at a SQLite config.
- **Schema:** `api/sql/NNN_*.sql`, portable between MariaDB and SQLite
  (`/*TABLE_OPTIONS*/` is filled per driver). After a deploy that adds one,
  run on the host: `php ~/fairflow.co.uk/astro/api/cli/migrate.php`.
- **Accounts** (no public sign-up yet): on the host,
  `php ~/fairflow.co.uk/astro/api/cli/user.php` with `add|passwd|remove <email>`,
  `admin <email>` / `role <email> user|admin`,
  `state <email> active|paused|frozen|pending`, `delete|undelete <email>`
  (30-day grace), `purge`, or `list`. Locally the password is typed at a hidden
  prompt. The host disables `shell_exec`, so typing cannot be hidden there and
  the command refuses a terminal; pipe the password from your own machine
  instead (`read -s` hides it locally, nothing is stored):
  `read -rs PW && printf '%s\n' "$PW" | ssh -p 722 USER@HOST 'php ~/fairflow.co.uk/astro/api/cli/user.php add you@example.com'; unset PW`
- **From your Mac, without typing the host's SSH details:**
  `.venv/bin/python tools/host_account.py migrate|list|add|passwd|admin|state|mail-test …`
  reads the hosting account's `[ssh]` login from `~/.config/fairflow/hosting.toml`
  (as `tools/deploy_sftp.py` does; readable only by you, never in a repo), asks
  for any new password hidden on your Mac and passes it on standard input.
- **Email** (`api/lib/mail.php`): PHP `mail()` through the host's mail server
  from `noreply@fairflow.co.uk` (envelope sender set with `-f`, so SPF and the
  host's DKIM signature apply; no mailbox password is stored). Under PHP's
  built-in server (`npm run api`, tests) messages are appended to `mail.log`
  beside the config instead (`.local/mail.log` locally), unless the config's
  `[mail]` table sets `transport = mail`. Check delivery from the host with
  `php ~/fairflow.co.uk/astro/api/cli/mail_test.php you@example.com`.
- **Email codes**: 6 digits, 10 minutes, single use, 5 tries, at most 3 per
  address and purpose (10 per IP) per 15 minutes, and at most 20 wrong codes
  per address per day (otherwise fresh codes would allow ~40% a year of
  guessing one); only `sha256(id:code)` is
  stored. Used now for "forgot password" (`reset_request.php`, which answers
  the same whether or not the address has an account, and `reset_confirm.php`,
  which sets the password, ends the account's other sessions and signs in);
  registration and two-step sign-in reuse them (astro-tbb.3, astro-tbb.10).
- **Account states** (DESIGN.md §5a) are enforced in `api/lib/bootstrap.php`:
  only active and paused accounts can sign in or keep a session; endpoints that
  create or change data must call `require_writer()` (refuses paused), admin
  endpoints `require_admin()`. Frozen, pending and deleting end the account's
  sessions at once. Every `me.php` request (each page load) runs
  `housekeeping()`: accounts past their 30 days are purged, and failure/send
  records and email codes older than a day deleted, which is the retention the
  privacy notice promises; sign-in and `user.php purge` also purge accounts.
- **Local development:** `npm run api` (or the `api` entry in
  `.claude/launch.json`) runs PHP's built-in server on :8323 over
  `.local/dev.sqlite` (git-ignored), migrating it first; the Vite dev server
  proxies `/api/` to it. Add a local account with
  `ASTRO_DB_INI=$PWD/.local/dev.ini php api/cli/user.php add you@example.test`.
  Without `npm run api` the app finds no API and hides the Account section.
- **Tests:** `test/api-logins.spec.ts` runs the real endpoints under `php -S`
  over a throwaway SQLite database (skipped when PHP is not installed).

## Contributing

Branch off `main`, open a PR — this repository's own convention is small,
reviewable PRs with `npm test` and `npm run typecheck` clean before
committing. `docs/DECISIONS.md` and `HANDOFF.md` §4 record settled
architectural decisions (ephemeris licensing, no-server/no-accounts,
authored+template interpretation hybrid, CSS-variable theming) — don't
relitigate those without discussing first.
