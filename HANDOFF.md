# HANDOFF — ASTRODYNAMICS (fairflow/astro)

**Last updated:** 2026-07-07 by Fable 5 (evening: wave-0 sign batch authored, PR #10 merged)
**Repo state:** main @ PR #10 — builds clean, `tsc` clean, 165/165 tests green. m4-draft is merged (PR #9); sessions now branch off main (Claude worktree or astro-m4, see §3).
**Deployed:** https://fairflow.co.uk/astro/ @ PR #8 state (main is ahead: authoring tab + authored batch-00 NOT yet deployed — flag-gated, can ship whenever)

## 1. What this project is (3 sentences max)

ASTRODYNAMICS is an offline-first astrology web app (Svelte 5 + TypeScript + Vite PWA): natal charts, transits, synastry and midpoint composites, computed entirely client-side from bundled ephemeris data (astronomy-engine + our own Chebyshev packs fitted to JPL Horizons). It renders an interactive SVG wheel with a hand-built glyph kit and produces psychological interpretations in four registers (Psychological/Mundane/Energy/Minimal) from authored texts + a template composer. All personal data stays in the browser (IndexedDB/localStorage) with file export/import; there is no server component beyond static hosting.

## 2. Current state

- **What works** (each verified this session):
  - Ephemeris core golden-tested against pyswisseph + held-out Horizons samples (`test/golden*`); Placidus houses ≤0.03° vs Swiss Ephemeris.
  - Wheel + bi-wheels (transits, synastry), click-selection of planets/aspects/signs/houses/outer bodies, overlap **chooser** popover, conjunction dot targets.
  - Interpretations: 4 registers, aspect-combination composer with modifiers/markers/practice lines; texts fetched from `data/texts/*.json`.
  - Persistence: saved charts in IndexedDB (birth data only), refresh restores last-cast chart + session, Export/Import JSON backup, `navigator.storage.persist()`.
  - Display: dark/light × contrast low/medium/high × skins (B/W print); print pipeline; wheel export SVG/PNG (self-contained files).
  - PWA offline from second visit; deployed via SFTP to Krystal.
- **What is in progress:**
  - Stage 1c Phase A: scope at `docs/plans/2026-07-06-stage-1c-phase-a-scope.md` (v2 — read it before touching interpretation content). **Built 2026-07-07:** Authoring tab (`AuthoringView.svelte`, flag: `?author` or `localStorage astro-author=1`), `tools/authoring_sheet.py` (generates wave-0 batch: 18 slots), `tools/authoring_ingest.py --validate` (schema + register lint; pack-merge still TODO). **Batch-00 texts are AUTHORED** (PR #10, all four registers, slot ids preserved) — next step is B's reaction session via `?author`, then M's arbitration, then ingest. The house half of wave 0 (batch-01) is not yet generated: `authoring_sheet.py` only implements the sign half, and `AuthoringView.svelte` hardcodes `batch-00.json`.
  - Interlingua experiment: designed in `docs/research/2026-07-07-interlingua.md`, not run.
- **What is broken / known-bad:**
  - Font sizes are px throughout; the rem refactor (needed before the skin builder, issue #2/#3) is not done.
  - Sign-panel tone words ("balancing" etc.) have no tooltips (deliberate cut, may return).
  - Transit list has no significance weighting (orb-only ordering).

## 3. Verification commands (run these FIRST, before changing anything)

```bash
pwd              # work in YOUR session checkout: main (~/Projects/private/astro),
                 # a Claude worktree (.claude/worktrees/*), or astro-m4 — all branch off main now
npm install      # REQUIRED once in a fresh worktree/clone — Vite will NOT load modules
                 # from a parent checkout's node_modules (see PITFALLS, Tooling)
npx tsc --noEmit # expect: silence (clean)
npx vitest run   # expect: "Tests  165 passed (165)" — 15 files
npm run build    # expect: "✓ built in <1s", dist/ updated
```

- **NOTE:** `tsc` does NOT check `.svelte` files — a green `tsc` + green tests does not prove Svelte markup; the build catches syntax, only the browser catches behaviour. Verify UI changes in the preview.
- Dev/preview servers (Claude-Code-session-managed via `.claude/launch.json` in the Finance session, or run manually):
  - main (production build of `~/Projects/private/astro`): `npm run preview --prefix ~/Projects/private/astro -- --port 8324 --strictPort` (build main first).
  - m4-draft preview: `npm run preview --prefix ~/Projects/private/astro-m4 -- --port 8325 --strictPort`; dev server: port 8323.
  - After any rebuild, **reload the browser tab** — `vite preview` serves dist live but an open tab keeps the old bundle (see PITFALLS).
- Deploy (only when asked): `cd ~/Projects/private/astro-m4 && .venv/bin/python tools/deploy_sftp.py --secrets /Users/matthew/Software/working/miolingo/.streamlit/secrets.toml --remote /home/fairtlou/fairflow.co.uk/astro --delete` then `curl -s https://fairflow.co.uk/astro/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` and compare against `dist/assets/`. NEVER print or commit the secrets file's contents.
- Git flow: branch off `main`, push, `gh pr create --base main`; Matthew merges; then ff-sync the checkouts. Local `main` lives at `~/Projects/private/astro`; `astro-m4` (branch `m4-draft`) is the long-lived draft worktree; Claude sessions typically get an ephemeral `.claude/worktrees/*` worktree — after its PR merges, remove it wholesale (`git worktree remove --force <path> && git branch -d <branch>`) so no node_modules cruft accumulates.

## 4. Decisions and rationale (DO NOT RE-LITIGATE)

| Decision | Rationale | Rejected alternatives and why |
|---|---|---|
| Own Chebyshev ephemeris packs (fitted to JPL Horizons) + astronomy-engine; pyswisseph only as dev-time golden oracle | Swiss Ephemeris is AGPL and its data files are non-redistributable; shipping supply chain stays MIT/Apache + public-domain data | Bundling Swiss Ephemeris: licence contamination. Server-side ephemeris: breaks offline-first and privacy |
| All personal data local (IndexedDB/localStorage) + file Export/Import; no accounts | Privacy is the product's promise ("no data leaves this device"); avoids GDPR controller duties; cookies rejected (4 KB, sent to server every request) | Server accounts/sync (issue #1): deferred until multi-device demand is real |
| Interpretation = authored texts (JSON packs) + template composer fallback, four fixed registers | Full authored coverage (~1,800+ texts) is unnecessary — usage is skewed; composer handles combination; packs load at runtime keeping the bundle small | Pure templates: "wooden sameness" (user-tested). Pure authored: unaffordable. LLM at runtime: needs a key proxy, deferred |
| Authoring is axis-first (6 sign axes, 6 house axes, then inflections), per Liz Greene's polarity reading | Bakes B's polarity instinct into structure; halves kernel count; every text names its opposite pole | Author 12 signs/houses independently: polarity left to authorial memory, more slots |
| Theming = CSS custom properties only; themes/contrast as root classes; skins as inline var-map overrides | One mechanism styles every surface incl. SVG; skins beat theme×contrast by specificity for free; groundwork for the skin builder | Per-component colours: caused the light-mode illegibility bugs. CSS-in-JS: needless for this size |

Longer log: `docs/DECISIONS.md`. Do not re-open anything there without Matthew's explicit say-so.

## 5. Invariants — things that must remain true

- `npx tsc --noEmit` clean and 161+ tests green before every commit; golden tests are frozen — a failing golden test means the *change* is wrong, not the test.
- Never commit: Swiss Ephemeris `*.se1` files, real personal/birth data, secrets. The secrets file path is referenced, never read into the repo or transcript.
- Saved charts store **birth data only**; positions are recomputed on load (ephemeris improvements must propagate to old saves).
- Every colour in components goes through a CSS variable — no hardcoded surface/ink colours in `.svelte` style blocks (this bug family has bitten three times).
- `vite.config` `base: './'` and all fetches relative — the app must work from a subdirectory (fairflow.co.uk/astro/).
- Text-pack schema changes are additive only; the loader ignores unknown fields (provenance rides along safely).
- The interpretation registers stay distinct — `styles-distinct.spec.ts` enforces it; don't weaken that test to make a text pass.
- Port 8324 tracks **main**; draft work previews on 8325.
- Wheel/aspect maths lives in pure TS (`src/render/wheel.ts`, `src/chart/*`) — testable without DOM; keep it that way.

## 6. Pitfalls already hit (don't rediscover these)

Top six — full list in `docs/PITFALLS.md`:

- **Symptom:** group/bulk mutation in a Svelte handler only affects the first item → **Cause:** `{@const}` values are *reactive*; a captured `!allOn` flips mid-loop → **Fix:** compute the target into a plain local once inside the handler.
- **Symptom:** UI change invisible / stale behaviour despite rebuild → **Cause:** `vite preview` serves new dist but the open tab still runs the old bundle → **Fix:** reload the tab; confirm bundle hash matches `dist/assets/`.
- **Symptom:** dark-on-dark (or invisible) text in light theme → **Cause:** hardcoded colour inside a component's scoped styles → **Fix:** theme variable (see Invariants); grep for `#1c2340`-style hexes in `.svelte` files.
- **Symptom:** degrees shown as `23°60′` → **Cause:** rounding minutes without carrying into degrees → **Fix:** round total arc-minutes first (`fmtDegInSign`/`fmtOrb` do this; don't add new formatters).
- **Symptom:** `bd` (beads) acts on the Finance project's issues → **Cause:** Finance-rooted Claude sessions export `BEADS_DIR=…/Finance/.beads`, pinning bd regardless of cwd (NOT global binding — normal terminals discover per-repo `.beads/`) → **Fix:** `env -u BEADS_DIR bd …` from such sessions; astro has its own workspace (prefix `astro`) since 2026-07-07. Details + worktree caveat in PITFALLS.
- **Symptom:** in a fresh worktree, vitest fails to load a package the main checkout has → **Cause:** the worktree has no `node_modules`; Node resolution walks up to the parent checkout's copy but Vite refuses modules above the worktree root → **Fix:** `npm install` in the worktree; remove the whole worktree after merge.

## 7. Next actions (each sized for ONE session by a weaker model)

1. [x] **Authoring tab skeleton** — done 2026-07-07 (Fable): flag-gated `AuthoringView.svelte`; verified in browser: tab appears with flag, 18 slots, reactions + comments persist across reload, export downloads annotated JSON.
2. [x] **`tools/authoring_sheet.py`** — done 2026-07-07 (Fable): `--wave 0` writes the sign half of wave 0; `authoring_ingest.py --validate` passes; schema locked by `test/authoring.spec.ts`.
3. [x] **Wave 0 sign drafting (batch-00)** — done 2026-07-07 (Fable, PR #10): all 18 slots authored in four registers, straw-man flags removed, slot ids preserved so B's saved reactions stay valid. Register recipe that worked: psychological = archetype + how the disowned pole returns; mundane = concrete life, corrective as observation not sermon; energy = element × modality as current metaphor; minimal = two fragments. **Awaiting B's reaction session** (human-in-loop, not agent work) → M arbitration → ingest.
4. [ ] **rem refactor** (astro-b6k, unblocks skin builder): convert `app.css` font-sizes to rem with a single root size, keep `--ts` scaling working. — *Done when:* visual spot-check at textScale 100%/130% matches before/after screenshots, tests green.
5. [ ] **Tone-word tooltips** (astro-nhf): add `data-tip` for the three SIGN_TONE keywords per sign (needs a 36-entry tip table in `vocab.ts`). — *Done when:* hovering each tone word in the sign panel shows a tip; tests green.
6. [ ] **Batch-01 generation** (house half of wave 0): extend `authoring_sheet.py` (6 house axes + 12 inflections, straw men from HOUSE_ARENA), extend `test/authoring.spec.ts`, give `AuthoringView.svelte` batch selection (it hardcodes `batch-00.json`). Generation is any-model work; the *drafting* that follows is Fable-only.
7. [ ] **`authoring_ingest.py` pack-merge**: merge accepted texts into `data/texts/*` with provenance; needs a decision on where sign-axis/inflection texts render in the app (no surface consumes them yet).
8. [ ] *(Fable session, not Sonnet)* Batch-01 house drafting, after action 6.
9. [ ] *(Fable session, not Sonnet)* Interlingua experiment as specified in `docs/research/2026-07-07-interlingua.md`.

(Tracking: **beads, prefix `astro`** — workspace in the MAIN checkout `~/Projects/private/astro`; worktrees resolve it automatically when `BEADS_DIR` is unset. astro-0de = the batch-00 loop (in progress, drafting done, closes after ingest); astro-b6k (rem), astro-nhf (tone tips), astro-484 (batch-01 generation, action 6), astro-36p (pack-merge, action 7 — blocks astro-0de), astro-vel (interlingua). GitHub issues #1–#5 predate beads and remain until migrated; print (#4) and export (#5) shipped 2026-07-07 and can be closed. From a Finance-rooted session use `env -u BEADS_DIR` — see Pitfalls.)

## 8. Out of scope / deferred (so the model doesn't wander)

- NO server component, accounts, or sync (issue #1 is deliberately deferred).
- NO runtime LLM calls (enrichment layer waits on a key-holding proxy decision).
- Do NOT extend the interpretation dimensions beyond the scope doc's queue (the queue is the contract; additions go to the END of a wave).
- Do NOT touch the OFX/QIF legacy code (different project — Finance repo).
- Do NOT redesign the wheel geometry or glyph kit; extend `wheelGeometry` only.
- Skin *builder* (#3) waits on the rem refactor; only the var-map mechanism exists.
- Composite charts keep context re-voicing — no bespoke composite text corpus.
