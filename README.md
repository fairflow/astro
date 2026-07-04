# Astro

A personal astrology application: accurate offline chart calculation (planets,
Pluto, Chiron, Ceres, Pallas, Juno, Vesta, Eris), interactive SVG chart wheels,
Placidus houses, synastry & transits, locally saved charts, and psychological
interpretations in four switchable styles (Jungian, Mundane, Energy-patterns,
Minimalist).

**Status: design phase.**

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

## Planned stack

TypeScript + Vite + Svelte PWA · hand-rolled SVG rendering · `astronomy-engine`
(MIT) + Chebyshev packs built from JPL Horizons data for asteroids ·
IndexedDB (Dexie) storage · Python tooling (`tools/`) for ephemeris pack
generation and golden-test references. See the design doc for the reasoning.
