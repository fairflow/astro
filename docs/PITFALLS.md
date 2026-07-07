# PITFALLS — failure modes already hit

Format: **Symptom → Cause → Fix.** Add new entries at the bottom of the
relevant section. If you hit one of these again, the fix is here — do not
re-derive it.

## Svelte 5 / TypeScript

- **Symptom:** a bulk mutation in an event handler only affects the first item (e.g. "group checkbox turns off one body"); repeat runs flip seemingly random items. → **Cause:** `{@const}` template values are **reactive**; a handler capturing `!allOn` sees it flip mid-loop after the first assignment changes the state it derives from. → **Fix:** compute the target into a plain local variable once at the top of the handler, then loop. (Bit us 2026-07-07; also retro-explains "random body" flips during 2026-07-06 testing.)
- **Symptom:** `tsc --noEmit` green but the app breaks at runtime after a `.svelte` edit. → **Cause:** `tsc` does not check `.svelte` files; only `vite build` (syntax) and the browser (behaviour) do. → **Fix:** treat browser verification as part of "tests green" for any Svelte change.
- **Symptom:** `DataCloneError` when saving to IndexedDB. → **Cause:** Svelte `$state` proxies are not structured-cloneable. → **Fix:** `$state.snapshot(value)` before `db.*.add/put`.
- **Symptom:** a menu/dialog "did not open" when scripted, or double-toggles. → **Cause:** Svelte flushes DOM asynchronously — code that clicks and then queries in the same tick reads the pre-flush DOM. → **Fix:** separate the click and the assertion (two evals / await a tick).
- **Symptom:** a component sticks on its loading state with NO console error, though its data fetch returns 200. → **Cause:** an uncaught `state_unsafe_mutation` aborts the render — a template expression called a helper that lazily *created* missing state (`obj[id] ??= {…}`); renders must not write state. → **Fix:** split read/write helpers — reads return a shared immutable default; only event handlers materialise entries. Instrument with `window.addEventListener('error', …)`; these errors don't show in normal console logs. (Hit in AuthoringView 2026-07-07.)
- **Symptom:** build error `bind_invalid_expression` on an `<input bind:value={…}>`. → **Cause:** `bind:` targets must be identifiers/member expressions — not a function call like `rx(id).comment`. → **Fix:** `value={…}` + `oninput` handler (or a `{get, set}` pair). Caught only by `vite build`, not tsc or vitest.

## Formatting & maths

- **Symptom:** degrees render as `23°60′`. → **Cause:** arc-minutes rounded independently of degrees (no carry; sign/360° boundaries also affected). → **Fix:** round total arc-minutes first, then split — `fmtDegInSign`/`fmtOrb` in `render/glyphs.ts` are the only sanctioned formatters; regression tests in `test/format.spec.ts`.

## Theming / CSS

- **Symptom:** dark-on-dark or invisible text, but only in light themes (selected rows, badges, header band…). → **Cause:** a colour hardcoded in a component's scoped `<style>` or in `app.css`, bypassing the palette variables. → **Fix:** add/reuse a `--var` in every `:root` palette and reference it; grep `.svelte` files for hex literals when adding surfaces. (Hit three separate times: selected cross-aspect rows, on-gold button text, header gradient.)
- **Symptom:** native tooltips feel absent. → **Cause:** browser `title` tooltips have a fixed ~1 s delay, not configurable. → **Fix:** `[data-tip]` CSS tooltips (instant) — mechanism already in `app.css`.

## Wheel / SVG

- **Symptom:** an aspect (especially a conjunction) cannot be clicked no matter how precise the pointer. → **Cause:** its line is near-zero-length and *underneath* the hit strokes of every other aspect sharing its endpoints; SVG hit-testing is paint-order, last-painted wins. → **Fix:** the chooser popover + conjunction hit-dots (2026-07-07); when adding new interactive layers, remember paint order = z-order (house numerals are painted last for exactly this reason).
- **Symptom:** exported/standalone SVG renders without glyphs. → **Cause:** `<use href="#…">` targets live in a *separate* hidden `GlyphDefs` SVG and CSS vars resolve against the page, not the file. → **Fix:** `render/export.ts` inlines referenced symbols and bakes resolved variables onto the root element — use it, don't re-serialize by hand.

