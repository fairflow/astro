# Astrodynamics — implementation & deployment report

For: Matthew (designer). Date: 2026-07-05. State reviewed: branch
`m4-draft` @ transits-to-couple; 147 tests green.

Purpose: answer "has the app reached a level of complexity that
constrains future implementation choices?" — with an inventory of what
it is built from, explanations of the pieces you may not know from the
inside (Svelte especially), and a survey of deployment options.

## 1. Executive summary

**The short answer to your concern: no — with two qualifications.**
The codebase is deliberately layered so that everything hard-won (the
ephemeris, houses, aspects, relationship maths, the interpretation
engine and its texts) is plain portable TypeScript with **zero
framework dependence** — it would survive a move to any UI technology,
to native apps, or even to a server, essentially unchanged. The UI
layer on top is Svelte, and is the only part that would be rewritten in
a pivot; it is ~1,850 lines across 18 components, perhaps two weeks of
mechanical work to re-do in something else.

The two qualifications:

1. **The interpretation library is compiled into the app bundle.** Fine
   today (the bundle is 131 KB gzipped), but phase B's authored matrix
   (~700+ texts, growing) belongs in fetched data files like the
   ephemeris packs — otherwise every text edit means a rebuild, and the
   bundle swells. This is a half-day refactor best done before the
   authoring pipeline starts producing volume. **Recommended next.**
2. **The offline story is designed but not yet wired**: there is no
   service worker yet (scheduled M5). Until it exists, "offline-first"
   means "everything computes locally" but the app still needs the
   network to *load*. One focused session closes this.

Everything else — dependencies, licences, data, hosting — leaves all
doors open, including the cheapest one (a folder of static files on
your existing Krystal hosting).

## 2. What the app is made of

Four layers, strictly ordered — each depends only on the ones below:

```
ui/          18 Svelte components (form, wheel, panels, views)   1,853 lines
render/      wheel geometry + SVG glyph kit (pure TS)            ─┐
interpret/   composer, library, dossiers, contexts (pure TS)      ├ 3,061 lines
chart/       time, houses, aspects, relate (pure TS)              │
ephemeris/   providers: astronomy-engine + Chebyshev packs        ─┘
data/        ephemeris packs (1.1 MB) + gazetteer (1.2 MB), static files
```

The bottom three code layers import no framework — they run in Node,
in any browser, in tests, or (relevant later) inside a native shell or
server process, untouched. This is the design's central bet and it has
held: the golden tests exercise the whole compute stack with no UI at
all.

## 3. The stack, piece by piece

**TypeScript** — JavaScript with a type system; compiles away entirely.
Universally supported; no lock-in (any JS environment runs the output).

**Vite** (dev server + bundler, MIT) — runs the app locally with
instant reload and builds the deployable `dist/` folder. Replaceable by
any bundler in a day; nothing in the code is Vite-specific except one
small config file.

**Svelte 5** (UI framework, MIT) — the piece you asked about. Unlike
React (which ships a runtime library and re-renders by diffing), Svelte
is a *compiler*: components are written in `.svelte` files (HTML +
scoped CSS + a script block) and compile to small vanilla-JS that
updates the DOM surgically. Its reactivity uses "runes" — `$state()`
declares reactive variables, `$derived()` computed ones, and the
templates re-render automatically when they change. Costs/benefits as
they affect you: output is small and fast (our whole app: 131 KB gz
including Svelte itself); the syntax is Svelte-specific, so UI code
doesn't copy-paste to React (concepts transfer, text doesn't); Svelte 5
is recent (2024) but stable, MIT, with a large community — and because
it's a compiler, even an abandoned Svelte would leave us with working
compiled output, not a rotting runtime. Risk: low. Lock-in: confined to
`src/ui/`.

**SVG for the wheel** — hand-rolled geometry (`render/wheel.ts`
computes coordinates; components draw them). No chart library at all,
which is why the bi-wheel, glyph kit, shading etc. could be built to
spec. SVG prints, exports, and embeds anywhere; this was the
right call and creates no constraints.

