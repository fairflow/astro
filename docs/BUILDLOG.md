# Build log — session handoff

Purpose: enough context for a fresh session (human, chat or agent) to
continue this project without re-reading the whole history. Keep this
updated at the end of each working session.

## Snapshot (2026-07-06)

- **Repo**: `~/Projects/private/astro`, remote `github.com/fairflow/astro`
  (private). **`m4-draft` merged into `main` 2026-07-06** after field
  verification (Comet, offline included); the branches are level — new
  drafts can reuse the `~/Projects/private/astro-m4` worktree.
- **Deployed**: https://fairflow.co.uk/astro/ (Krystal, SFTP via
  `tools/deploy_sftp.py`; credentials external to the repo). Redeploy:
  `npm run build` then the deploy tool — see README.
- **Run**: `npm install && npm run dev` (:8322). Tests: `npm test`
  (147 green) + `npm run typecheck` (clean). Preview configs in
  `.claude/launch.json`.
- **Tracker**: GitHub issues #1–5 (users/sync, skins, skin builder,
  print, wheel export). bd/beads on this machine binds to the Finance
  workspace — not usable here yet.
- **Design of record**: `docs/DESIGN.md`. Research notes with sources:
  `docs/research/`. Improvement plans: `docs/plans/`.

## What exists, by milestone

1. **Design + mockup** (`docs/DESIGN.md`, `mockup/chart.html`) —
   platform review (chose local-first PWA), ephemeris/licensing
   strategy, interpretation-engine design incl. aspect-combination
   composer and contradiction surfacing.
2. **M1 compute core** (`src/ephemeris/`, `src/chart/`, `tools/`,
   `data/packs/`, `test/golden/`) — astronomy-engine provider (Sun–Pluto,
   ≤0.03° vs Swiss Ephemeris), Chebyshev packs fitted to JPL Horizons
   for Ceres/Pallas/Juno/Vesta/Chiron/Eris (≤0.01° vs held-out samples,
   1900–2100), analytic mean Node + Lilith (incl. the
   reduction-to-ecliptic term Swiss Ephemeris uses), Placidus houses
   (≤0.03°, Porphyry above polar circles), aspects with standard orbs,
   `computeChart()`. Python tools regenerate packs/goldens.
3. **M2 app** (`src/ui/`, `src/store/`, `src/render/`) — Svelte 5 + Vite
   PWA-to-be: birth form with offline GeoNames gazetteer (34k places,
   IANA zone resolved at the birth instant incl. historical rules), SVG
   natal wheel (orb→opacity, partile glow, retro marks, selection
   dimming), Dexie saved charts (birth data only; recompute on load).
4. **Visibility + M3** — own tunable SVG glyph kit (`render/glyphset.ts`,
   review page `/?glyphs`), Display menu (glyph size/weight/slant, text
   size, high contrast; localStorage), fullscreen expand with info
   flyout; interpretation engine (`src/interpret/`): 19-theme vectors,
   composer (modifiers: reinforces/eases/complicates), tension report,
   4 styles, authored library for 8 key pairs, template fallback,
   dossiers: Chiron wound, Saturn (exact return dates), Sun–Moon
   (lunation phase), career (7e), relationships (7d).
5. **M4 draft** (branch `m4-draft`) — `src/chart/relate.ts`
   (cross-chart aspects, transit orbs, midpoint composite, Ebertin
   midpoint contacts, house overlays), per-context reading voices
   (natal/transit/synastry/composite — distinctness is test-enforced),
   authored transit library (Saturn/Jupiter/Uranus/Pluto/Chiron → Sun,
   Moon), mode tabs: Transits (separate wheel, date picker, landmark
   badges, sky-vs-natal lists), Synastry (inter-aspects, overlays,
   Ebertin contacts, 7d synastry dossier), Composite (wheel + usage
   help). UX-fix commit from 2026-07-05 review (save dedupe,
   delete-confirm, print stub, text size).

## Who wrote the interpretation texts

- `AUTHORED` = original prose written by the AI assistant (Claude)
  during development, committed in `src/interpret/library.ts` and
  `contexts.ts`; curation/approval by Matthew pending — see
  docs/plans stage-1 plan for the review loop.
- `TEMPLATE` = assembled at runtime from keyword tables
  (`templates.ts`, `vocab.ts`).
- `COMPUTED` = numeric facts (positions, dates, overlays).

## Known state / gotchas

- User localStorage may carry display settings from testing.
- Transit list could use a significance filter; synastry/composite
  readings are template-tier.
- Composite uses the "midpoints" method (cusp midpoints); the
  reference-place / derived-ASC method is a planned option.
- First user test (Benita, 2026-07-05) → see
  `docs/plans/2026-07-05-usertest-stage1.md` for findings and plan.
  **Stages 1a+1b implemented on m4-draft** (styles genuinely distinct —
  test-enforced; "Jungian"→"Psychological"; style-echo header + fade;
  house shading/numerals/cusp degrees on the wheel; H numbers in all
  readouts; body introductions incl. Eris; clickable signs with sign
  cards; Jupiter glyph redrawn; glossary accordion + term tooltips).
  Stage 1c (content pipeline) deliberately deferred: phase A = 3-way
  authoring dialogue (Claude/Benita/Matthew) building fragments +
  combination engine; phase B = burn into deployable field-test app.
  Part 2 of the transcript still to come.

## Later on 2026-07-05 (same day, evening)

- ASTRODYNAMICS rename; part-2 user-test fixes (template variety,
  practice lines, markers, Copy-for-AI natal + synastry, full-width
  dossiers); IFS narration model doc (docs/plans/); bi-wheels
  (natal+transits, natal+synastry); transits-to-couple view
  (composite bi-wheel, three lists, S/M dial hits).
- Implementation & deployment report for the designer:
  `docs/reports/2026-07-05-implementation-and-deployment.md`
  (stack explained, licences, complexity audit, deployment options;
  headline actions: move interpretation texts to fetched JSON packs
  before phase-B authoring volume; add service worker (M5)).

## 2026-07-06

- Report follow-ups done: (1) interpretation texts moved out of the JS
  bundle into fetched packs `data/texts/*.json` (library.natal,
  library.transit, bodyintro, glossary) via `interpret/textstore.ts`
  (template fallbacks until loaded; tests validate the shipped JSON via
  `test/setup.ts`); bundle 131→116 KB gz. (2) PWA layer: manifest,
  icons (tools/make_icons.py, Pillow), hand-rolled service worker
  (`data/sw.js`: network-first navigations, cache-first assets/data),
  registered in prod builds only. Verified on `vite preview`: SW
  active, second visit fully cached (JS/CSS/packs/gazetteer/texts) —
  installable, offline from second visit.

## How to resume

```bash
cd ~/Projects/private/astro   # sessions should be rooted HERE
git status && git log --oneline -5
npm install && npm test && npm run dev
# draft branch: git worktree list  →  ~/Projects/private/astro-m4 (m4-draft)
```
