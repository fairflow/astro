# Research notes: transits, composites, Ebertin midpoints

Compiled 2026-07-05 from web research (Sonnet agents; sources below).
These notes back the conventions coded in `src/chart/relate.ts` and
`src/interpret/contexts.ts`.

## Transits

- **Frame**: transiting planet = the moving pressure/process; natal
  point = the psychological structure activated; aspect = the manner
  (conjunction fusion/initiation, square crisis/action, opposition
  culmination/projection, trine/sextile ease/opportunity, quincunx
  adjustment). Natal context modulates intensity: transits echoing a
  natal aspect land harder.
- **Orbs** (tighter than natal; schools vary): inner planets ~2–3°,
  outer planets ~3° applying / 2° separating (some allow 5° at angles),
  transiting Moon ~1°, minor aspects ~1–2°. Applying is weighted above
  separating nearly universally.
- **Duration per contact**: Moon hours · Sun/Mercury/Venus days ·
  Mars days–2 weeks (months if stationing) · Jupiter ~2–3 weeks/pass ·
  Saturn weeks–month/pass, whole aspect ~8–9 months over passes ·
  Uranus up to a year over passes · Neptune/Pluto 1–2+ years (Pluto up
  to 5 hits).
- **Triple pass** (direct–retrograde–direct): 1st = trigger/seeds sown,
  2nd = internal reassessment ("if nothing seems to be happening, the
  interior work is what is happening"), 3rd = integration/resolution.
- **Landmarks**: Saturn cycle squares/oppositions/returns at ~7, 14–15,
  21–22, 29½, 36–37, 44–45, 51–52, 58–60, 87–90; Jupiter return every
  ~12y; Uranus opposition ~40–43 (midlife); Neptune square ~41; Chiron
  return ~50–51.
- **Sky-to-sky aspects** are mundane astrology: read as collective
  weather (e.g. Jupiter–Saturn "great conjunction" ~20y epochs); felt
  personally only where they touch a natal point.

## Midpoint composite charts

- **Computation**: like-planet shorter-arc midpoints. Two named methods
  for angles/houses (both offered by astro.com and Solar Fire):
  1. *Composite–Midpoints*: every cusp is the midpoint of the
     corresponding natal cusps (what this app implements). Caveat:
     near-opposite cusp pairs can break zodiacal order (Solar Fire
     offers "anchor" options).
  2. *Composite–Derived Ascendant*: MC = midpoint of MCs; ASC/houses
     derived from it at a chosen reference latitude (method described
     in detail by Robert Hand, *Planets in Composite*; the "reference
     place" is user-chosen — often the couple's residence).
- **Origin**: John Townley (1973) originated; Hand (1975) wrote the
  standard delineation text.
- **Usage**: the composite is read as the chart of the relationship
  itself — "a third entity… like an energy field which affects both
  people" (Astrodienst). Composite Sun = the relationship's purpose;
  composite Moon = its emotional climate/needs; ASC = the couple's
  image; MC = its public direction/reputation. Transits/progressions to
  the composite time relationship developments (progressed composite
  Moon especially). Works for non-romantic pairs and groups too.
- **Cautions**: not a real sky moment (pure construction — Townley:
  "an extrapolated map"); houses/angles weaker than natal ones;
  near-180° pairs have two valid midpoints (convention: the one nearer
  both bodies); composite Mercury/Venus can land impossibly far from
  the composite Sun (some move them 180°); Davison chart (real chart
  for the time/place midpoint) is the "real sky" alternative.

## Ebertin midpoints in synastry

- Cross-chart: B's planet on (conjunct/hard-aspect on the 90° dial) A's
  X/Y midpoint activates that *combination* in A. Orb ~1–1.5°, up to 2°
  for Sun/Moon midpoints.
- Canonical: B's Venus (or Sun/Moon) on A's **Sun/Moon midpoint** — the
  classic marriage/"inner integration point" indicator (Ebertin; Tyl
  called it indispensable). B's Venus/Mars on A's Venus/Mars midpoint =
  attraction/chemistry (not durability).

## Sources

astro.com (Astrowiki: Composite Chart; in_multicomp_e.htm; in_transit
pages; some pages bot-walled — content via mirrors/caches) ·
cafeastrology.com (transits.html, saturntransits.html, plutotransits,
compositechart.html, sunmoonmidpoint.html, midpoints) ·
theastrologypodcast.com (ep. 365 transits; ep. 128 Townley interview) ·
esotech.com.au/SFHelp (combined_charts.htm, composite_chart_houses.htm)
· rubyslipper.ca · astrologyking.com · kerykeion.net (cosmobiology,
synastry midpoints) · hniizato.com (Sun/Moon midpoint) · starzology.com
(midpoint composites, inner-planet paradox) · mountainastrologer
Substack (Saturn quarter-squares, Jessica Murray) · masteringthezodiac
.com (Chiron transits) · astrohealer.com · evolvingdoorastro.com.
