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

## Later on 2026-07-06 (usability + themes)

- Usability trio (commit 6d3709c): cross-tab session persistence
  (`ui/session.svelte.ts` — partner + transit date/time/target survive
  mode switches); Settings flyout (`ui/prefs.svelte.ts` +
  `SettingsControls.svelte` — body groups Inner/Outer/Minors with
  Sun/Moon locked, aspect toggles e.g. drop quincunx, applied through
  every compute path incl. transits/synastry/composite; dossiers
  degrade gracefully when a body is off); edit saved people in place
  (`updateChart` + Update/Save-new buttons with dirty detection).
- House prominence + themes: house numerals now drawn on gold-ringed
  discs on top of the hub circle (they were painted underneath it);
  cusp degree labels on the wheel; intermediate cusp lines heavier
  (gold-dim 1.3/0.8); `--houseband` alternating fills. Theme picker
  (Dark / High contrast / Light) replaces the high-contrast checkbox —
  `display.theme` with localStorage migration from the old `contrast`
  boolean; `:root.light` palette in app.css (parchment bg, darker
  aspect colours, light hub/bands).
- Bug fix: degree-minute formatting carried wrongly at rounding
  boundaries — ASC showed `23°60′`. `fmtDegInSign`/`fmtOrb` now round
  total arc-minutes first (24°00′, rolls sign/360° correctly);
  regression tests in `test/format.spec.ts`. 157 tests green.

## Later again on 2026-07-06 (contrast axis + house selection)

- High contrast made an independent axis: Display menu now has Theme
  (Dark/Light) + Contrast (Normal/High) rows. `display.hc` boolean;
  storage migrates both the original `contrast` flag and the interim
  `theme:'hc'` value. New `:root.light.hc` palette — much darker lines
  (#7d7357), near-black ink, deeper aspect colours for ageing eyes;
  per-theme+contrast aspect-opacity floors.
- House selection: clicking a house numeral on the wheel selects the
  house (`{kind:'house', num}`), lighting its tenant bodies and only
  the aspects touching them (analogous to sign selection); panel shows
  cusp degree, HOUSE_ARENA text, tenants, and the touching aspects;
  expanded-wheel flyout gets the same. Sign/body/aspect selection
  regressions checked in the browser.

## Later still on 2026-07-06 (three minors)

- `--on-gold` variable (dark navy on light gold in dark themes, white
  on dark gold in light themes) replaces every hardcoded on-gold text
  colour — selected buttons (Theme/Contrast pickers, mode tabs, style
  picker, "Your chart"/"The couple", Cast chart, print dialog) are now
  readable in all four theme×contrast combinations.
- New `ExpandableWheel.svelte` wraps Wheel with the ⤢ Expand button,
  the fullscreen overlay, and a caption card; used by the natal view
  (keeps its OverlayInfo flyout via snippet), TransitsView (both
  wheels), SynastryView, CompositeView — expand now available on every
  wheel.
- Expanded wheels show a caption: name, born date/time, place, and a
  freshly-stamped "cast <date time>" line; transits add the sky date,
  synastry/composite name both people with their birth data.

## 2026-07-06 afternoon (persistence + UX batch)

- Persistence: last-cast birth data + session (partner, transit
  date/target) survive refresh via localStorage — the app re-casts on
  load; `navigator.storage.persist()` requested (eviction protection);
  Export…/Import… buttons in the Saved menu write/read a JSON backup
  file (duplicates skipped on import) — the cross-browser/device path.
  Saved charts were already permanent (IndexedDB via Dexie).
- Contrast now three levels (Low/Medium/High) × theme: root classes
  cmed/chigh; new dark-high and light-high palettes (light-high =
  near-black hued lines, ink #000); per-level aspect opacity floors;
  storage migration chain v1 contrast-bool → v2 theme:'hc' → v3
  hc-bool → v4 contrast level.
- Aspect pick UX: selecting a planet widens ITS aspects' hit strokes
  to 30px (round caps; dimmed aspects shrink to 7px) — conjunctions
  clickable at last; house numerals painted last so their discs sit
  above radiating aspect lines (inhabited-house clicks no longer
  steal); outer-ring (transit/partner) glyphs clickable — lights that
  body's cross aspects and the natal bodies it touches (wired in
  Transits both wheels + Synastry); cross lines also dim to match
  body/house/sign selection.
- Lists: natal aspect list gains H-column (H1·H10) before orb;
  CrossAspectList gains aHouse/bHouse lookups (synastry both sides,
  transits natal side).
- Settings flyout: group headers larger (gold, 13.5px) each with a
  tri-state group checkbox (all/none/indeterminate; Sun/Moon stay
  locked).

- Fix: selected/hover rows in CrossAspectList (and dropdown/saved-item
  hovers, transit landmark badges) had hardcoded dark backgrounds —
  illegible dark-on-dark in light mode. New `--rowhover`/`--rowsel`/
  `--badgebg` variables per theme replace all hardcoded surfaces.

## Overnight 2026-07-06 → 07 (issues #2/#4/#5, chooser, servers, 1c-A scope)

- Servers: 8324 now serves MAIN's production build (`astro-main` in
  launch.json); m4-draft preview moved to 8325 (`astro-m4-preview`);
  8323 stays the m4 dev server; stale astro-dev/astro-mockup removed.
