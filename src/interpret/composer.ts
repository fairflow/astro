import type { Aspect, AspectClass } from '../chart/aspects.js';
import type { Chart } from '../chart/chart.js';
import type { BodyKey } from '../ephemeris/types.js';
import { BODY_NAME } from '../render/glyphs.js';
import { pairKey } from './library.js';
import { getNatalLibrary } from './textstore.js';
import { pairText } from './templates.js';
import { PLANET_PROFILE } from './vocab.js';
import {
  add, dot, scale, type Reading, type StyleId, type ThemeVector,
} from './types.js';

/** Sign and strength each aspect class contributes to the theme vector. */
const CLASS_SIGN: Record<AspectClass, number> = {
  flowing: 1, neutral: 0.7, challenge: -1, adjusting: -0.5,
};

/**
 * The aspect's signature over the theme vocabulary: both planets' themes,
 * signed by aspect class, scaled by orb tightness. This is what makes
 * "does aspect X reinforce or contradict aspect Y" computable.
 */
export function aspectVector(a: Aspect): ThemeVector {
  const tight = 1 - a.orb / a.maxOrb;
  const sign = CLASS_SIGN[a.def.klass];
  return scale(
    add(PLANET_PROFILE[a.a].themes, PLANET_PROFILE[a.b].themes),
    sign * (0.4 + 0.6 * tight),
  );
}

export type Relation = 'reinforces' | 'eases' | 'complicates' | 'colours';

export interface Modifier {
  aspect: Aspect;
  shared: BodyKey;
  relation: Relation;
}

const DOT_THRESHOLD = 0.35;

function relate(subject: Aspect, other: Aspect): Relation {
  const d = dot(aspectVector(subject), aspectVector(other));
  if (d > DOT_THRESHOLD) return 'reinforces';
  if (d < -DOT_THRESHOLD) {
    // A flowing counter-vector eases a hard aspect; a hard one complicates.
    return CLASS_SIGN[other.def.klass] > 0 ? 'eases' : 'complicates';
  }
  return 'colours';
}

/** Shared-planet aspects, strongest first — the composer's raw material. */
export function modifiersFor(chart: Chart, subject: Aspect, max = 4): Modifier[] {
  return chart.aspects
    .filter(x => x !== subject
      && (x.a === subject.a || x.b === subject.a || x.a === subject.b || x.b === subject.b))
    .slice(0, max)
    .map(x => ({
      aspect: x,
      shared: (x.a === subject.a || x.b === subject.a) ? subject.a : subject.b,
      relation: relate(subject, x),
    }));
}

export function modifierSentence(m: Modifier, style: StyleId): string {
  const pair = `${BODY_NAME[m.aspect.a]} ${m.aspect.def.name} ${BODY_NAME[m.aspect.b]}`;
  const shared = BODY_NAME[m.shared];
  const verb: Record<Relation, string> = {
    reinforces: 'deepens the same current',
    eases: 'offers an easier outlet for the same material',
    complicates: 'pulls the shared factor the other way',
    colours: 'colours how it is expressed',
  };
  if (style === 'minimal') {
    return `${pair}: ${m.relation === 'colours' ? 'modifies' : m.relation} this via ${shared}.`;
  }
  return `${pair} shares ${shared} and ${verb[m.relation]}.`;
}

/** Library text if authored, template otherwise. */
export function readingFor(a: Aspect, style: StyleId): Reading {
  const entry = getNatalLibrary()[pairKey(a.a, a.b)]?.[a.def.klass];
  if (entry) return { text: entry[style], source: 'authored' };
  return { text: pairText(a.a, a.b, a.def.klass, style), source: 'template' };
}

export interface Tension {
  a: Aspect;
  b: Aspect;
  /** Most-opposed theme between the two vectors. */
  theme: string;
  score: number;
}

/**
 * Chart-level contradiction scan: aspect pairs whose theme vectors are
 * strongly opposed. Deliberately *not* averaged away — surfaced instead
 * (DESIGN.md §7): both patterns are true, in different contexts.
 */
export function tensionReport(chart: Chart, maxPairs = 4): Tension[] {
  const out: Tension[] = [];
  const asp = chart.aspects;
  for (let i = 0; i < asp.length; i++) {
    for (let j = i + 1; j < asp.length; j++) {
      const va = aspectVector(asp[i]!), vb = aspectVector(asp[j]!);
      const d = dot(va, vb);
      if (d >= -0.5) continue;
      let theme = '', worst = 0;
      for (const k in va) {
        const p = va[k]! * (vb[k] ?? 0);
        if (p < worst) { worst = p; theme = k; }
      }
      if (theme) out.push({ a: asp[i]!, b: asp[j]!, theme, score: d });
    }
  }
  return out.sort((x, y) => x.score - y.score).slice(0, maxPairs);
}

export function tensionText(t: Tension, style: StyleId): string {
  const A = `${BODY_NAME[t.a.a]} ${t.a.def.name} ${BODY_NAME[t.a.b]}`;
  const B = `${BODY_NAME[t.b.a]} ${t.b.def.name} ${BODY_NAME[t.b.b]}`;
  switch (style) {
    case 'jungian':
      return `${A} and ${B} pull the theme of ${t.theme} in opposite directions. Both are true; the psyche tends to live one and project the other until they are consciously held together — this is material for integration, not a fault to fix.`;
    case 'mundane':
      return `${A} and ${B} give contradictory instructions about ${t.theme}. Expect to satisfy one in one part of life (say, work) and the other elsewhere (say, home), or to alternate between them by season.`;
    case 'energy':
      return `${A} and ${B} drive the ${t.theme} current in counter-phase — the interference pattern is felt as oscillation. Ride the alternation deliberately rather than bracing against it; each pole recharges the other.`;
    case 'minimal':
      return `${A} vs ${B}: contradictory pulls on ${t.theme}. Both real. Expect oscillation; plan for both.`;
  }
}
