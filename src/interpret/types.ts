export type StyleId = 'jungian' | 'mundane' | 'energy' | 'minimal';

export const STYLES: { id: StyleId; label: string }[] = [
  // id stays 'jungian' internally; label renamed after user test 1
  // (docs/plans/2026-07-05-usertest-stage1.md, finding F2).
  { id: 'jungian', label: 'Psychological' },
  { id: 'mundane', label: 'Mundane' },
  { id: 'energy', label: 'Energy' },
  { id: 'minimal', label: 'Minimal' },
];

/**
 * Sparse signed weights over the controlled theme vocabulary (vocab.ts).
 * Sign encodes direction: +supports/expands the theme, -restricts/strains
 * it. Dot products between aspect vectors drive the composer's
 * reinforce/counterpoint connectives and the tension report.
 */
export type ThemeVector = Record<string, number>;

export type StyleTexts = Record<StyleId, string>;

export interface Reading {
  text: string;
  source: 'authored' | 'template';
}

export function dot(a: ThemeVector, b: ThemeVector): number {
  let s = 0;
  for (const k in a) {
    const bv = b[k];
    if (bv !== undefined) s += a[k]! * bv;
  }
  return s;
}

export function scale(v: ThemeVector, f: number): ThemeVector {
  const out: ThemeVector = {};
  for (const k in v) out[k] = v[k]! * f;
  return out;
}

export function add(a: ThemeVector, b: ThemeVector): ThemeVector {
  const out: ThemeVector = { ...a };
  for (const k in b) out[k] = (out[k] ?? 0) + b[k]!;
  return out;
}
