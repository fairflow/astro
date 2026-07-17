#!/usr/bin/env python3
"""Validate (and later: ingest) an authoring batch.

Current scope: --validate checks a batch JSON against the schema the
Authoring tab and the pack merger rely on, plus a basic register lint.
Merging accepted texts into data/texts/*.json is TODO (next batch loop).

Usage:
  .venv/bin/python tools/authoring_ingest.py --validate data/authoring/batch-00.json
Exit 0 = valid; exit 1 = problems (listed on stdout).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REGISTERS = ['jungian', 'mundane', 'energy', 'minimal']
KINDS = {'sign-axis', 'sign-inflection', 'house-axis', 'house-inflection',
         'body-in-sign', 'body-in-house', 'body-intro', 'aspect-pair'}
# Register lint. Bans rhetorical hedges ("honestly/frankly/candidly" — filler
# that fakes candour) and asterisks (the app renders plain text, so markdown
# emphasis would show literally). NB: the *adjective* "honest" is legitimate
# and deliberately allowed — the old \bhonest(ly)?\b also caught it.
BANNED = re.compile(r'\bhonestly\b|\bfrankly\b|\bcandidly\b|\*', re.I)


def validate(path: Path) -> list[str]:
    problems: list[str] = []
    try:
        batch = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        return [f'unreadable: {e}']

    for key in ('batch', 'wave', 'title', 'slots'):
        if key not in batch:
            problems.append(f'missing top-level key: {key}')
    slots = batch.get('slots', [])
    if not isinstance(slots, list) or not slots:
        problems.append('slots must be a non-empty list')
        return problems

    seen: set[str] = set()
    for n, s in enumerate(slots):
        where = f'slot {n} ({s.get("id", "?")})'
        for key in ('id', 'kind', 'label', 'kernel', 'texts', 'markers', 'ask'):
            if key not in s:
                problems.append(f'{where}: missing {key}')
        sid = s.get('id')
        if sid in seen:
            problems.append(f'{where}: duplicate id')
        seen.add(sid)
        if s.get('kind') not in KINDS:
            problems.append(f'{where}: unknown kind {s.get("kind")!r}')
        texts = s.get('texts', {})
        for reg in REGISTERS:
            t = texts.get(reg)
            if not isinstance(t, str) or not t.strip():
                problems.append(f'{where}: texts.{reg} missing/empty')
            elif BANNED.search(t):
                problems.append(f'{where}: texts.{reg} fails register lint (banned word/asterisk)')
        if not isinstance(s.get('markers'), list):
            problems.append(f'{where}: markers must be a list')
    return problems


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--validate', metavar='BATCH_JSON', required=True)
    args = ap.parse_args()
    problems = validate(Path(args.validate))
    if problems:
        print(f'{len(problems)} problem(s):')
        for p in problems:
            print(f'  - {p}')
        sys.exit(1)
    print('valid ✓')


if __name__ == '__main__':
    main()
