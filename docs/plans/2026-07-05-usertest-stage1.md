# User test 1 (Benita) — findings & stage-1 improvement plan

Source: transcript of Benita (practising astrologer) using the app with
Matthew, 2026-07-05 (first part; more transcript to follow).

## What worked

- The pathways/mechanics were legible and rated learnable ("brilliant…
  I could learn a lot from that").
- The facts layer (positions, aspects, orbs) reads correctly to a
  practitioner; the mechanical tier is explicitly useful as scaffolding.

## Findings

### F1 — Styles feel identical on template-tier readings (top issue)
Benita: "there is absolutely no difference between Jungian, mundane,
energy or minimal… it's mechanical." The aspect she was reading
(Vesta–North Node, "the devotee works against the grain of the
direction of growth") is TEMPLATE-tier, and the current templates share
one `effect` sentence across all four styles — so the styles genuinely
are near-identical exactly where coverage is thinnest. Authored entries
(e.g. Moon–Saturn) do differ strongly, but only 8 natal pairs are
authored.

### F2 — The psychological layer is what's missing, not more mechanics
"The mechanical is useful for me to learn, but I need to be able to
attach the psychological." Jargon like "direction of growth" and "the
two functions interrupt each other" needs translation into contemporary
psychological language. Matthew's suggestion in-session: rename the
Jungian style to **Psychological**; possibly add an **IFS** register
(parts language) later.

### F3 — Style switcher affordance
"You have to click away and then click again — you're on Jungian":
the active style and the fact that the panel re-renders were not
obvious.

### F4 — Houses need to be more visible
"The house system needs to be made a bit clearer" — on the wheel
(numerals are small/dim) and in companion text ("you need the house
degree as well as the sign degree").

### F5 — Unfamiliar bodies need introductions
"I'm not familiar with Eris — how do we interpret that in a
psychological sense?" Clicking a body should teach its archetype, not
just list facts.

### F6 — Jupiter glyph reads as the digit 4 (Matthew)
Tunable in `render/glyphset.ts`; review page `/?glyphs`.

### F7 — Signs aren't clickable (Matthew noted mid-demo)
Planets and aspects are tappable; sign glyphs are not.

## Stage-1 plan

### A. Quick UX (small, high value)

1. **Rename style "Jungian" → "Psychological"** (register unchanged:
   depth-psychological, archetypes, integration). Keep "Jungian" as the
   internal id to avoid churn. Decide later whether IFS becomes a 5th
   style or a variant of Psychological.
2. **Style switcher affordance**: stronger active state, style name
   echoed in the reading header ("Psychological reading"), and a subtle
   crossfade on change so the re-render is visible.
3. **Houses on the wheel**: alternate-house background shading between
   hub and zodiac band; larger, brighter house numerals; cusp degree
   labels at the cusp ticks (toggleable if noisy).
4. **House alongside sign everywhere**: every position readout shows
   "17°30′ Cancer · H6" (aspect list rows included). Open question for
   Benita: whether "house degree" also means degrees-past-cusp — cheap
   to add to the panel if so.
5. **Body introductions**: extend planet profiles with a 2–3 sentence
   archetype intro per style (Eris, Vesta, Juno, Lilith etc. first);
   shown at the top of the body panel before the facts.
6. **Jupiter glyph rework** (+ pass over any other digit-lookalikes).
7. **Clickable signs**: tap a sign glyph → short sign card (element,
   mode, tone keywords).
8. **Reader-facing source labels**: rename badges — AUTHORED → "curated",
   TEMPLATE → "assembled", COMPUTED → "calculated" — with a tooltip
   explaining each; consider hiding badges behind a "show sources"
   toggle for non-builder users.

### B. Content engine (the real fix for F1/F2)

1. **De-share the template voices** (immediate): each style gets its own
   class-effect phrasing table instead of the shared `CLASS_VERB.effect`
   sentence, so even template-tier readings differ genuinely in
   register. Acceptance test: for any pair, the four style outputs share
   no sentence.
2. **Glossary layer**: tappable terms in readings ("North Node /
   direction of growth", "applying", "orb", "the two functions…") open
   one-paragraph plain-language explanations. Start with ~20 terms.
3. **AI-assisted authoring pipeline** (the scalable answer to
   "mechanical"): batch-draft the full high-salience matrix — Sun–Pluto
   + Chiron + Node pairs × 3 aspect classes × 4 styles (~700 short
   texts) — as YAML draft files; Matthew/Benita review, edit, approve;
   approved entries are compiled into the authored library with
   reviewer initials. Benita's role: mark each draft keep / fix / bin.
   (Answers "who authors AUTHORED": to date, the AI assistant wrote
   them, unreviewed; this pipeline adds the human curation loop.)
4. **Composed paragraphs instead of stacked sentences**: the composer
   currently prints the lead reading then bullet-point modifiers.
   Upgrade: weave lead + top modifiers into one flowing paragraph with
   varied connectives, and translate theme names into plain phrases.
5. **LLM enrichment (design §7, brought forward)**: optional, online,
   key-gated — rewrite the composed material for fluency in the chosen
   style, constrained to the supplied fragments (no invented astrology),
   cached per chart/style. Prototype behind a settings toggle.
6. **Benita feedback loop**: a lightweight "rate this reading" (👍/👎 +
   note) stored locally and exportable, so language QA has data.

### Sequencing

Stage 1a (next session): A1–A4, B1 — small code, immediate effect.
Stage 1b: A5–A8, B2, B4. Stage 1c: B3 pipeline + first review batch;
then B5/B6. Await part 2 of the transcript before locking 1b/1c.
