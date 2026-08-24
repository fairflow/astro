# Manual — feature reference

What the app actually does, as a reference rather than a tutorial. For
install/run instructions, see `GUIDE.md`. For internals, see
`DEVELOPMENT.md`.

## Chart types

- **Natal** — a single person's birth chart: planets, angles, house
  cusps, aspects.
- **Transits** — the current (or any chosen date's) sky against a saved
  natal chart. Separate wheel or bi-wheel overlay; sky-vs-natal aspect
  list with tighter, transit-specific orbs; landmark badges for exact
  hits.
- **Synastry** — two people's charts compared: inter-chart aspects (with
  a wider synastry orb factor), house overlays (chart A's planets located
  in chart B's houses and vice versa), and Ebertin midpoint contacts.
- **Composite** — a single derived chart from the midpoint of each pair
  of corresponding points (the "midpoints" method: cusp midpoints, not
  the reference-place/derived-ASC method — that's a possible future
  option, not implemented).

Transits are implemented as a chart-to-chart comparison where "chart B" is
the current sky — the same cross-chart math (`src/chart/relate.ts`) backs
transits, synastry, and composites.

## Bodies

Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto,
plus Chiron, Ceres, Pallas, Juno, Vesta, Eris, the mean Lunar Node, and
mean-apogee Lilith. All of these are selectable/deselectable in Settings
(grouped Inner/Outer/Minor); Sun and Moon are always on. Every reading
surface (dossiers, transit list, synastry, composite) degrades gracefully
when a body is switched off.

## House system

Placidus, with Porphyry as the automatic fallback above the polar circles
(where Placidus cusps are mathematically undefined). Houses are accurate
to ≤0.03° against Swiss Ephemeris in the project's golden tests.

## Aspects

Standard aspect set with per-context orbs: natal orbs, tighter transit
orbs, and a wider synastry orb factor for inter-chart comparisons.
Aspect classes and orb-to-opacity mapping drive both the wheel rendering
and the aspect lists. Selecting a body widens the hit area of its aspect
lines; overlapping lines at a click point resolve through a chooser
popover rather than picking arbitrarily.

## Interpretation

### Styles

Four switchable registers, applied consistently across every chart type
(natal/transit/synastry/composite each have their own voice per style —
enforced by a test that the four styles never share a sentence):

| Label | Internal id | Character |
|---|---|---|
| Psychological | `jungian` | Archetypal framing |
| Mundane | `mundane` | Concrete, everyday language |
| Energy | `energy` | Element × modality as a felt quality |
| Minimal | `minimal` | Two-fragment terse form |

### Content

- **Authored** texts: hand-written prose for specific aspect pairs,
  stored in `data/texts/library.natal.json` and `library.transit.json`
  (fetched at runtime, not bundled into the JS — see `DEVELOPMENT.md`).
  Coverage is partial and grows via an in-app authoring workflow (a
  flag-gated `?author` tab used to collect reactions to draft texts,
  which then get arbitrated and merged into the packs).
  Coverage is deliberately partial — usage of aspect pairs is skewed,
  so full authored coverage (~1,800+ texts) isn't the target.
- **Template** fallback: for pairs without authored text, a composer
  assembles a reading from keyword tables (`src/interpret/templates.ts`,
  `vocab.ts`) with modifiers (reinforces/eases/complicates) when multiple
  aspects touch the same body.
- **Dossiers**: focused write-ups that go beyond single aspects — Chiron
  wound, Saturn return (with exact return dates computed, not templated),
  Sun–Moon lunation phase (waxing/waning), career, relationships (extends
  with synastry input when a partner is present).
- **Markers**: short annotations and practice lines attached to readings.
- **Glossary**: plain-language term definitions, with an accordion in the
  UI and hover tooltips on jargon inline in readings.

### AI snapshot / Copy for AI

Every view has a "Copy for AI" control that serializes the current chart
and reading to Markdown, for pasting into an external LLM conversation.
This is a manual, user-triggered clipboard export — the app has no
built-in LLM calls and holds no API key.

## Data sources

- **Sun–Pluto**: `astronomy-engine` (MIT-licensed), accurate to ≤0.03°
  against Swiss Ephemeris in golden tests, valid roughly 1700–2200.
- **Chiron, Ceres, Pallas, Juno, Vesta, Eris**: Chebyshev-coefficient
  packs the project fitted to JPL Horizons data (public domain),
  accurate to ≤0.01° against held-out Horizons samples, covering
  1900–2100. Generated and refreshable via `tools/make_packs.py`.
- **Mean Node and Lilith**: analytic formulas, including the
  reduction-to-ecliptic term Swiss Ephemeris itself uses.
- **Places**: an offline gazetteer of ~34,000 cities with population
  ranking and IANA time zone, resolved at the birth instant (so
  historical zone-rule changes are honoured), built from GeoNames via
  `tools/make_gazetteer.py`.

Swiss Ephemeris itself is never bundled or served — it's AGPL-licensed
with non-redistributable data files, so it's used only as a dev-time
oracle (`pyswisseph`, Moshier model) to generate the golden test
references. See `DEVELOPMENT.md` for the golden-test methodology.

## Persistence and privacy

- Saved charts: birth data only, stored in the browser's IndexedDB
  (Dexie); positions are recomputed on load, so ephemeris or
  interpretation improvements apply to old saves automatically.
- Saved people can be grouped into families/sets and searched.
- Export/Import: a JSON backup file moves charts between browsers or
  devices — there is no server-side sync or account system.
- Session state (last-cast chart, active partner, transit date/target)
  persists across refresh via `localStorage`.
- No server component beyond static file hosting. No accounts, no
  cookies, no analytics. Nothing about a chart leaves the device unless
  you explicitly use Export or Copy for AI.

## Display

- Theme: Dark / Light.
- Contrast: Low / Medium / High (independent axis from theme).
- Skins: an inline CSS-variable override layer beyond theme×contrast —
  currently a black-and-white print skin, swapped in automatically when
  you choose "Print black on white" and restored afterwards.
- Text size and glyph tuning (size/weight/slant) are adjustable and
  reviewable on the `/?glyphs` page; the glyph kit is hand-built, not a
  third-party astrology font.
- Every colour in the app routes through CSS custom properties, including
  inside the SVG wheel, so theme/contrast/skin all apply uniformly.

## Print and export

- A print dialog offers "Print black on white" (swaps to the B/W skin
  for the print job) or "Print as shown" (with an ink-usage warning in
  dark mode); app chrome is hidden via `@media print`.
- Every wheel has SVG and PNG export buttons. Exported SVGs are
  self-contained (glyphs inlined, theme variables resolved, no external
  references); PNGs rasterize at 2×. Files are named
  `wheel-<who>-<date>`.

## PWA / offline behaviour

Astrodynamics is installable as a Progressive Web App. A hand-rolled
service worker (`data/sw.js`) is registered only in production builds
(never during `npm run dev`, to avoid fighting Vite's hot-reload):

- Navigations (`index.html`) are network-first with a cache fallback, so
  a new deploy is picked up while online and the app still opens offline.
- Everything else same-origin — hashed JS/CSS, ephemeris packs,
  gazetteer, text packs, icons — is cache-first with a network fallback.
- Every deploy gets a fresh cache automatically: the service worker's
  `VERSION` constant is patched at build time with the git commit hash,
  so unhashed data fetches (text packs, authoring batches) don't get
  stuck cache-first indefinitely.

Net effect: the app is fully usable offline starting from the second
visit. HTTPS is required for the service worker to register at all.
