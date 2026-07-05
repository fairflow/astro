import type { Aspect, AspectClass } from '../chart/aspects.js';
import type { BodyKey } from '../ephemeris/types.js';
import { BODY_NAME } from '../render/glyphs.js';
import { PLANET_PROFILE } from './vocab.js';
import { cap } from './templates.js';
import type { Reading, StyleId, StyleTexts } from './types.js';
import { pairKey } from './library.js';

/**
 * Interpretation contexts. The same geometric aspect reads differently
 * as a natal pattern, a transit, a synastry inter-aspect, or a composite
 * placement — so each context has its OWN template voice and its own
 * authored overrides. Nothing is shared verbatim across contexts.
 */
export type ReadingContext = 'natal' | 'transit' | 'synastry' | 'composite';

/* ---------------- transit ---------------- */

/** Rough transit tempo by transiting body (per pass, not whole period). */
const TEMPO: Partial<Record<BodyKey, string>> = {
  sun: 'a few days', moon: 'a few hours', mercury: 'a few days',
  venus: 'about a week', mars: 'one to two weeks',
  jupiter: 'a few weeks per pass', saturn: 'several weeks per pass',
  uranus: 'months per pass', neptune: 'months per pass',
  pluto: 'months per pass', chiron: 'weeks to months per pass',
};

const TRANSIT_MODE: Record<AspectClass, string> = {
  neutral: 'initiates a new chapter in',
  flowing: 'opens an easy channel into',
  challenge: 'forces a reckoning with',
  adjusting: 'demands a recalibration of',
};

export function transitTemplate(
  t: BodyKey, n: BodyKey, klass: AspectClass, style: StyleId,
): string {
  const T = PLANET_PROFILE[t], N = PLANET_PROFILE[n];
  const tempo = TEMPO[t] ?? 'a season';
  const outer = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron'].includes(t);
  const passes = outer
    ? ' Outer-planet transits usually strike three times (direct, retrograde, direct): the first pass raises the theme, the second reviews it inwardly, the third resolves it.'
    : '';
  switch (style) {
    case 'jungian':
      return `${cap(T.noun)}, moving through the sky, ${TRANSIT_MODE[klass]} your natal ${BODY_NAME[n]} — ${N.noun}. Transits are the psyche's weather: what this one activates was already in the chart, and the invitation is to meet it consciously rather than meet it as fate.${passes}`;
    case 'mundane':
      return `Transiting ${BODY_NAME[t]} ${TRANSIT_MODE[klass]} the life areas your natal ${BODY_NAME[n]} rules — expect concrete situations involving ${themeWords(n)} over ${tempo}.${passes}`;
    case 'energy':
      return `A moving ${BODY_NAME[t]} wave is passing through your standing ${BODY_NAME[n]} pattern: the ambient current ${TRANSIT_MODE[klass]} it for ${tempo}. Ride the build and release rather than holding the peak.${passes}`;
    case 'minimal':
      return `Transiting ${BODY_NAME[t]} ${klass === 'flowing' ? 'supports' : klass === 'challenge' ? 'pressures' : klass === 'adjusting' ? 'nags at' : 'restarts'} natal ${BODY_NAME[n]} for ${tempo}.${outer ? ' Expect ~3 passes.' : ''}`;
  }
}

/* ---------------- synastry ---------------- */

const SYN_MODE: Record<AspectClass, string> = {
  neutral: 'lands directly on',
  flowing: 'flows easily toward',
  challenge: 'rubs against',
  adjusting: 'never quite aligns with',
};

const bare = (noun: string) => noun.replace(/^the /, '');

export function synastryTemplate(
  a: BodyKey, b: BodyKey, klass: AspectClass, style: StyleId,
): string {
  const A = PLANET_PROFILE[a], B = PLANET_PROFILE[b];
  switch (style) {
    case 'jungian':
      return `One person's ${bare(A.noun)} ${SYN_MODE[klass]} the other's ${bare(B.noun)}. In relationship, each becomes a carrier of the other's ${klass === 'challenge' ? 'shadow material — irritation here is information' : 'projected potential — attraction here is recognition'}; the contact is real, and so is the projection woven through it.`;
    case 'mundane':
      return `In daily life together, one's ${BODY_NAME[a]} ${SYN_MODE[klass]} the other's ${BODY_NAME[b]}: matters of ${themeWords(a)} meet matters of ${themeWords(b)} whenever these two interact${klass === 'challenge' ? ' — a recurring friction point worth naming early' : klass === 'flowing' ? ' — one of the easy channels the relationship runs on' : ''}.`;
    case 'energy':
      return `Between the two systems, the ${BODY_NAME[a]} current of one couples into the ${BODY_NAME[b]} current of the other (${A.drive} meeting ${B.drive}). ${klass === 'challenge' ? 'The coupling is out of phase: it generates heat, which is energy if worked and friction if not.' : klass === 'flowing' ? 'The coupling is in phase: energy passes between you with little loss.' : klass === 'adjusting' ? 'The coupling keeps slipping phase and needs continual small corrections.' : 'The two currents lock onto one frequency — powerful, and worth keeping conscious.'}`;
    case 'minimal':
      return `Their ${BODY_NAME[a]} ${klass === 'flowing' ? 'helps' : klass === 'challenge' ? 'provokes' : klass === 'adjusting' ? 'keeps adjusting to' : 'merges with'} the other's ${BODY_NAME[b]}. ${klass === 'challenge' ? 'Name the friction; it is structural, not personal.' : 'Reliable point of contact.'}`;
  }
}