- Aspect chooser (UX option A): a click near several overlapping lines
  pops a menu at the pointer listing every candidate (glyphs + orb,
  natal + cross lines) — pick one, Escape/click-away dismisses.
  Conjunctions now draw a dot at the chord midpoint with a 14-unit hit
  disc, and land in the chooser like any line (their chord sits under
  every other line of the same bodies — previously unclickable).
  `distToSegment` in render/wheel.ts, tested (test/geometry.spec.ts).
- Skins (#2, first slice): `ui/skins.ts` — a skin is a var-map applied
  inline on <html> (beats theme × contrast). B/W print skin shipped;
  Display menu gains Skin row (Theme / B/W print). Header gradient
  moved to `--header-top` so skins/themes control it. rem refactor
  still pending (issue notes it).
- Print pipeline (#4): real dialog — "Print black on white" swaps to
  the B/W skin for the job and restores after (afterprint), "Print as
  shown" available with an ink warning in dark mode; @media print CSS
  hides app chrome. Stub text gone.
- Wheel export (#5): SVG/PNG buttons beside ⤢ Expand on every wheel.
  `render/export.ts` serialises a standalone SVG (glyph symbols
  inlined from GlyphDefs, theme vars resolved onto the root, bg rect,
  hit-zones stripped — verified 30 symbols, self-contained) and
  rasterises PNG at 2×. Filenames `wheel-<who>-<date>`.
- Stage 1c Phase A scoped: docs/plans/2026-07-06-stage-1c-phase-a-scope.md
  (coverage measured: 8/153 natal pairs authored; wave plan, three-way
  batch protocol, worksheet format, ingest tooling, gate criteria).

## 2026-07-07 morning (scope v2 + UX round)

- Scope doc rewritten (v2): houses & signs are first-class authoring
  dimensions (1a bodies-in-houses, 1b bodies-in-signs, 1c combination
  rule, 1d existing assets); building principles follow Liz Greene —
  axis-first authoring (6 sign axes + 6 house axes + inflections) so
  polarity (B's Scorpio→Taurus instinct) is structural; revised sizing
  (~380 kernels total, wave 0 = the frame); B's in-app Authoring tab
  specified (one slot per screen, ✓/~/✗ + comment, Next/Back,
  localStorage, export; ?author flag now, admin later). Terminology
  answered in-doc (pair/class).
- Interlingua research note (docs/research/2026-07-07-interlingua.md):
  frames + RST realizers recommended; MTT lexical functions for
  paraphrase variety; process-calculus laws as property tests; one-
  evening blind experiment defined (regenerate 3 authored pairs from
  trees, B judges blind); Phase A does not block on it.
- UX: instant CSS tooltips ([data-tip], no browser title delay) on sign
  panel element/modality/ruler + aspect class/phase; aspect list shows
  strongest 5 with "Show all N" (auto-expands if a selection is deeper);
  orb legend removed (glossary covers it); Settings group checkboxes
  now plain two-state (all on / all off).
- Bug: group toggle only affected the first body — Svelte 5 {@const} is
  REACTIVE, so `!allOn` flipped mid-loop after the first assignment
  (also the cause of yesterday's "random body" test artifacts). Fix:
  compute the target once inside the handler.

## 2026-07-07 afternoon (handoff stress test: §7 actions 1–2 executed)

- HANDOFF.md convention applied (PR #8) and then STRESS-TESTED by
  executing its own next-actions 1–2 exactly as written:
  - `tools/authoring_sheet.py --wave 0` → `authoring/batch-00.md` +
    `data/authoring/batch-00.json` (6 sign axes + 12 inflections,
    straw-man texts extracted from SIGN_TONE); `tools/
    authoring_ingest.py --validate` (schema + register lint; pack
    merge TODO); schema locked by test/authoring.spec.ts (165 tests).
  - `AuthoringView.svelte`: flag-gated Authoring tab (?author /
    localStorage astro-author=1) — slot-per-screen, ✓/~/✗ + comment,
    Next/Back + progress dots, reactions persist in localStorage,
    Export downloads annotated JSON. Browser-verified end to end.
- Two fresh pitfalls hit and logged: render-time lazy state creation
  throws uncaught state_unsafe_mutation (component stuck on loading,
  nothing in console); bind:value cannot target a function call
  (vite-build-only error). HANDOFF/PITFALLS updated; template at
  ~/claude/HANDOFF-template.md genericised (named tracker, Deployed
  line, document-reality naming rule).

## How to resume

```bash
cd ~/Projects/private/astro   # sessions should be rooted HERE
git status && git log --oneline -5
npm install && npm test && npm run dev
# draft branch: git worktree list  →  ~/Projects/private/astro-m4 (m4-draft)
```
