import type { BodyKey } from '../ephemeris/types.js';
import type { AspectClass } from '../chart/aspects.js';
import { BODY_NAME } from '../render/glyphs.js';
import { HOUSE_ARENA, PLANET_PROFILE, SIGN_TONE } from './vocab.js';
import type { StyleId } from './types.js';

/**
 * Deterministic fallback text. Every factor gets *something* coherent in
 * every style; authored library entries (library.ts) override these for
 * the high-salience keys. Template output is marked as such in the UI.
 */

const CLASS_VERB: Record<AspectClass, { link: string; effect: string }> = {
  neutral: { link: 'is fused with', effect: 'they operate as one function, for better and worse' },
  flowing: { link: 'cooperates easily with', effect: 'the two functions feed each other with little friction' },
  challenge: { link: 'works against the grain of', effect: 'the two functions interrupt each other until consciously worked' },
  adjusting: { link: 'sits at an awkward angle to', effect: 'the two functions never quite meet and require perpetual small adjustments' },
};

const JUNGIAN_CODA = [
  'Left unconscious, one pole tends to be lived and the other projected onto people and circumstances; held consciously, the pairing becomes a working partnership of the two archetypes.',
  'The invitation is to hold both principles at once rather than letting one speak for the pair — what is disowned here returns from outside.',
  'Neither principle wins by silencing the other; the personality matures exactly as far as it lets both have a voice.',
];
const ENERGY_CODA = [
  'Watch their build, peak and release phases arrive as a pair across the relevant cycles.',
  'When one current surges, listen for the other — they fire together, whether or not that is convenient.',
  'The coupling is constant; only its phase changes with the transiting cycles.',
];

function vary(a: BodyKey, b: BodyKey, list: string[]): string {
  return list[(a.length * 7 + b.length * 3) % list.length]!;
}

export function pairText(
  a: BodyKey, b: BodyKey, klass: AspectClass, style: StyleId,
): string {
  const A = PLANET_PROFILE[a], B = PLANET_PROFILE[b];
  const na = BODY_NAME[a], nb = BODY_NAME[b];
  const v = CLASS_VERB[klass];
  switch (style) {
    case 'jungian':
      return `${cap(A.noun)} ${v.link} ${B.noun}: ${v.effect}. ${vary(a, b, JUNGIAN_CODA)}`;
    case 'mundane':
      return `Matters of ${themeWords(a)} and ${themeWords(b)} arrive together in outer life. ${cap(v.effect)} — expect situations in which ${na} concerns and ${nb} concerns must be handled at once.`;
    case 'energy':
      return `The ${na} current (${A.drive}) and the ${nb} current (${B.drive}) are coupled: ${v.effect}. ${vary(a, b, ENERGY_CODA)}`;
    case 'minimal':
      return `${na} ${klassWord(klass)} ${nb}. ${cap(v.effect)}.`;
  }
}

function klassWord(k: AspectClass): string {
  return k === 'neutral' ? 'merged with'
    : k === 'flowing' ? 'supports'
    : k === 'challenge' ? 'strains against'
    : 'keeps adjusting to';
}

function themeWords(b: BodyKey): string {
  return Object.keys(PLANET_PROFILE[b].themes).slice(0, 2).join(' and ');
}

function article(s: string): string {
  return /^[aeiou]/i.test(s) ? 'an' : 'a';
}

export function inSignText(body: BodyKey, sign: number, style: StyleId): string {
  const P = PLANET_PROFILE[body];
  const tone = SIGN_TONE[sign]!;
  switch (style) {
    case 'jungian':
      return `${cap(P.noun)} wears ${article(tone)} ${tone} guise here.`;
    case 'mundane':
      return `${BODY_NAME[body]} expresses itself in ${article(tone)} ${tone} manner.`;
    case 'energy':
      return `The ${BODY_NAME[body]} current runs ${tone}.`;
    case 'minimal':
      return `${BODY_NAME[body]}: ${tone}.`;
  }
}

export function inHouseText(body: BodyKey, house: number, style: StyleId): string {
  const arena = HOUSE_ARENA[house - 1]!;
  switch (style) {
    case 'jungian':
      return `Its stage is ${arena} — the arena where this archetype asks to be met.`;
    case 'mundane':
      return `It plays out concretely in ${arena}.`;
    case 'energy':
      return `Its charge gathers around ${arena}.`;
    case 'minimal':
      return `Field: ${arena}.`;
  }
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