**Dexie 4** (Apache-2.0) — a thin, very stable wrapper over the
browser's built-in IndexedDB database, storing saved charts *on the
device*. ~30 KB; replaceable by raw IndexedDB if ever needed. Display
settings use localStorage (built-in). No accounts, no server, nothing
leaves the device — which is also the privacy story for field testing
with real birth data.

**astronomy-engine 2.1.19** (MIT) — computes Sun–Pluto to ±1 arcminute,
validated in our tests against Swiss Ephemeris to ≤0.03°. It is one
author's project (Don Cross), mature and effectively finished. Because
positions are astronomy, not fashion, "unmaintained" is a mild risk;
mitigation if ever needed: vendor the file (it's a single JS file) or
swap providers behind our `EphemerisProvider` interface — the tests
would catch any regression.

**Our Chebyshev packs** (data, not a dependency) — asteroid positions
1900–2100 fitted from JPL Horizons, committed to the repo (1.1 MB).
JPL's availability only matters when *regenerating* (extending the year
range); the app never calls the internet for positions.

**GeoNames gazetteer** (CC-BY 4.0, 1.2 MB) — 34k places with
timezones, bundled. Attribution shown in-app; regeneration script kept.

**Python tooling** (`tools/`, dev-only) — pyswisseph (AGPL — never
ships; used only to generate test reference values), numpy, plus plain
urllib for Horizons. Only needed to regenerate goldens/packs/gazetteer.

**Vitest 3** (MIT) — the test runner: 147 tests, sub-second, no
network, no Python needed to run them.

## 4. Dependency & licence table

| Package | Version | Licence | Ships to users? | Role |
|---|---|---|---|---|
| astronomy-engine | 2.1.19 | MIT | yes (~120 KB) | planets Sun–Pluto |
| dexie | 4.4.4 | Apache-2.0 | yes (~30 KB) | saved charts (IndexedDB) |
| svelte | 5.56.4 | MIT | compiled in | UI framework |
| vite | 6.4.3 | MIT | no (build tool) | dev server / bundler |
| vitest | 3.2.6 | MIT | no | tests |
| typescript | 5.9.3 | Apache-2.0 | no | types |
| @sveltejs/vite-plugin-svelte | 5.1.1 | MIT | no | glue |
| @types/node | 26.1.0 | MIT | no | types |
| pyswisseph (Python) | — | **AGPL** | **no — dev only** | golden references |
| numpy (Python) | — | BSD | no | pack fitting |

Data licences: JPL Horizons output — public domain; GeoNames — CC-BY
4.0 (attributed); glyphs — our own SVG (no font licences owed); all
interpretation text — original to this project. `npm audit`: 0
vulnerabilities. Total third-party runtime code: **two packages** —
that is the whole supply chain that ships.

## 5. Requirements

**To develop**: any macOS/Linux/Windows machine; Node ^18/^20/≥22
(machine has v23); ~70 MB of dev dependencies; Python 3 + venv only for
regenerating data; internet only for `npm install`, Horizons and
GeoNames refreshes. Nothing else — no databases, no accounts, no keys.

**To use**: any evergreen browser of roughly the last three years
(Chrome/Edge/Safari/Firefox, desktop or mobile). The app is ~3.8 MB
once (of which 2.3 MB is data, well-compressed over the wire), then
computes everything on-device. No server-side code exists at all.
Works on a phone, though the layout is tuned for tablet/desktop.

**Internet at runtime**: currently needed once per visit (no service
worker yet — see §1). After M5: only for first install and updates.
The future LLM-enrichment layer is the sole feature that inherently
needs the network — and it also needs the one piece of server anywhere
in the plan: a tiny key-holding proxy (e.g. a Cloudflare Worker),
because an API key embedded in a public web app can be stolen. Design
accordingly: LLM = optional online extra, never load-bearing.

