# Research note: an internal language for interpretation composition

*2026-07-07. Spun off from the Stage 1c Phase A scope at M's prompt: "as a
logician and researcher into process calculi I wonder if there's an internal
language that is richer and yet more precise than human language which, when
adequately translated into humanish, gives a better result" — evaluated
here; one bounded experiment proposed.*

## What we already have (the honest starting point)

The engine is not text-only today. Under the prose there is a
proto-interlingua:

- **Theme vectors** (19 controlled dimensions, `vocab.ts`) — each planet,
  sign and aspect projects into them; the tension report is vector algebra.
- **Planet profiles** — typed noun/drive per body.
- **Aspect classes** — flowing / challenge / neutral (+ adjusting).
- **Modifier relations** — `reinforces / eases / complicates` between
  aspects sharing a body: a small, genuine relation algebra.

The weakness M senses is real, but it is in **realization** (structured
facts → English), which currently happens too early: texts are composed by
concatenating pre-rendered English, so the connectives ("and", "but",
"which is modified by…") carry all the compositional load and flatten.

## Candidate formalisms, evaluated

**1. Typed frames + rhetorical structure (RST) — the strong candidate.**
Represent a reading as typed predicates —
`FUSE(sun, jupiter)`, `TENSION(moon, saturn, 0.83)`,
`LOCATE(moon, house=1, sign=cancer)`, `SHADOW(scorpio, taurus)` —
composed into a small discourse tree whose internal nodes are *typed
rhetorical relations*: CONTRAST, CONCESSION, ELABORATION, RESULT,
BACKGROUND. Mann & Thompson's Rhetorical Structure Theory is exactly a
formal calculus of "and/or/implies/contradicts" at discourse level, and
"contradicts" splits usefully (ANTITHESIS: one side wins; CONCESSION:
both stand). Each register then owns a **realizer**: a mapping from
relation × position → surface pattern. The same tree renders four ways —
register variety becomes systematic instead of hand-kept.

**2. Meaning-Text Theory (Mel'čuk) — steal one idea.** Lexical functions
(`Magn` = intensifier-of, `AntiMagn`, `Oper`…) generate principled
paraphrase families from one semantic representation. We don't need the
whole MTT stack; a lexicon of per-register `Magn`/`AntiMagn` choices for
our ~19 themes ("survival intensity" vs "at full volume" vs "loudly")
directly attacks the wooden-sameness problem at the phrase level.

**3. Systemic Functional Grammar (Halliday) — a lens, not a tool.** Our
four styles are register bundles in the SFG sense (field/tenor/mode:
Psychological = high modality + mental-process verbs; Minimal = low mood
elaboration, ellipsis). Useful as a *checklist* for the register lint and
the distinctness test; adopting a full SFG realizer (KPML-class) is far
too heavy for this project.

**4. Process calculi — M's home turf, and a better fit than it first
looks.** Read factors as concurrent processes and aspects as
synchronizations: a natal chart is a parallel composition
`Sun | Moon | Saturn | …` with channels where aspects hold; modifiers are
interference between synchronizations sharing a process. What a calculus
buys is **laws**: commutativity/associativity of composition (reading
order must not change meaning), idempotence bounds (the same tension
stated twice must collapse), and a bisimulation-flavoured test — two
charts whose factor systems are behaviourally equivalent should generate
readings that differ only in surface. These become *property tests* for
the composer regardless of representation. As a generator, though, a
process calculus is a semantics without a voice — it still needs the
RST/realizer layer on top. Verdict: adopt the laws, not the syntax.

**5. Distributional/embedding blends — rejected** for the core: not
inspectable, not testable, and the register lint cannot hold it. (An LLM
enrichment layer remains a separate, later concern with its own plan.)

## Proposed experiment (timeboxed: one evening)

1. Define ~10 predicate types + 6 rhetorical relations (TypeScript types,
   ~50 lines).
2. Hand-encode **three existing authored pairs** (e.g. moon-saturn
   challenge, sun-moon flowing, venus-mars neutral) as trees.
3. Write a minimal realizer per register: relation × register → connective
   / clause pattern; phrase lexicon with one `Magn` set per theme.
4. Regenerate the twelve texts; put originals and regenerated side by side
   in a blind sheet for B's ✓/~/✗ (she need not know which is which).

**Success criterion:** regenerated texts score no worse than the authored
originals for B, while the tree form demonstrably re-renders into a second
context (natal → synastry re-voicing by relation rewriting) with no new
prose. That last property is the prize: one kernel, many contexts.

**Decision rule:** if it wins, Phase A kernels graduate from prose to
trees + phrase lexicon, and the batch loop authors *those* (C encodes,
B still reacts to rendered prose only — her loop does not change). If it
loses, we keep prose kernels and the experiment cost one evening.

**Do not block on it:** Phase A batches start with prose kernels either
way; trees can be retrofitted batch by batch.