## Data & storage

- **Symptom:** "all my saved charts vanished". → **Cause:** IndexedDB/localStorage are **per-origin** — localhost:8323/8324/8325 and fairflow.co.uk are four separate stores; private windows and "clear site data on close" also wipe. → **Fix:** expected behaviour — use Export/Import to move people between origins; `navigator.storage.persist()` already requested.

## Build / preview / deploy

- **Symptom:** a verified fix "doesn't work" in the preview. → **Cause:** `vite preview` serves the new dist, but the already-open tab still runs the old bundle — or the tab points at a different port entirely (8324 = main, 8325 = draft). → **Fix:** reload the tab and confirm the loaded `index-*.js` hash matches `dist/assets/`. (Caused a false "persistence failure" diagnosis on 2026-07-05.)
- **Symptom:** installed PWA shows stale content after deploy. → **Cause:** service worker serves cache; new SW activates on next load. → **Fix:** expected — second load gets the new version; `.htaccess` already sets no-cache on `sw.js`/`index.html`, immutable on hashed assets.
- **Symptom:** `manifest.webmanifest` served as `application/octet-stream` on Krystal. → **Cause:** Apache lacks the MIME type. → **Fix:** already in `data/.htaccess` (`AddType application/manifest+json .webmanifest`) — keep it when touching that file.

## Tooling / environment

- **Symptom:** `bd` (beads) commands read/write the WRONG project's issues (e.g. Finance issues listed from inside astro; `bd init` aborts with "already initialized" pointing at Finance). → **Cause:** NOT global binding (disproved 2026-07-07 — miolingo runs its own workspace fine). Claude Code sessions rooted in the Finance project export **`BEADS_DIR=…/Finance/.beads`**, which pins every bd call in that session's shells regardless of cwd. → **Fix:** in such a session, prefix with `env -u BEADS_DIR` (and `cd` to the target repo); in a normal terminal bd discovers the repo's own `.beads/`. astro's workspace was initialized 2026-07-07 (`--prefix astro`). **Worktree caveat:** `.beads/` lives in the MAIN checkout (`~/Projects/private/astro`); in the `astro-m4` worktree bd needs a `.beads/redirect` file or `BEADS_DIR` pointing at the main checkout's `.beads`.
- **Symptom:** git shows a committed `.venv` symlink. → **Cause:** gitignore pattern `.venv/` does not match a *symlink*. → **Fix:** pattern is now `.venv` (no slash); worktrees need the symlink re-created (`ln -sfn <venv> .venv`).
- **Symptom:** in a fresh worktree, `vitest` fails with `Failed to load url …/astro/node_modules/<pkg>/…` even though the parent checkout has that package installed. → **Cause:** the worktree has no `node_modules` of its own; Node resolution walks up and finds the parent checkout's copy, but Vite refuses to load modules from above the (worktree) project root. → **Fix:** `npm install` in the worktree (~64 MB, git-ignored, no lockfile drift). Cleanup: `node_modules`/`dist` die with the worktree — after the branch merges, `git worktree remove --force <path> && git branch -d <branch>` removes everything. (Hit 2026-07-07 in the first Claude-session worktree off main.)
- **Symptom:** scripted browser tests toggle random controls / state drifts between steps. → **Cause:** coordinate-based clicks land on moved elements after layout shifts; element handles go stale across Svelte re-renders. → **Fix:** in preview evals, query elements fresh in the same eval as the click, use `element.dispatchEvent(new MouseEvent('click', {bubbles:true}))`, and re-read state in a *following* eval.
