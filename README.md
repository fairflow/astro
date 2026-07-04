# Astro

A personal astrology application: accurate offline chart calculation (planets,
Pluto, Chiron, Ceres, Pallas, Juno, Vesta, Eris), interactive SVG chart wheels,
Placidus houses, synastry & transits, locally saved charts, and psychological
interpretations in four switchable styles (Jungian, Mundane, Energy-patterns,
Minimalist).

**Status: M1 (compute core) done** — ephemeris providers, asteroid Chebyshev
packs, Placidus houses, aspects; 111 golden tests green. UI next (M2).

- 📄 **[Design proposal](docs/DESIGN.md)** — platform review (web / iPadOS /
  Android), ephemeris & licensing strategy, graphics, interpretation engine
  with aspect-combination logic, themes, architecture, milestones.
- 🎡 **[Interactive mock-up](mockup/chart.html)** — chart wheel demonstrator
  with live aspect detection, orb→opacity shading, clickable aspects/planets,
  style-switchable sample interpretations, and a transit overlay.

## Viewing the mock-up locally

No build step; any static server works:

```bash
python3 -m http.server 8321
# then open http://localhost:8321/mockup/chart.html
```

(Or simply open `mockup/chart.html` directly in a browser — it has no external
dependencies.)

## Development

```bash
npm install          # TS deps (astronomy-engine, vitest, typescript)
npm test             # golden tests: planets/houses vs Swiss Ephemeris,
                     # asteroid packs vs held-out JPL Horizons samples
npm run typecheck

# Python tooling (one-off / regeneration):
python3 -m venv .venv && .venv/bin/pip install pyswisseph numpy
.venv/bin/python tools/golden_refs.py   # regenerate golden references
.venv/bin/python tools/make_packs.py    # rebuild asteroid packs from Horizons
```

Layout: `src/ephemeris/` (providers: astronomy-engine core, Chebyshev packs,
analytic Node/Lilith), `src/chart/` (time, Placidus/Porphyry houses, aspects,
chart assembly), `data/packs/` (committed asteroid ephemeris packs,
1900–2100), `test/golden/` (committed reference values), `tools/` (Python
generators; pyswisseph is dev-only and never ships).

## Planned stack

TypeScript + Vite + Svelte PWA · hand-rolled SVG rendering · `astronomy-engine`
(MIT) + Chebyshev packs built from JPL Horizons data for asteroids ·
IndexedDB (Dexie) storage · Python tooling (`tools/`) for ephemeris pack
generation and golden-test references. See the design doc for the reasoning.