/* ---------------- composite ---------------- */

const COMP_MODE: Record<AspectClass, string> = {
  neutral: 'are fused',
  flowing: 'cooperate',
  challenge: 'contend',
  adjusting: 'sit at an awkward angle',
};

export function compositeTemplate(
  a: BodyKey, b: BodyKey, klass: AspectClass, style: StyleId,
): string {
  const A = PLANET_PROFILE[a], B = PLANET_PROFILE[b];
  switch (style) {
    case 'jungian':
      return `In the chart of the relationship itself — the third thing the two of you make — ${A.noun} and ${B.noun} ${COMP_MODE[klass]}. This is not either person's pattern: it is what the couple does, and both members will feel it acting on them from inside the bond.`;
    case 'mundane':
      return `As a unit, ${BODY_NAME[a]} matters and ${BODY_NAME[b]} matters ${COMP_MODE[klass]}: expect the partnership's shared life — plans, house, reputation as a pair — to show this signature regardless of who "causes" it.`;
    case 'energy':
      return `The merged field has its own ${BODY_NAME[a]}–${BODY_NAME[b]} coupling: ${klass === 'challenge' ? 'a standing tension the relationship periodically discharges' : klass === 'flowing' ? 'a standing resonance the relationship can always draw on' : klass === 'adjusting' ? 'a chronic small misalignment the relationship keeps correcting' : 'a single fused current at the centre of the bond'}. Transits to this point affect the relationship as a whole.`;
    case 'minimal':
      return `The relationship (as an entity): ${BODY_NAME[a]} ${klass === 'flowing' ? 'supports' : klass === 'challenge' ? 'strains against' : klass === 'adjusting' ? 'keeps adjusting to' : 'merged with'} ${BODY_NAME[b]}. Felt as "how we are together", not as either person.`;
  }
}

function themeWords(b: BodyKey): string {
  return Object.keys(PLANET_PROFILE[b].themes).slice(0, 2).join(' and ');
}

/* ---------------- authored context libraries ---------------- */

type CtxEntry = Partial<Record<AspectClass, StyleTexts>>;

/**
 * Authored transit texts, keyed `${transiting}-${natal}`. Order matters
 * here (unlike natal pairs): transiting Saturn to natal Sun is not natal
 * Sun-Saturn. Conventions per contemporary practice (see
 * docs/research/transits.md).
 */
