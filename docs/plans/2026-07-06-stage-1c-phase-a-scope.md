# Stage 1c · Phase A — Authoring the interpretation corpus (v2)

*v1 2026-07-06 (overnight); v2 2026-07-07 after M's review: houses & signs
added as first-class authoring dimensions (they were missing and are central
to how B reads a chart), polarity made a structural principle, B's authoring
form specified, terminology questions answered, interlingua research split
out to `docs/research/2026-07-07-interlingua.md`.*

## Terminology (M's question A0)

- **Pair** = an unordered planet pair, e.g. `moon-saturn`. The 8 currently
  authored: sun-moon, sun-saturn, moon-saturn, venus-mars, sun-chiron,
  moon-chiron, saturn-chiron, moon-pluto.
- **Class** = the aspect family the composer distinguishes when it picks a
  text: **flowing** (trine, sextile), **challenge** (square, opposition),
  **neutral** (conjunction — fusion, neither easy nor hard). The quincunx
  ("adjusting") currently borrows challenge texts with an adjusting frame.
  So "8 pairs × 3 classes × 4 styles" = 96 authored natal texts.

## Goal

Replace template-composed prose with **authored texts at scale**, in the
app's voice, tested against a real reader (B), keeping the composer
(modifiers, tension report, markers, practice lines) as the combination
engine. Phase A = corpus + tooling; Phase B = field-test burn-in.

## The three dimensions (revised)

A natal reading rests on three factor families, all needing authored cover:

1. **Aspects** (pairs × classes) — v1's subject, unchanged below.
2. **Bodies in houses** (1a) — *where* a drive incarnates. **New.**
3. **Bodies in signs** (1b) — *how* a drive expresses. **New.**

Plus a **combination rule** (1c) assembling body + sign + house (+ aspect
pressure) into one reading per register — see *Building principles*.
Existing assets (1d): `HOUSE_ARENA` (12 arena lines, single register),
`SIGN_TONE` (12 tone lines, single register), `bodyintro.json` (18 bodies ×
4 registers — complete). These become raw material, not final texts.

## Building principles (houses & signs, after Liz Greene)

Sources to work from: Greene & Sasportas' psychological-astrology seminars
(*The Development of the Personality*, *Dynamics of the Unconscious*),
Sasportas *The Twelve Houses* (the CPA standard), Greene *Relating* and
*The Astrology of Fate*. The load-bearing ideas for our engine:

- **Houses are psychological terrain, not event-boxes**: the field of
  experience where a planetary archetype is *lived and met* — often first
  through projection (7th), inheritance (4th, 12th), or the body (1st).
- **The axis is the unit.** Greene reads houses in polar pairs: 1/7
  self-definition ↔ the encountered other; 2/8 own substance ↔ shared and
  transformed substance; 3/9 the near mind ↔ the far mind; 4/10 private
  roots ↔ public role (the parental axis); 5/11 personal creation ↔
  collective belonging; 6/12 daily order ↔ dissolution into the whole.
  A planet at one pole constellates the other.
- **Signs are polar too** — B's instinct (Scorpio always implies Taurus) is
  the Taurus–Scorpio axis, and it mirrors 2/8. Whether *house* polarity is
  as alive for her is an open question — the axis-first format below lets
  us find out empirically from her reaction marks.
- **Angular / succedent / cadent** modulates intensity of expression —
  a cheap, systematic modifier, not new prose.

**Therefore: author axes first, inflect second.**

- 6 **sign-axis kernels** (Aries–Libra … Pisces–Virgo… i.e. the 6
  oppositional axes) + 12 **sign inflections** (which pole, and how it
  differs from its partner). Every sign text names its opposite pole —
  polarity is guaranteed structurally, not left to authorial memory.
- 6 **house-axis kernels** + 12 **house inflections**, same shape.
- **Body-in-sign** and **body-in-house** texts then compose:
  body kernel (noun + drive, already in `PLANET_PROFILE`) × sign manner
  (with its polar shadow) × house arena (with its axis pole). Luminaries
  and personal planets get fully authored slot texts; outers/minors are
  composed from the parts (outer planets in signs are generational —
  templates suffice; in *houses* they are personal and get authored cover
  in a later wave).

## Sizing (revised)

| Block | Authored slots | ×4 registers |
|---|---|---|
| Sign axes + inflections | 6 + 12 = 18 | 72 |
| House axes + inflections | 6 + 12 = 18 | 72 |
| Luminaries in signs (2×12) | 24 | 96 |
| Luminaries in houses (2×12) | 24 | 96 |
| Mercury/Venus/Mars in signs (wave later) | 36 | 144 |
| Mercury/Venus/Mars in houses | 36 | 144 |
| Aspect pairs, wave 1 (~30 pairs × 3 classes) | 90 | 360 |
| Aspect pairs, wave 2 (~35 pairs × 3) | 105 | 420 |
| Transit pairs (~25) | 25 | 100 |

