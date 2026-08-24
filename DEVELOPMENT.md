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

# Python tooling (one-off / regeneration), from a venv:
python3 -m venv .venv && .venv/bin/pip install pyswisseph numpy pillow
.venv/bin/python tools/golden_refs.py     # regenerate golden references
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

## Contributing

Branch off `main`, open a PR — this repository's own convention is small,
reviewable PRs with `npm test` and `npm run typecheck` clean before
committing. `docs/DECISIONS.md` and `HANDOFF.md` §4 record settled
architectural decisions (ephemeris licensing, no-server/no-accounts,
authored+template interpretation hybrid, CSS-variable theming) — don't
relitigate those without discussing first.
