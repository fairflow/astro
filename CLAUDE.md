# Astro — project instructions for AI agents

Astrology app: offline ephemeris, interactive SVG chart wheels, Placidus
houses, transits/synastry/composites, multi-style psychological
interpretations. Local-first PWA (no server code, no accounts).

**Start Claude Code sessions in THIS directory** (`~/Projects/private/astro`),
not in the Finance repo — this project has its own conventions, tracker and
preview servers.

## Build & test

```bash
npm install
npm test             # vitest: 138 golden/unit tests (must stay green)
npm run typecheck    # tsc --noEmit (must stay clean)
npm run dev          # vite dev server on :8322 (see .claude/launch.json)
npm run build        # static dist/ incl. ephemeris packs + gazetteer

# Python tooling (dev-only; pyswisseph is AGPL and never ships):
python3 -m venv .venv && .venv/bin/pip install pyswisseph numpy
.venv/bin/python tools/golden_refs.py    # regenerate golden references
.venv/bin/python tools/make_packs.py     # asteroid packs from JPL Horizons
.venv/bin/python tools/make_gazetteer.py # place index from GeoNames
```

## Architecture (one paragraph)

`src/ephemeris/` supplies positions behind the `EphemerisProvider`
interface (astronomy-engine for Sun–Pluto; committed Chebyshev packs in
`data/packs/` for Chiron/Ceres/Pallas/Juno/Vesta/Eris; analytic
Node/Lilith). `src/chart/` computes charts: time/civil (IANA zones via
Intl), Placidus houses (Porphyry fallback above polar circles), aspects
with standard orbs, and `relate.ts` for cross-chart work (transits,
synastry, midpoint composites, Ebertin midpoints). `src/interpret/` is
the reading engine: theme-vector composer, authored library + template
fallback (four styles: jungian/mundane/energy/minimal), per-context
voices (natal/transit/synastry/composite — never shared verbatim,
enforced by test), themed dossiers. `src/render/` + `src/ui/` are the
SVG wheel (own tunable glyph kit in `glyphset.ts`) and Svelte 5
components. `docs/DESIGN.md` is the design of record;
`docs/research/` holds sourced conventions.

## Conventions

- Positions are validated against golden references (Swiss Ephemeris,
  held-out JPL Horizons samples) — never weaken tolerances to pass.
- Birth data is the source of truth; computed positions are recomputed,
  not trusted from storage.
- Interpretation texts carry `source: authored | template`; the UI
  badges them. Keep the four styles genuinely distinct in register.
- Licensing: bundle only MIT/public-domain-data. Swiss Ephemeris
  (AGPL/commercial) and its `.se1` files are dev-side only
  (`*.se1` is gitignored).
- Issue tracking: GitHub issues on fairflow/astro (bd on this machine
  currently binds to the Finance workspace DB; revisit per-repo beads).
- Do not commit or push without being asked; report status instead.

## Serving / testing locally

`.claude/launch.json` defines preview servers. The built `dist/` is a
plain static bundle — any static host or `python3 -m http.server` works.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