Registers are drafted as a set from one kernel, so the *kernel* counts
(left column) are the real authoring effort: **~380 kernels** across all
waves. Wave 1 of the revised queue is ~130 kernels — a few weeks of the
batch loop, not months. Everything else stays template-composed with the
improved parts.

## Priority order (revised queue)

1. **Wave 0 — the frame (new):** 6 sign axes + 12 sign inflections;
   6 house axes + 12 house inflections. Small, and every later text
   stands on it.
2. **Wave 1a — luminaries located:** Sun and Moon in each sign and house
   (48 kernels). For B this *is* chart reading; it also feeds dossiers.
3. **Wave 1b — the felt aspect core** (~30 pairs, hard classes first):
   luminaries × personal planets; luminaries × Saturn/Pluto/Chiron/Node;
   Venus/Mars crosses.
4. **Wave 2 — personal planets located + personal × outer aspects.**
5. **Wave 3 — transits** (slow movers × luminaries/personals).
6. **Wave 4 — synastry voice pass** (re-voicing table + ~20 bespoke pairs).
7. **Not authored:** minor×minor aspects, outer-in-sign, composite voice
   (keeps context re-voicing).

## The three-way dialogue — working protocol (unchanged shape)

1. **C drafts** a batch (6–8 kernels' worth): kernel (2–3 lines,
   style-free) + the register renderings + markers + one "Ask:".
2. **B reads cold and reacts**: ✓ (lands) / ~ (flat) / ✗ (wrong or
   preachy), a phrase where moved. Reaction is the data; no analysis
   asked of her.
3. **M arbitrates** voice; kills anything that moralises.
4. **C ingests** to the JSON packs with provenance, re-runs distinctness
   tests, ships to the field build.

## B's authoring form (replaces raw markdown editing)

B will not edit `batch-NN.md` by hand. Build an **Authoring tab in the app
itself** (during development; later hidden behind an admin flag):

- One slot per screen: kernel shown for context, the four register texts
  large and readable, then three reaction buttons **✓ / ~ / ✗** and an
  optional one-line comment box.
- **Next / Back** buttons walk the batch; a progress dot-strip shows
  position; state saves to localStorage on every tap (she can stop
  mid-batch and resume).
- **Export reactions** produces the annotated batch file for C to ingest —
  same privacy model as charts: nothing leaves the device until she
  chooses to send the file.
- M's arbitration can use the same tab (an "edit" mode on the text boxes)
  or the markdown round-trip — his choice.
- Visibility: `?author` URL flag or a localStorage switch during Phase A;
  under admin control before any public deployment.

## Tooling (revised)

- `tools/authoring_sheet.py` — generate a batch (worksheet **and** the
  JSON the in-app form reads), current template output pre-filled as the
  straw man.
- `tools/authoring_ingest.py` — parse a completed worksheet / form export
  back into the packs; schema validation; provenance
  `{"src":"1c-A","batch":N,"status":"accepted"|"b-flagged"}`; register
  lint (banned words, moralising imperatives, asterisks).
- The interlingua experiment (see research note) may upgrade kernels from
  prose to structured form later — the worksheet format reserves the
  KERNEL line for that without changing the loop.

## Acceptance criteria per batch

All renderings pass `styles-distinct` + register lint; B has seen every
text; ✗ texts rewritten or dropped before merge; pack diffs reviewed in a
PR like code.

## Risks / mitigations

- **Voice drift** → kernels kept in history; C re-reads accepted corpus
  before each batch.
- **Combinatorial creep** → the queue is the contract; additions go to the
  end of a wave. (The houses dimension entered exactly this way — through
  a v2 of the scope, not mid-batch.)
- **B fatigue** → batches capped ≈ 100 short texts; reactions only; the
  form makes a session possible on a sofa with a tablet.
- **Register flattening** → distinctness test + M's arbitration.
- **Polarity overreach** (every text tediously naming its opposite) → the
  inflection format *allows* the polar reference, the register decides how
  loudly; B's marks will show where it helps and where it drones.

## Phase B gate (revised)

Wave 0 + Wave 1a fully authored and ingested; Wave 1b ≥ half; the
authoring form usable by B unassisted; and B can use the app for a full
session without hitting a text she has flagged and not seen fixed.