## 6. Complexity audit — what would constrain us, honestly

| Concern | Reality | Mitigation / action |
|---|---|---|
| Interpretation texts compiled into bundle | fine now; wrong for phase B scale | move library to fetched JSON packs (half-day) — **do before authoring volume** |
| No service worker yet | offline claim incomplete | M5 item, one session |
| Svelte-5-specific UI code | 1,853 lines, isolated in `ui/` | acceptable; compute core untouched by any pivot |
| astronomy-engine single-author | stable, finished maths | vendor file if ever needed; provider interface + golden tests make swaps safe |
| JPL/GeoNames availability | needed only to regenerate | data committed to repo |
| Browser storage eviction | can delete saved charts | `persist()` requested; export/import exists; documented |
| App.svelte accumulating state | ~230 lines, still readable | refactor into a store module when it crosses ~300 |
| Text library i18n | English only, strings in code | same JSON-pack refactor opens the door |
| bd tracker not per-repo | GitHub issues in use | revisit when beads supports it comfortably |

Nothing on this list is architectural debt in the load-bearing sense;
the two real items are the first two rows.

## 7. Deployment options

| Option | What it involves | Cost | Fit |
|---|---|---|---|
| **A. Krystal subdirectory** (your host) | copy `dist/` next to the WordPress site; set vite `base` if under a path | £0 extra | **best first deployment** — field test by URL |
| B. Cloudflare Pages | connect repo, auto-build on push; free tier generous; access controls available | £0 | best CI/staging; private beta via Access |
| C. GitHub Pages | same idea; repo is private so needs paid plan or public repo | £0–4/mo | fine, less flexible than B |
| D. LAN only | `python3 -m http.server` in `dist/` | £0 | already works today |
| E. PWA install | after M5 service worker: "Add to Home Screen" on iPad/Android/desktop — full-screen, offline, icon | dev time only | the intended end state for personal use |
| F. Capacitor wrap → App Store / Play | native shell around the same code; needs Xcode (have), Apple dev $99/yr, Play $25 once, review processes | ~1–2 wks + fees | only if store distribution matters |
| G. Tauri/Electron desktop | desktop binaries; Tauri small (Rust toolchain), Electron heavy | ~1 wk | probably unnecessary given E |

**Recommended path**: finish M5 (service worker + manifest + the
JSON-pack refactor) → deploy to **A** (astrodynamics.org.uk could be
re-registered, or a path on fairflow.co.uk) with **B** as the
auto-deploying staging mirror → Benita field-tests as an installed PWA
on her tablet (E). F stays available unchanged if the project ever
wants storefronts; nothing done so far would need re-doing.

## 8. Pivot costs (proof of the "not constrained" claim)

- **To React/Vue/anything web**: rewrite `ui/` (~2 wks); everything
  else identical.
- **To native iPad (SwiftUI)**: keep compute core running in a JS
  context (JavaScriptCore) or port it (the maths is textbook; the tests
  are the spec); rewrite UI natively (~4–8 wks). Capacitor (option F)
  gets 95% of this for 5% of the cost.
- **To a server-rendered product** (accounts, sharing): the compute
  core runs in Node unchanged; add API + DB + auth (~weeks, plus the
  privacy model changes — currently a selling point that no birth data
  leaves the device).
- **To another ephemeris** (e.g. licensed Swiss Ephemeris for
  reference-grade asteroids): implement one provider class; golden
  tests validate it; UI unaware.

## 9. Figures

Build: JS 347 KB (131 KB gz) + CSS 20 KB (4 KB gz) + data 2.3 MB
(packs 1.1 MB, gazetteer 1.2 MB) = `dist/` 3.8 MB. Code: 3,061 lines
TS (compute/render) + 1,853 lines Svelte (UI) + ~600 lines Python
(tools). Tests: 147. Runtime third-party packages: 2. Vulnerabilities: 0.