export const TRANSIT_LIBRARY: Record<string, CtxEntry> = {
  'saturn-sun': {
    challenge: {
      jungian: 'The senex audits the ego: for some weeks per pass, identity claims are tested against what has actually been built. What is structurally sound is confirmed; what is borrowed is repossessed. Meet the judge consciously and this transit confers authority.',
      mundane: 'Responsibility peaks and recognition lags: extra duties, slower progress, authority figures in the way. Finish, consolidate, cut what cannot be carried — launches wait better than they fail.',
      energy: 'Maximum impedance in the vital current: output per effort drops, but everything completed under this compression is load-bearing afterwards. Three passes: pressure, review, resolution.',
      minimal: 'Saturn tests the self-image. Low energy, high demands, real results. Finish things; start later.',
    },
    neutral: {
      jungian: 'A Saturn conjunction to the Sun begins a new thirty-year identity curriculum: the previous self-definition is graded and a sterner, truer one is commissioned.',
      mundane: 'A career and life-structure reset over some months (three passes): roles end, roles consolidate. Decisions made now set the frame for years.',
      energy: 'The identity current is re-channelled at its source — narrow now, deeper for decades.',
      minimal: 'New thirty-year chapter of self-definition. Serious season; choose deliberately.',
    },
    flowing: {
      jungian: 'The senex assists rather than audits: structures accept the ego’s intent, elders open doors. Quietly one of the best times to formalise who you are becoming.',
      mundane: 'Steady, unglamorous progress: contracts, qualifications, positions gained without drama. Bank it.',
      energy: 'The vital current runs through well-fitted channels: modest amplitude, excellent efficiency.',
      minimal: 'Saturn supports the self quietly. Formalise things now.',
    },
  },
  'saturn-moon': {
    challenge: {
      jungian: 'The stern witness visits the feeling nature: for a season moods run low and needs feel inadmissible. This is not depression arriving from nowhere — it is the psyche auditing its emotional contracts. Renegotiate them consciously.',
      mundane: 'Home, family and the body ask for maintenance at once; comfort is scarce and duty plentiful. Simplify the household, tend health early, and let feelings be facts.',
      energy: 'The lunar current runs compressed: intake shrinks while demands rise. Schedule genuine replenishment as infrastructure, not indulgence.',
      minimal: 'Feelings compressed, duties up. Not permanent (~weeks per pass, 3 passes). Maintain the basics.',
    },
  },
  'jupiter-sun': {
    neutral: {
      jungian: 'The principle of meaning returns to the ego — the ~12-yearly Jupiter conjunction: confidence, visibility and opportunity expand together. Inflation is the shadow; genuine growth needs a container.',
      mundane: 'A few lucky-feeling weeks: openings, invitations, generosity received. Say yes selectively — the wave rewards direction more than volume.',
      energy: 'An expansion wave through the identity current: amplitude up, boundaries soft. Aim it.',
      minimal: 'Jupiter over the Sun: expansion, optimism, some overreach. Choose the best opening, decline the rest.',
    },
  },
  'uranus-sun': {
    challenge: {
      jungian: 'The awakener destabilises the self-definition: whatever in the identity is merely habitual gets shaken until it breaks or wakes. Sudden exits and arrivals are the outer form; the inner task is to choose the freedom before it is imposed.',
      mundane: 'Months of upheaval in role and direction across three passes: jobs, image, alliances rearrange abruptly. Make the change you have postponed, or a cruder version arrives unbidden.',
      energy: 'High-frequency interference through the identity current: surges, cutouts, genuine novelty. Ground often; decide fast but implement slowly.',
      minimal: 'Uranus shakes the self-image. Volatile, liberating. Jump before being pushed.',
    },
  },
  'pluto-sun': {
    challenge: {
      jungian: 'The depths contend with the ego over the course of a year or more: power, control and buried material surface for reprocessing. The self-image is not destroyed — its dead parts are. What survives is denser and truer.',
      mundane: 'Power struggles and structural endings in career or standing, in slow motion with three or more exact passes. Do not cling to the shell; negotiate the transformation openly.',
      energy: 'Deep-cycle overhaul of the identity current: long compression, then regeneration from below. The output state carries far more load than the input state.',
      minimal: 'Pluto vs the self-image, in slow motion. Let the dead parts go; keep the core.',
    },
  },
  'chiron-sun': {
    neutral: {
      jungian: 'The wounded teacher crosses the identity: old injuries to being-seen surface with unusual clarity — not to hurt again, but to be tended with adult resources the child never had.',
      mundane: 'Confidence dips and old insecurities revisit; mentoring received or given marks the season. Gentle exposure beats retreat.',
      energy: 'The wound signature and identity current phase-lock for a while: tender, and unusually available for repair.',
      minimal: 'Old wounds to being-seen resurface, repairably. Tend, don’t flee.',
    },
  },
};

/** Landmark passages surfaced by name in the transit view. */
export const LANDMARKS: { t: BodyKey; n: BodyKey; angle: number; name: string; ages: string }[] = [
  { t: 'saturn', n: 'saturn', angle: 0, name: 'Saturn return', ages: '~29 / 58–60 / 87–90' },
  { t: 'saturn', n: 'saturn', angle: 180, name: 'Saturn opposition', ages: '~14–15 / 44–45 / 74' },
  { t: 'saturn', n: 'saturn', angle: 90, name: 'Saturn square', ages: '~7 / 21–22 / 36–37 / 51–52' },
  { t: 'jupiter', n: 'jupiter', angle: 0, name: 'Jupiter return', ages: 'every ~12 years' },
  { t: 'uranus', n: 'uranus', angle: 180, name: 'Uranus opposition (midlife)', ages: '~40–43' },
  { t: 'chiron', n: 'chiron', angle: 0, name: 'Chiron return', ages: '~50' },
  { t: 'neptune', n: 'neptune', angle: 90, name: 'Neptune square', ages: '~41' },
];

export function contextReading(
  a: Pick<Aspect, 'a' | 'b'> & { def: Aspect['def'] },
  style: StyleId,
  context: ReadingContext,
): Reading {
  if (context === 'transit') {
    const entry = TRANSIT_LIBRARY[`${a.a}-${a.b}`]?.[a.def.klass];
    if (entry) return { text: entry[style], source: 'authored' };
    return { text: transitTemplate(a.a, a.b, a.def.klass, style), source: 'template' };
  }
  if (context === 'synastry') {
    return { text: synastryTemplate(a.a, a.b, a.def.klass, style), source: 'template' };
  }
  if (context === 'composite') {
    return { text: compositeTemplate(a.a, a.b, a.def.klass, style), source: 'template' };
  }
  // natal handled by composer.readingFor; kept here for completeness
  throw new Error('use readingFor() for natal context');
}

export { pairKey };
