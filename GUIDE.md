# Guide — getting started

A walkthrough for running Astrodynamics locally and casting your first chart.
For what the app actually does, see `MANUAL.md`. For architecture and
contributing, see `DEVELOPMENT.md`.

## Install and run

```bash
git clone https://github.com/fairflow/astro.git
cd astro
npm install
npm run dev          # dev server on http://localhost:8322
```

Open the printed URL. No account, no server, no API key — everything below
runs in the browser.

To see the app the way it behaves once deployed (installable, offline after
the second load), build and preview instead:

```bash
npm run build         # writes dist/ (~3.8 MB, includes all ephemeris/gazetteer/text data)
npm run preview        # serves dist/ — this is the only mode where the service worker is active
```

`npm run dev` does **not** register the service worker (it would fight
Vite's hot-reload); use `preview` if you want to test offline behaviour or
"Add to Home Screen".

## First chart

1. Fill in the birth form: date, time, and place. Start typing a place name
   — the offline gazetteer (34k cities) resolves it to coordinates and its
   IANA time zone as it stood on the birth date (historical zone rules
   apply, not today's).
2. If you don't know the exact time, set the accuracy field (`exact` /
   `5min` / `30min` / `2h` / `unknown`) — this doesn't change the
   computation, but it's stored with the chart as a caveat.
3. Submit. The app computes the chart entirely offline — planetary
   positions, house cusps, aspects — and draws the natal wheel.

Nothing is sent anywhere. Positions come from ephemeris data bundled in the
app itself (see "Offline ephemeris" below), not a lookup service.

## Reading the wheel

- Click a planet, sign, house, or aspect line to select it; the panel below
  the wheel shows what's relevant to that selection.
- Where aspect lines overlap, click near the cluster — a chooser pops up
  listing every candidate line so you can pick the one you mean.
- The ⤢ button expands any wheel to fullscreen with a birth-data caption;
  SVG/PNG export buttons sit next to it (self-contained files, no external
  fonts or references).
- The Display menu (top of the app) controls theme (Dark/Light), contrast
  (Low/Medium/High), text size, and glyph tuning — all via CSS variables, so
  it also affects the SVG wheel, not just the surrounding UI. There's a
  glyph-tuning review page at `/?glyphs`.

## Interpretation styles

Every reading — natal, transit, synastry, composite — is available in four
switchable registers:

- **Psychological** — archetypal, Jungian-inflected.
- **Mundane** — concrete, everyday language.
- **Energy** — element/modality framed as a felt quality.
- **Minimal** — two-fragment terse form.

Switch styles from the style picker; the whole current view re-renders in
the new register. Texts are either hand-authored (for the aspect pairs
covered so far) or assembled at runtime from a template composer for
everything else — you won't be told which, but coverage grows over time
(see `MANUAL.md` → Interpretation content).

## Beyond the natal chart

- **Transits** tab: pick a date (defaults to now) to see the current sky
  against a saved natal chart, as a separate wheel or a bi-wheel overlay,
  with a list of sky-vs-natal aspects and landmark badges (exact hits,
  stations, etc.).
- **Synastry** tab: pick a second saved person to compare against; shows
  inter-aspects between the two charts, house overlays (whose planets fall
  in whose houses), and Ebertin midpoint contacts.
- **Composite** tab: the midpoint chart of the two people (cusp
  midpoints), with its own wheel and reading.

## Saving charts

Charts save to the browser's IndexedDB (via Dexie) — only birth data is
stored; positions are recomputed on load, so ephemeris fixes and
interpretation updates apply retroactively to old saves. Saved people can be
grouped into families/sets and searched. Use Export/Import in the Saved
menu to move charts between browsers or devices as a JSON file — there is
no server sync.

## Copy for AI

Every view (natal, transits, synastry, composite) has a "Copy for AI"
button that copies a Markdown snapshot of the current chart and reading to
the clipboard, sized for pasting into a chat conversation with an LLM. This
is a one-way export you trigger manually — the app itself makes no network
calls and holds no API key.

## Offline ephemeris, briefly

Planetary positions come from two bundled sources, not a network call:
`astronomy-engine` (MIT-licensed) for Sun through Pluto, and compact
Chebyshev-coefficient packs the project generated from JPL Horizons data
for Chiron, Ceres, Pallas, Juno, Vesta, and Eris. Both ship in the app
bundle. See `MANUAL.md` for accuracy figures and `DEVELOPMENT.md` for how
the packs are built and validated.
