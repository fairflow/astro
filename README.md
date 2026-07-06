# Astrodynamics

A local-first astrology application: accurate offline chart calculation
(planets, Pluto, Chiron, Ceres, Pallas, Juno, Vesta, Eris), interactive SVG
chart wheels and bi-wheels, Placidus houses, transits, synastry, midpoint
composites, locally saved charts, and psychological interpretations in four
switchable styles (Psychological, Mundane, Energy, Minimal) with plain-language
glossary, conversation markers, and AI-snapshot export. Installable as a PWA;
fully offline after the second visit. No server, no accounts — nothing leaves
the device.

**Status: M1–M4 built (branch `m4-draft`); interpretation content pipeline
(stage 1c) is next.** See `docs/BUILDLOG.md` for the session-by-session state,
`docs/DESIGN.md` for the design of record, and
`docs/reports/2026-07-05-implementation-and-deployment.md` for the stack
explained, licences and deployment options.

## Development

```bash
npm install
npm test             # golden tests vs Swiss Ephemeris + held-out JPL Horizons
npm run typecheck
npm run dev          # dev server on :8322
npm run build        # deployable static dist/ (~3.8 MB incl. all data)
npm run preview      # serve dist/ (service worker active here, not in dev)

# Python tooling (one-off / regeneration):
python3 -m venv .venv && .venv/bin/pip install pyswisseph numpy pillow
.venv/bin/python tools/golden_refs.py     # golden references
.venv/bin/python tools/make_packs.py      # asteroid packs from Horizons
.venv/bin/python tools/make_gazetteer.py  # place index from GeoNames
.venv/bin/python tools/make_icons.py      # PWA icons
```

## Layout

- `src/ephemeris/` — providers: astronomy-engine (Sun–Pluto), Chebyshev packs
  (asteroids), analytic Node/Lilith
- `src/chart/` — time/civil, houses, aspects, cross-chart maths (transits,
  synastry, composites, Ebertin midpoints)
- `src/interpret/` — composer, per-context voices, dossiers, markers,
  snapshots; **texts load from `data/texts/*.json` at runtime** (edit texts
  without rebuilding)
- `src/render/` + `src/ui/` — wheel geometry, tunable SVG glyph kit
  (`/?glyphs`), Svelte 5 components
- `data/` — served at the site root: ephemeris packs, gazetteer, text packs,
  PWA manifest/icons/service worker
- `tools/` — Python generators (pyswisseph is dev-only, never ships)
- `mockup/` — the original static demonstrator from the design phase

## Deployment

`dist/` is plain static files: copy to any web host (subdirectory fine — set
Vite `base` if not at the root). HTTPS required for the service worker.
Details and options: the implementation report in `docs/reports/`.
