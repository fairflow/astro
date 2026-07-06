import type { BodyKey } from '../ephemeris/types.js';

/**
 * The authored natal library now lives in data/texts/library.natal.json,
 * fetched at startup (textstore.ts) so texts grow and change without
 * rebuilds. This module keeps only the canonical pair-key helper.
 */

const PLANET_ORDER: BodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'ceres', 'pallas', 'juno',
  'vesta', 'eris', 'meanNode', 'lilith',
];

export function pairKey(a: BodyKey, b: BodyKey): string {
  return PLANET_ORDER.indexOf(a) <= PLANET_ORDER.indexOf(b)
    ? `${a}-${b}` : `${b}-${a}`;
}
