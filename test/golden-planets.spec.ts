import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CoreProvider } from '../src/ephemeris/core.js';
import { BodyKey, degDiff } from '../src/ephemeris/types.js';

interface Golden {
  jdUt: number;
  bodies: Record<string, { lon: number; lat: number; speed: number }>;
}
const golden: Golden[] = JSON.parse(
  readFileSync(new URL('./golden/planets.json', import.meta.url), 'utf8'),
);

// astronomy-engine is quoted at ±1 arcminute vs NOVAS; Swiss Ephemeris
// (Moshier) is our independent reference. 0.03 deg ≈ 1.8 arcmin headroom.
const LON_TOL = 0.03;
const LAT_TOL = 0.03;
// Analytic mean node / mean apogee: series differ slightly between sources.
const POINT_TOL = 0.05;

describe('CoreProvider vs Swiss Ephemeris golden values (1900-2100)', () => {
  const prov = new CoreProvider();

  it('covers all sampled instants', () => {
    for (const s of golden) {
      expect(prov.available('sun', s.jdUt)).toBe(true);
    }
  });

  for (const body of Object.keys(golden[0]!.bodies) as BodyKey[]) {
    const isPoint = body === 'meanNode' || body === 'lilith';
    it(`${body}: longitude within ${isPoint ? POINT_TOL : LON_TOL} deg`, () => {
      let worst = 0;
      for (const s of golden) {
        const got = prov.state(body, s.jdUt);
        const ref = s.bodies[body]!;
        worst = Math.max(worst, Math.abs(degDiff(got.lon, ref.lon)));
      }
      expect(worst).toBeLessThan(isPoint ? POINT_TOL : LON_TOL);
    });

    if (!isPoint) {
      it(`${body}: latitude within ${LAT_TOL} deg`, () => {
        for (const s of golden) {
          const got = prov.state(body, s.jdUt);
          expect(Math.abs(got.lat - s.bodies[body]!.lat)).toBeLessThan(LAT_TOL);
        }
      });
    }

    it(`${body}: speed sign and magnitude agree`, () => {
      for (const s of golden) {
        const got = prov.state(body, s.jdUt);
        const ref = s.bodies[body]!;
        // 2% relative + small absolute floor (near stations both are ~0).
        expect(Math.abs(got.speed - ref.speed))
          .toBeLessThan(0.02 * Math.abs(ref.speed) + 0.005);
      }
    });
  }
});
