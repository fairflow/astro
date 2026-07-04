import type { ChebPack } from './chebyshev.js';

export const PACK_BODIES = [
  'ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris',
] as const;

/**
 * Fetch the bundled asteroid packs (served from the app's static data).
 * Missing/broken packs are skipped: the chart degrades to `missing`
 * bodies rather than failing.
 */
export async function fetchPacks(base = '/packs/'): Promise<ChebPack[]> {
  const results = await Promise.allSettled(
    PACK_BODIES.map(async body => {
      const res = await fetch(`${base}${body}.json`);
      if (!res.ok) throw new Error(`${body}: HTTP ${res.status}`);
      return await res.json() as ChebPack;
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<ChebPack> => r.status === 'fulfilled')
    .map(r => r.value);
}
