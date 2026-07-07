# DECISIONS — append-only log

Convention: newest entries at the bottom. Each entry: date, decision,
rationale, rejected alternatives. Do not edit old entries; supersede them
with a new one that references the old.

---

## 2026-07-02 — Platform: web-first PWA, Svelte 5 + TypeScript + Vite

**Decision:** Build as an installable, offline-capable web app; native iPadOS/Android deferred indefinitely.
**Rationale:** One codebase testable on the MacBook, deployable to cheap static hosting, installable on tablets; Svelte 5 runes give fine-grained reactivity with tiny bundles (~120 KB gz total).
**Rejected:** Native apps (two more codebases, store friction); React (heavier, no benefit at this scale); server-rendered anything (kills offline + privacy).

## 2026-07-02 — Ephemeris: astronomy-engine + own Chebyshev packs; pyswisseph as dev-only oracle

**Decision:** Planets from astronomy-engine (MIT); Chiron/Ceres/Pallas/Juno/Vesta/Eris from our own Chebyshev packs (128-day segments, degree 16) fitted to JPL Horizons; Node/Lilith analytic (Meeus + reduction term). pyswisseph (AGPL) used only in dev tooling to generate golden tests; Swiss Ephemeris data files never committed.
**Rationale:** AGPL must not ship; Swiss data files are non-redistributable; packs reach ≤0.01° vs held-out Horizons which is far below interpretive significance.
**Rejected:** Bundling Swiss Ephemeris (licence); calling an ephemeris API (offline broken, privacy broken); Moshier-only (no asteroids).

## 2026-07-03 — Houses: Placidus with Porphyry polar fallback

**Decision:** Placidus semi-arc iteration; above polar circles fall back to Porphyry and label the chart accordingly.
**Rationale:** Placidus is the de-facto standard users expect; it is undefined at high latitudes and a labelled fallback is more truthful than NaNs.
**Rejected:** Whole-sign default (users asked for Placidus); Koch (no added value, same polar problem).

## 2026-07-03 — Interpretations: hybrid authored + template with a combination composer, four fixed registers

**Decision:** Authored texts (JSON packs) where readers land most; template generation elsewhere; a composer layers aspect-interaction modifiers (reinforces/eases/complicates), tension report, markers, practice lines. Registers: Psychological (id `jungian`), Mundane, Energy, Minimal — distinctness test-enforced.
**Rationale:** Field testing (Benita) showed pure templates read as "wooden sameness", while full authored coverage is combinatorially unaffordable; the composer must make texts respond to each other (M's original requirement).
**Rejected:** Pure templates; pure authored; runtime LLM (needs key proxy — separate, deferred decision).

## 2026-07-05 — Texts move out of the JS bundle into fetched JSON packs

**Decision:** `data/texts/*.json` fetched at runtime via `textstore.ts`, template fallback until loaded; tests validate the shipped JSON.
**Rationale:** Phase-1c authoring volume must not bloat the bundle; content editable without rebuild; packs cache offline via the service worker like other data.
**Rejected:** Imports compiled into the bundle (rebuild per text edit, bundle growth).

## 2026-07-05 — PWA: hand-rolled service worker; deploy = static SFTP to Krystal

**Decision:** `data/sw.js` (network-first navigations, cache-first hashed assets), registered in prod builds only; deploy with `tools/deploy_sftp.py` (paramiko, secrets outside the repo); `base: './'` so the app lives in a subdirectory.
**Rationale:** Workbox adds a dependency for ~60 lines of logic; Krystal hosting already paid for; relative base keeps hosting portable.
**Rejected:** Workbox; Netlify/Vercel (new accounts/DNS for no gain).

## 2026-07-06 — All personal data local; Export/Import file is the portability story

**Decision:** Saved people in IndexedDB (Dexie), birth data only (positions recomputed on load); working state in localStorage; durable-storage request; JSON export/import for backup and cross-device moves. No accounts (issue #1 deferred).
**Rationale:** Privacy promise in the footer is load-bearing; cookies wrong tool (4 KB, transmitted every request, DP posture); recompute-on-load lets ephemeris fixes reach old saves.
**Rejected:** Cookies; server accounts/sync; pinned computed positions (only if a concrete need appears — issue #5 discussion).

## 2026-07-06 — Theming: CSS custom properties only; theme×contrast as root classes; skins as inline var-maps

**Decision:** Palettes defined on `:root` (+ `.light`, `.cmed`, `.chigh` combinations); a *skin* is a named var-map applied inline on `<html>` (`ui/skins.ts`), overriding everything; B/W print skin first.
**Rationale:** One mechanism covers HTML and SVG; inline style beats class specificity for free; the var-map IS the future skin-builder format. Three separate light-mode illegibility bugs all traced to colours bypassing variables.
**Rejected:** Per-component colour literals (the bug source); CSS-in-JS; separate print stylesheet duplicating the palette.

## 2026-07-06 — Git/deploy workflow: m4-draft worktree → PR → M merges; 8324 tracks main

**Decision:** All work on `m4-draft` (worktree `~/Projects/private/astro-m4`), pushed and PR'd to `main`; Matthew merges; port 8324 always serves main's production build, 8325 the draft preview.
**Rationale:** M wants review visibility and a clean main; the port split makes "what is merged" visually checkable.
**Rejected:** Committing straight to main (no review point); long-lived feature branches (single-developer overhead).

## 2026-07-07 — Aspect selection UX: disambiguation chooser (option A); conjunctions as dots

**Decision:** A click near several overlapping aspect lines opens a popover listing all candidates; conjunctions render a midpoint dot with a generous hit disc and join the chooser. Planet-first hit-widening kept. No hover-dependent scheme.
**Rationale:** Conjunction chords are near-zero-length and buried under sibling lines — geometrically unclickable; the chooser is the only option that stays honest on touch screens; M explicitly rejected mode-dependent (SketchUp-style) interaction and dropped hover (option C) for non-uniform UX.
**Rejected:** Click-cycling (undiscoverable, breaks re-click-to-deselect); hover-only disambiguation (no touch); modes.

## 2026-07-07 — Stage 1c Phase A: houses & signs join the corpus; axis-first authoring (Greene)

**Decision:** Author sign-axes and house-axes first (6+6 kernels, then 12+12 inflections), then bodies-in-signs and bodies-in-houses for luminaries and personal planets; polarity structural (every text names its opposite pole). B reacts via an in-app Authoring form (✓/~/✗ + comment, Next/Back), never raw markdown. Scope: `docs/plans/2026-07-06-stage-1c-phase-a-scope.md` (v2).
**Rationale:** B reads charts through houses and polarities — the corpus was missing the dimension entirely; axes halve the kernel count and encode polarity; the form respects B's non-technical workflow.
**Rejected:** 12 independent sign/house texts (polarity by memory); markdown hand-editing by B; authoring (body,sign,house) triples (2,592 slots/style — composed from parts instead).

## 2026-07-07 — Interlingua: evaluate frames+RST via one blind experiment; adopt process-calculus laws as tests

**Decision:** Per `docs/research/2026-07-07-interlingua.md`: one timeboxed experiment (3 authored pairs re-encoded as predicate trees + register realizers, B judges blind). Independent of outcome, adopt composition laws (order-invariance, idempotence of repeated tensions) as property tests. Phase A does not block on it.
**Rationale:** The engine already has a proto-interlingua (theme vectors, typed modifiers); realization is the weak layer; M's process-calculi framing contributes laws rather than syntax.
**Rejected:** Full MTT/SFG realizer stacks (too heavy); embedding blends (uninspectable, unlintable).
