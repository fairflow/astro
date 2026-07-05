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

const CLASS_LINK: Record<AspectClass, string> = {
  neutral: 'is fused with',
  flowing: 'cooperates easily with',
  challenge: 'works against the grain of',
  adjusting: 'sits at an awkward angle to',
};

/**
 * Per-style effect phrasings — deliberately NOT shared between styles.
 * User test 1 found the styles read as identical wherever templates
 * shared sentences (finding F1); test/styles-distinct.spec.ts enforces
 * that no sentence is common to two styles for any pair.
 */
const EFFECT: Record<StyleId, Record<AspectClass, string>> = {
  jungian: {
    neutral: 'the two archetypes speak with one voice — a strength that never doubts itself, and a blind spot that cannot see itself',
    flowing: 'each lends the other strength without being asked, so their combined gift feels like simply "how I am"',
    challenge: 'each interrupts the other’s intent, and whichever is disowned returns through other people until both are given a seat',
    adjusting: 'the two archetypes never quite face each other; they must be introduced again and again, and the introductions are the growth',
  },
  mundane: {
    neutral: 'in practice they show up as a single package — situations rarely involve one without the other',
    flowing: 'day to day, progress in one area quietly carries the other along with it',
    challenge: 'commitments, people and priorities from the two areas collide on a regular basis, and the collisions are the pattern to plan around',
    adjusting: 'the two areas of life refuse to share a calendar; each accommodation holds for a while and then needs redoing',
  },
  energy: {
    neutral: 'both currents surge and ebb on one shared pulse',
    flowing: 'the currents run in phase — charge passes between them with almost no loss',
    challenge: 'the currents run counter-phase, and the interference is felt as heat: fuel when worked, friction when fought',
    adjusting: 'the currents drift in and out of phase and need continual small corrections to stay coupled',
  },
  minimal: {
    neutral: 'They act as one unit; take the package deal into account',
    flowing: 'They help each other without effort; low maintenance',
    challenge: 'They get in each other’s way until deliberately coordinated; budget for the friction',
    adjusting: 'They never fully sync; expect ongoing small corrections rather than a fix',
  },
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

const bareNoun = (noun: string) => noun.replace(/^the /, '');

/**
 * "How do you work it consciously?" (user test part 2): hard aspects
 * carry a practice line. Two variants per style, hash-varied by pair.
 */
const PRACTICE: Record<StyleId, Record<'challenge' | 'adjusting', string[]>> = {
  jungian: {
    challenge: [
      'Working it consciously: notice which of the two you identify with and which you keep meeting in other people — then give the second a deliberate seat: a time, a place, a say.',
      'To work it consciously, catch the moment one principle speaks for both; pause there and ask what the silenced one would have said.',
    ],
    adjusting: [
      'Consciously worked, this is maintenance rather than crisis: small scheduled acts of translation between two parts that will never share a language.',
      'The conscious version is a standing appointment between the two — brief, regular, renegotiated without drama.',
    ],
  },
  mundane: {
    challenge: [
      'Practically: put both demands on the calendar on purpose, and decide in advance which wins in which arena — so the collision happens on paper, not in life.',
      'The practical move is to stop improvising the clash: fixed times, fixed territories, and one honest review when they still collide.',
    ],
    adjusting: [
      'Practically, treat it like a chronic condition managed well: small routine adjustments, never a once-and-for-all fix.',
      'What works in practice is a light routine check: is the arrangement between these two areas still fair this month?',
    ],
  },
  energy: {
    challenge: [
      'Worked deliberately, the interference becomes rhythm: let one current run fully, then the other, and the alternation itself carries you.',
      'The practice is phase management — stop running both currents at peak at once; sequence them and collect the energy the clash was wasting.',
    ],
    adjusting: [
      'The practice is periodic re-tuning: brief, regular corrections keep the coupling alive at almost no cost.',
      'Small frequent nudges hold these currents in useful contact; postponed, the drift costs far more to correct.',
    ],
  },
  minimal: {
    challenge: [
      'To work it: name which one is active right now, schedule the other, review weekly.',
      'Method: pick lanes for each, keep to them, revisit when they still collide.',
    ],
    adjusting: [
      'Method: small standing adjustments. There is no permanent fix; stop waiting for one.',
      'Keep a light routine check on this pair; that is the whole method.',
    ],
  },
};

/**
 * Lead-sentence skeletons, hash-varied by pair, so the same construction
 * doesn't open every reading (user test part 2: "it just says the same
 * thing everywhere").
 */
function lead(
  a: BodyKey, b: BodyKey, klass: AspectClass, style: StyleId, eff: string,
): string {
  const A = PLANET_PROFILE[a], B = PLANET_PROFILE[b];
  const na = BODY_NAME[a], nb = BODY_NAME[b];
  const skeletons: Record<StyleId, string[]> = {
    jungian: [
      `${cap(A.noun)} ${CLASS_LINK[klass]} ${B.noun}: ${eff}.`,
      `Here ${bareNoun(A.noun)} and ${bareNoun(B.noun)} are bound into one figure, and ${eff}.`,
      `An inner dialogue runs between ${bareNoun(A.noun)} and ${bareNoun(B.noun)}: ${eff}.`,
    ],
    mundane: [
      `Matters of ${themeWords(a)} and ${themeWords(b)} arrive together in outer life: ${eff}.`,
      `${na} business and ${nb} business tend to land in the same week: ${eff}.`,
      `Life keeps booking ${na} and ${nb} into the same room: ${eff}.`,
    ],
    energy: [
      `The ${na} current (${A.drive}) and the ${nb} current (${B.drive}) are coupled: ${eff}.`,
      `Two currents share this stretch of the field — ${A.drive}, and ${B.drive} — and ${eff}.`,
      `Where ${na} flows, ${nb} responds: ${eff}.`,
    ],
    minimal: [
      `${na} ${klassWord(klass)} ${nb}. ${eff}.`,
      `${na} and ${nb}: ${eff}.`,
    ],
  };
  return vary(a, b, skeletons[style]);
}

export function pairText(
  a: BodyKey, b: BodyKey, klass: AspectClass, style: StyleId,
): string {
  const eff = EFFECT[style][klass];
  const opening = lead(a, b, klass, style, eff);
  const practice = (klass === 'challenge' || klass === 'adjusting')
    ? ' ' + vary(b, a, PRACTICE[style][klass])
    : '';
  switch (style) {
    case 'jungian':
      return `${opening} ${vary(a, b, JUNGIAN_CODA)}${practice}`;
    case 'mundane':
      return `${opening}${practice ? practice : ` Expect situations in which ${BODY_NAME[a]} concerns and ${BODY_NAME[b]} concerns must be handled at once.`}`;
    case 'energy':
      return `${opening} ${vary(a, b, ENERGY_CODA)}${practice}`;
    case 'minimal':
      return `${opening}${practice}`;
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
