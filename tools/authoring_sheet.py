#!/usr/bin/env python3
"""Generate an authoring batch (worksheet .md + app .json) for Stage 1c A.

Wave 0 = the frame: 6 sign axes + 12 sign inflections, straw-man texts
pre-filled from SIGN_TONE (read out of src/interpret/vocab.ts) so B sees
the template flatness as contrast. C overwrites the straw men during
drafting; the in-app Authoring tab reads the JSON.

Usage:
  .venv/bin/python tools/authoring_sheet.py --wave 0
Writes:
  authoring/batch-00.md
  data/authoring/batch-00.json
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]
# (index, opposite index) for the six polarity axes
AXES = [(i, i + 6) for i in range(6)]

REGISTERS = ['jungian', 'mundane', 'energy', 'minimal']
REGISTER_LABEL = {
    'jungian': 'PSYCHOLOGICAL', 'mundane': 'MUNDANE',
    'energy': 'ENERGY', 'minimal': 'MINIMAL',
}


def sign_tones() -> list[str]:
    """Extract the SIGN_TONE strings from vocab.ts (single source of truth)."""
    src = (ROOT / 'src/interpret/vocab.ts').read_text()
    block = re.search(r'SIGN_TONE = \[(.*?)\];', src, re.S)
    if not block:
        raise SystemExit('SIGN_TONE not found in vocab.ts')
    tones = re.findall(r"'([^']+)',", block.group(1))
    if len(tones) != 12:
        raise SystemExit(f'expected 12 tones, found {len(tones)}')
    return tones


def strawman_texts(kernel: str) -> dict[str, str]:
    """Deliberately flat template renderings — the contrast B reacts against."""
    return {
        'jungian': f'{kernel} Consciously held, this polarity becomes a dialogue rather than a tug-of-war.',
        'mundane': f'{kernel} In practical life this shows as swings between the two styles.',
        'energy': f'{kernel} The energy oscillates between the two poles until it finds a rhythm.',
        'minimal': kernel,
    }


def wave0_slots() -> list[dict]:
    tones = sign_tones()
    slots: list[dict] = []
    for a, b in AXES:
        kernel = (
            f'{SIGNS[a]} ({tones[a]}) and {SIGNS[b]} ({tones[b]}) are one axis: '
            f'each pole implies and needs the other.'
        )
        slots.append({
            'id': f'axis-{SIGNS[a].lower()}-{SIGNS[b].lower()}',
            'kind': 'sign-axis',
            'label': f'{SIGNS[a]}–{SIGNS[b]} axis',
            'kernel': kernel,
            'texts': strawman_texts(kernel),
            'markers': [tones[a].split(',')[0], tones[b].split(',')[0]],
            'ask': f'Where does life pull you toward the {SIGNS[b]} pole when you lead with {SIGNS[a]} — and the reverse?',
            'strawman': True,
        })
    for i, sign in enumerate(SIGNS):
        opp = SIGNS[(i + 6) % 12]
        kernel = (
            f'{sign}: {tones[i]}. Its shadow and complement is {opp} '
            f'({tones[(i + 6) % 12]}).'
        )
        slots.append({
            'id': f'sign-{sign.lower()}',
            'kind': 'sign-inflection',
            'label': f'{sign} (pole of the {sign}–{opp} axis)',
            'kernel': kernel,
            'texts': strawman_texts(kernel),
            'markers': [t.strip() for t in tones[i].split(',')[:2]],
            'ask': f'When {sign} overdoes its own style, what would borrowing from {opp} look like?',
            'strawman': True,
        })
    return slots


def write_markdown(path: Path, batch: dict) -> None:
    lines = [f'# Authoring batch {batch["batch"]:02d} — {batch["title"]}', '']
    lines.append('Marks: ✓ lands · ~ flat · ✗ wrong/preachy. React, don\'t analyse.')
    lines.append('')
    for s in batch['slots']:
        lines.append(f'## {s["id"]} · {s["kind"]}')
        lines.append(f'KERNEL: {s["kernel"]}')
        for reg in REGISTERS:
            lines.append(f'{REGISTER_LABEL[reg]}: {s["texts"][reg]} | B:')
        lines.append(f'MARKERS: {", ".join(s["markers"])} | ASK: {s["ask"]}')
        lines.append('')
    path.write_text('\n'.join(lines))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--wave', type=int, default=0)
    args = ap.parse_args()
    if args.wave != 0:
        raise SystemExit('only wave 0 is implemented so far')

    batch = {
        'batch': 0,
        'wave': 0,
        'title': 'Wave 0 — sign axes & inflections (the frame)',
        'slots': wave0_slots(),
    }
    (ROOT / 'authoring').mkdir(exist_ok=True)
    (ROOT / 'data/authoring').mkdir(parents=True, exist_ok=True)
    md = ROOT / f'authoring/batch-{batch["batch"]:02d}.md'
    js = ROOT / f'data/authoring/batch-{batch["batch"]:02d}.json'
    write_markdown(md, batch)
    js.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {md.relative_to(ROOT)} ({len(batch["slots"])} slots)')
    print(f'wrote {js.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
