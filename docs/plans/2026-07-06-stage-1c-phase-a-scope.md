# Stage 1c · Phase A — Authoring the interpretation corpus

*Scope prepared 2026-07-06 (overnight session), for the three-way authoring
dialogue: Benita (B), Matthew (M), Claude (C).*

## Goal

Replace template-composed interpretation prose with **authored texts at
scale**, written in the app's voice, tested against a real reader (B), while
keeping the composer (modifiers, tension report, markers, practice lines) as
the combination engine. Phase A produces the corpus + tooling; Phase B burns
it into a field-test deployment.

## Where we stand (measured tonight)

| Pack | Authored now | Full space |
|---|---|---|
| `library.natal.json` | 8 pairs × 3 classes × 4 styles = 96 texts | 153 pairs × 3 × 4 ≈ 1 836 |
| `library.transit.json` | 6 pairs (32 texts) | ~40 practically-wanted pairs |
| `bodyintro.json` | 72 (18 bodies × 4 styles) — complete | — |
| `glossary.json` | 24 — complete | — |
| synastry / composite voices | template-only (per-context re-voicing) | as natal |

Everything not authored falls back to templates: grammatically sound, but the
"wooden sameness" B flagged. **We do not need 1 836 texts.** Frequency and
felt-importance are wildly skewed — the plan is authored coverage where
readers actually land, templates (recently improved) as the long tail.

## Priority order (authoring queue)

1. **Wave 1 — the felt core (~30 pairs, hard classes first):**
   luminaries × personal planets and luminaries × Saturn/Pluto/Chiron/Node;
   Venus/Mars crosses. These are the aspects users tap first and remember.
2. **Wave 2 — personal × outer (~35 pairs):** Mercury/Venus/Mars ×
   Jupiter…Pluto; the generational-meets-personal texts where templates
   sound flattest.
3. **Wave 3 — transits (~25 pairs):** slow movers to luminaries/angles-rulers
   (Saturn/Uranus/Neptune/Pluto/Jupiter/Chiron × Sun/Moon/Mercury/Venus/Mars).
4. **Wave 4 — synastry voice pass:** not new pairs; a re-voicing table so
   authored natal texts project into "your X, their Y" without re-authoring
   each one. Only the ~20 highest-heat pairs get bespoke synastry texts.
5. **Deliberately not authored:** minor×minor, quincunxes beyond the core,
   composite (keeps context re-voicing).

Each pair needs its 3 classes (flowing / challenge / neutral-conjunction)
× 4 styles — but styles can be **drafted as a set** (one meaning kernel,
four register renderings), which is how the 8 existing pairs were written.

## The three-way dialogue — working protocol

A repeating **batch loop**, sized so one session ≈ one evening:

1. **C drafts** a worksheet of 6–8 pairs (one wave slice): for each pair a
   short *meaning kernel* (2–3 lines, style-free) plus the 12 renderings.
   Each text carries the existing register rules (Psychological/Mundane/
   Energy/Minimal), the marker keywords, and one "Ask:" question.
2. **B reads cold** — in the app or on the worksheet — and marks each text
   ✓ (lands) / ~ (flat) / ✗ (wrong or preachy), with a phrase of reaction
   where moved. No analysis required of her; reaction *is* the data
   (she said she is not "that analytical" — the format must respect that).
3. **M arbitrates** voice: rewrites or accepts, guards the register
   boundaries, kills anything that moralises.
4. **C consolidates** into the JSON packs with provenance, re-runs the
   distinctness tests, ships to the field-test build; the next batch starts.

Batch maths: wave 1 = ~30 pairs ≈ 4–5 batches. At one batch/week the felt
core is authored in about a month; waves 2–3 follow at whatever cadence
holds. (There is no deadline pressure — quality of voice is the product.)

## Worksheet format (round-trips to JSON)

One markdown file per batch, `authoring/batch-NN.md`, machine-parseable:

```markdown
## moon-saturn · challenge
KERNEL: feeling meets the wall of duty; warmth learned late, then reliable
PSYCHOLOGICAL: <text>            | B: ✓/~/✗ <phrase>
MUNDANE: <text>                  | B:
ENERGY: <text>                   | B:
MINIMAL: <text>                  | B:
MARKERS: withheld warmth, earned trust | ASK: <question>
```

## Tooling to build (small, in `tools/`)

- `authoring_sheet.py` — generate a batch worksheet from the queue with
  current template output pre-filled as a straw man (C overwrites; seeing
  the template's flatness is useful contrast for B).
- `authoring_ingest.py` — parse a completed worksheet back into
  `data/texts/library.natal.json` (+ transit), validate against the pack
  schema, tag provenance, refuse texts that fail the register lint
  (banned-word list: "honestly", moralising imperatives, asterisks).
- Provenance field per text: `{"src": "1c-A", "batch": 3, "status":
  "accepted" | "b-flagged"}` — pack loader ignores it; the ingest tool and
  future audits use it. (Pack format change is additive, no app code
  breaks; `readingFor` keeps its AUTHORED/TEMPLATE badge behaviour.)

## Acceptance criteria per batch

- All 12 renderings pass `styles-distinct` (already test-enforced) and the
  register lint; B has seen every text; anything ✗ is rewritten or dropped
  before merge; the pack diff is reviewed in a PR like code.

## Risks / mitigations

- **Voice drift across batches** → the kernel line is kept in the worksheet
  history; C re-reads the accepted corpus before drafting each batch.
- **Combinatorial creep** ("shouldn't X-Y also be authored?") → the queue is
  the contract; additions go to the END of a wave, never mid-batch.
- **B fatigue** → batches capped at ~100 short texts; reaction marks only.
- **Style flattening** (all four registers converging) → distinctness test
  plus M's arbitration pass.

## Phase B gate

Phase A is "done enough" for the Phase B burn-in when: wave 1 fully
authored + ingested, wave 2 ≥ half, transit wave started, and B can use the
app for a full session without hitting a text she has flagged and not seen
fixed.
