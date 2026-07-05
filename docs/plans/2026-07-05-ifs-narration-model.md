# IFS narration model — phase-A working notes

Derived from two live exercises (2026-07-05): freeform IFS-informed
profiles written by Claude from "Copy for AI" snapshots (Benita's natal,
Matthew's natal, then their synastry), back-analysed for what the
engine's AUTHORED/TEMPLATE narration should learn. This is the seed
document for stage 1c phase A (the Claude/Benita/Matthew authoring
dialogue).

Correction note: this file was referenced as committed in the chat of
2026-07-05 before it actually existed; created one turn later.

## Why the current output feels "wooden" (Benita, user test)

Pairwise aspect narration is the wrong unit. A human reader (and IFS)
works with *entities* — clusters of chart factors that behave like
characters — and with the relationships between them. The engine
already computes everything needed; it narrates at the wrong altitude.

## The figure model (natal)

1. **Figure detection (COMPUTED)**: cluster factors into figures —
   stellia (≥2–3 bodies one sign/house), aspect-nets around a focal
   planet, axis structures (e.g. Chiron–Lilith–Uranus oppositions),
   the node axis, angular contacts, retrograde caretakers, etc.
2. **Figure naming**: agent-noun grammar over the drive vocabulary
   ("the Truth-Rider", "the Offstage Engine", "the Silenced Wild
   Voice"). Names double as Benita's conversation markers. Template
   tier generates candidates; the authoring dialogue curates.
3. **Seven-slot skeleton per figure** (every slot style-renderable):
   what it does → positive intent → cost → likely origin arena
   (house/axis) → polarised with → what relaxes it → one question to
   ask it. (The "question" slot generalises the markers feature; the
   "relaxes" slot generalises the practice lines.)
4. **Polarisation = tension report**: render computed contradictions as
   two *named figures* in relationship plus a mediation question — the
   IFS manager/firefighter/exile grammar fits directly.
5. **Resource inventory**: soft aspects, dignified placements, exact
   harmonious contacts narrated as "where Self shows through / what to
   lean on" — a first-class section, not buried in the aspect list.
6. **Convergence detection**: independent structures pointing at the
   same sign/house/theme (e.g. wound-axis targeting the 5th AND North
   Node in the 5th; node exactly on an angle) get flagged and narrated
   with emphasis — this is what human astrologers hunt for, and it is
   computable (shared targets across figures).
7. **Invitational grammar** everywhere: "see if you find a part
   like…", "ask it…" — never diagnosis. Style-sheet rule for all
   authored text.
8. **Selectivity**: profiles use the top ~5–7 figures; the aspect tail
   stays available on demand but is not narrated.
9. **IFS is a profile view, not a fifth per-aspect style**: it operates
   on figures, so it enters as a chart-level narrative (and as the
   constrained input schema for the LLM-enrichment layer), while the
   four per-aspect styles remain.

## Synastry additions (from the Benita × Matthew exercise)

10. **Parts-to-parts contacts**: an inter-aspect is narrated as a
    contact between two *already-named* figures (her Truth-Rider fuels
    his Speaker-child), which requires running figure detection on both
    charts first, then mapping cross-aspects onto figure pairs.
11. **Circuits, not lists**: group cross-aspects into functional
    circuits — the resource circuit (mutual soft contacts among
    luminaries/personal planets), the friction loop(s), the attraction
    polarity — and narrate each circuit once, with its members.
12. **Reciprocity detection (high value)**: when a contact type runs in
    BOTH directions (each partner's benefic on the other's Chiron; each
    partner's body on the other's Sun/Moon midpoint), flag it — mutual
    structures outrank one-way ones and read as "contracts".
13. **Shared-signature recognition**: when both natal charts carry the
    same hard pattern (e.g. both have tight Pluto squares to a personal
    planet), narrate the meeting of two same-species protectors — the
    co-regulate-or-collude fork. Computable: match tight hard aspects
    to the same outer planet across charts.
14. **Ebertin dial hits both ways** = bonding seal; give it its own
    short section when present bidirectionally (cf. research notes).
15. **Angular/node cross-contacts** (X's planet on Y's ASC/DSC/node)
    belong in the couple's "direction" section with convergence
    handling as in (6).

## Pipeline (phase A → phase B)

compute factors → detect figures (both charts for synastry) → fill
skeletons → detect circuits/reciprocity/convergences → render per
style (incl. IFS profile view) → authoring dialogue curates the
renderings → approved texts burn into the library with reviewer tags
(phase B: deployable field-test app).

## Feature fallout already shipped

- "Copy for AI" natal snapshot (raw factors, interpretations omitted).
- "Copy for AI (synastry)": both charts + inter-aspects + overlays +
  bidirectional Ebertin contacts (user request, 2026-07-05).
