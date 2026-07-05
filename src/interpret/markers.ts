import type { Aspect } from '../chart/aspects.js';
import { PLANET_PROFILE } from './vocab.js';

/**
 * Conversation markers (user test part 2): Benita reads a passage once,
 * then needs compact hooks to hold in mind while speaking with a
 * client — keywords plus one open question. Deterministic, from the
 * planet profiles; authored entries may override later.
 */
export interface Markers {
  keywords: string[];
  question: string;
}

export function markersFor(a: Aspect): Markers {
  const A = PLANET_PROFILE[a.a], B = PLANET_PROFILE[a.b];
  const themeA = Object.keys(A.themes)[0] ?? '';
  const themeB = Object.keys(B.themes)[0] ?? '';
  const keywords = [
    `${A.drive} ↔ ${B.drive}`,
    themeA === themeB ? themeA : `${themeA} / ${themeB}`,
    `${a.def.name}${a.orb < 1 ? ' (exact)' : ''}`,
  ];
  const sideA = `the ${A.drive} side`, sideB = `the ${B.drive} side`;
  const q: Record<Aspect['def']['klass'], string> = {
    challenge: `When ${sideA} and ${sideB} last collided, which gave way — and at what cost?`,
    flowing: `Where does ${sideA} quietly rely on ${sideB} — and is that gift used, or coasted on?`,
    neutral: `Can you tell ${sideA} apart from ${sideB} — or do they always move as one?`,
    adjusting: `What small recurring adjustment between ${sideA} and ${sideB} have you stopped noticing?`,
  };
  return { keywords, question: q[a.def.klass] };
}
