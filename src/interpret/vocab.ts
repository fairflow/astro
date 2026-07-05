import type { BodyKey } from '../ephemeris/types.js';
import type { ThemeVector } from './types.js';

/**
 * Controlled theme vocabulary. Keep it small: the composer's behaviour
 * is only as predictable as this list is legible.
 */
export const THEMES = [
  'identity', 'emotion', 'security', 'structure', 'discipline', 'freedom',
  'expansion', 'connection', 'desire', 'communication', 'imagination',
  'depth', 'wounding', 'healing', 'nurture', 'autonomy', 'belonging',
  'meaning', 'transformation',
] as const;

export interface PlanetProfile {
  /** Archetypal noun phrase, e.g. "the conscious identity". */
  noun: string;
  /** What it does, as a gerund phrase, e.g. "asserting and pursuing". */
  drive: string;
  themes: ThemeVector;
}

export const PLANET_PROFILE: Record<BodyKey, PlanetProfile> = {
  sun: { noun: 'the conscious identity', drive: 'becoming and shining', themes: { identity: 0.9, meaning: 0.5, autonomy: 0.4 } },
  moon: { noun: 'the feeling nature', drive: 'needing and nourishing', themes: { emotion: 0.9, security: 0.7, nurture: 0.5, belonging: 0.4 } },
  mercury: { noun: 'the mind', drive: 'naming and exchanging', themes: { communication: 0.9, connection: 0.3 } },
  venus: { noun: 'the valuing heart', drive: 'attracting and appreciating', themes: { connection: 0.8, desire: 0.5, belonging: 0.4 } },
  mars: { noun: 'the will', drive: 'asserting and pursuing', themes: { desire: 0.7, autonomy: 0.7, identity: 0.3 } },
  jupiter: { noun: 'the principle of growth', drive: 'expanding and trusting', themes: { expansion: 0.9, meaning: 0.7, freedom: 0.5 } },
  saturn: { noun: 'the structuring principle', drive: 'limiting and maturing', themes: { structure: 0.9, discipline: 0.8, security: 0.4 } },
  uranus: { noun: 'the awakener', drive: 'breaking open and freeing', themes: { freedom: 0.9, autonomy: 0.6, transformation: 0.4 } },
  neptune: { noun: 'the dissolving imagination', drive: 'dissolving and idealising', themes: { imagination: 0.9, belonging: 0.4, meaning: 0.4 } },
  pluto: { noun: 'the depths', drive: 'compelling and transforming', themes: { depth: 0.9, transformation: 0.8, desire: 0.3 } },
  chiron: { noun: 'the wounded teacher', drive: 'aching and mentoring', themes: { wounding: 0.9, healing: 0.7 } },
  ceres: { noun: 'the nurturer', drive: 'feeding and letting go', themes: { nurture: 0.9, security: 0.3, emotion: 0.3 } },
  pallas: { noun: 'the strategist', drive: 'seeing patterns and devising', themes: { communication: 0.4, structure: 0.4, imagination: 0.4 } },
  juno: { noun: 'the partner', drive: 'committing and negotiating', themes: { connection: 0.8, belonging: 0.6 } },
  vesta: { noun: 'the devotee', drive: 'focusing and consecrating', themes: { discipline: 0.5, meaning: 0.5, autonomy: 0.4 } },
  eris: { noun: 'the excluded voice', drive: 'disrupting and insisting', themes: { autonomy: 0.6, transformation: 0.5, wounding: 0.4 } },
  meanNode: { noun: 'the direction of growth', drive: 'drawing forward', themes: { meaning: 0.8, transformation: 0.3 } },
  lilith: { noun: 'the untamed instinct', drive: 'refusing and reclaiming', themes: { autonomy: 0.7, desire: 0.5, wounding: 0.3 } },
};

/** Sign keywords: tone the wound/lesson/dialogue lines. */
export const SIGN_TONE = [
  'direct, pioneering, quick to ignite',        // Aries
  'steady, embodied, attached to the tangible', // Taurus
  'curious, versatile, spoken aloud',           // Gemini
  'protective, tidal, family-rooted',           // Cancer
  'expressive, proud, heart-led',               // Leo
  'precise, useful, self-critical',             // Virgo
  'relational, balancing, fairness-seeking',    // Libra
  'intense, guarded, all-or-nothing',           // Scorpio
  'far-ranging, candid, meaning-hungry',        // Sagittarius
  'ambitious, enduring, responsibility-bound',  // Capricorn
  'independent, systemic, future-facing',       // Aquarius
  'porous, compassionate, boundary-blurring',   // Pisces
];

/** House arenas: where a factor plays out in life. */
export const HOUSE_ARENA = [
  'the body, the self-image, and how life is met',            // 1
  'money, possessions, and the sense of personal worth',      // 2
  'speech, siblings, learning, and the daily neighbourhood',  // 3
  'home, family origins, and inner foundations',              // 4
  'creativity, play, romance, and children',                  // 5
  'work, routine, service, and health',                       // 6
  'partnership, marriage, and declared opponents',            // 7
  'shared resources, intimacy, and crisis',                   // 8
  'travel, belief, higher learning, and publishing',          // 9
  'career, public standing, and authority',                   // 10
  'friendship, groups, and hopes for the future',             // 11
  'retreat, the unconscious, and what is given up',           // 12
];
