# Build log — session handoff

Purpose: enough context for a fresh session (human, chat or agent) to
continue this project without re-reading the whole history. Keep this
updated at the end of each working session.

## Snapshot (2026-07-05)

- **Repo**: `~/Projects/private/astro`, remote `github.com/fairflow/astro`
  (private). Branch `main` = user-test baseline; branch `m4-draft`
  (worktree `~/Projects/private/astro-m4`) = M3/M4 draft awaiting review.
- **Run**: `npm install && npm run dev` (:8322). Tests: `npm test`
  (138 green) + `npm run typecheck` (clean). Preview configs in
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

## How to resume

```bash
cd ~/Projects/private/astro   # sessions should be rooted HERE
git status && git log --oneline -5
npm install && npm test && npm run dev
# draft branch: git worktree list  →  ~/Projects/private/astro-m4 (m4-draft)
```
