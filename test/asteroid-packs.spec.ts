import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ChebPack, ChebProvider } from '../src/ephemeris/chebyshev.js';
import { BodyKey, degDiff } from '../src/ephemeris/types.js';

const packDir = fileURLToPath(new URL('../data/packs/', import.meta.url));
const goldenPath = fileURLToPath(new URL('./golden/asteroids.json', import.meta.url));

const BODIES: BodyKey[] = ['ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris'];
const LON_TOL = 0.01;
const LAT_TOL = 0.01;

const haveData = existsSync(goldenPath)
  && BODIES.every(b => existsSync(`${packDir}${b}.json`));

describe.skipIf(!haveData)('Chebyshev packs vs held-out Horizons samples', () => {
  const prov = new ChebProvider();
  const holdout: Record<string, { jdUt: number; lon: number; lat: number }[]> =
    haveData ? JSON.parse(readFileSync(goldenPath, 'utf8')) : {};
  if (haveData) {
    for (const b of BODIES) {
      prov.add(JSON.parse(readFileSync(`${packDir}${b}.json`, 'utf8')) as ChebPack);
    }
  }

  for (const body of BODIES) {
    it(`${body}: holdout longitudes/latitudes within ${LON_TOL} deg`, () => {
      const samples = holdout[body]!;
      expect(samples.length).toBeGreaterThan(400);
      let worstLon = 0, worstLat = 0, n = 0;
      for (const s of samples) {
        if (!prov.available(body, s.jdUt)) continue; // pack tail may end early
        const got = prov.state(body, s.jdUt);
        worstLon = Math.max(worstLon, Math.abs(degDiff(got.lon, s.lon)));
        worstLat = Math.max(worstLat, Math.abs(got.lat - s.lat));
        n++;
      }
      expect(n).toBeGreaterThan(400);
      expect(worstLon).toBeLessThan(LON_TOL);
      expect(worstLat).toBeLessThan(LAT_TOL);
    });

    it(`${body}: analytic speed matches numerical derivative`, () => {
      const jd = 2451545.0; // J2000, mid-coverage
      const h = 0.01;
      const s = prov.state(body, jd);
      const num = degDiff(
        prov.state(body, jd + h).lon, prov.state(body, jd - h).lon,
      ) / (2 * h);
      expect(Math.abs(s.speed - num)).toBeLessThan(1e-4);
    });
  }

  it('ceres shows retrograde motion somewhere in 2026', () => {
    let retro = false;
    for (let jd = 2461041.5; jd < 2461406.5; jd += 5) {
      if (prov.state('ceres', jd).speed < 0) retro = true;
    }
    expect(retro).toBe(true);
  });
});
