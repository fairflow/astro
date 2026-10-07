import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CoreProvider } from '../src/ephemeris/core.js';
import { degDiff } from '../src/ephemeris/types.js';
import {
  findStations, geometricLon, inferiorConjunctions, retroArc, retroPeriods,
  synodicDays, type InnerPlanet,
} from '../src/chart/retrograde.js';

interface GoldenStation { kind: 'SR' | 'SD'; jdUt: number; lon: number }
const golden: Record<InnerPlanet, GoldenStation[]> = JSON.parse(
  readFileSync(new URL('./golden/stations.json', import.meta.url), 'utf8'),
);

// Station times are ill-conditioned (speed crosses zero slowly), so a
// 1-arcminute position difference between models moves them by minutes.
// Measured worst case 1990-2040: 10 min, 18″. 0.02 day = 29 min.
const JD_TOL = 0.02;
const LON_TOL = 0.03;

describe('stations vs Swiss Ephemeris (1990-2040)', () => {
  const prov = new CoreProvider();
  for (const body of ['mercury', 'venus'] as InnerPlanet[]) {
    it(`${body}: every station found, time within ${JD_TOL} d, longitude within ${LON_TOL}°`, () => {
      const ref = golden[body];
      const got = findStations(prov, body, ref[0]!.jdUt - 3, ref.at(-1)!.jdUt + 3);
      expect(got.length).toBe(ref.length);
      let worstT = 0, worstL = 0;
      got.forEach((s, i) => {
        expect(s.kind).toBe(ref[i]!.kind);
        worstT = Math.max(worstT, Math.abs(s.jdUt - ref[i]!.jdUt));
        worstL = Math.max(worstL, Math.abs(degDiff(s.lon, ref[i]!.lon)));
      });
      expect(worstT).toBeLessThan(JD_TOL);
      expect(worstL).toBeLessThan(LON_TOL);
    });
  }
});

describe('retrograde periods', () => {
  const prov = new CoreProvider();
  // Venus, autumn 2026: SR 3 Oct, SD 14 Nov (published ephemerides)
  const st = findStations(prov, 'venus', 2461300, 2461400);
  const [p] = retroPeriods(st);

  it('pairs SR with the following SD', () => {
    expect(p).toBeDefined();
    expect(p!.sr.kind).toBe('SR');
    expect(p!.sd.jdUt - p!.sr.jdUt).toBeGreaterThan(38);
    expect(p!.sd.jdUt - p!.sr.jdUt).toBeLessThan(45);
  });

  it('retrograde arc is the backward distance SR → SD', () => {
    expect(retroArc(p!)).toBeGreaterThan(14);
    expect(retroArc(p!)).toBeLessThan(17);
  });

  it('inferior conjunction falls inside the retrograde period', () => {
    const ic = inferiorConjunctions('venus', p!.sr.jdUt, p!.sd.jdUt);
    expect(ic.length).toBe(1);
  });
});

describe('drawing geometry', () => {
  const prov = new CoreProvider();
  it('geometric longitude stays within 1.5′ of the apparent longitude', () => {
    let worst = 0;
    for (let jd = 2451545; jd < 2470000; jd += 97.3) {
      for (const b of ['mercury', 'venus'] as InnerPlanet[]) {
        worst = Math.max(worst, Math.abs(degDiff(geometricLon(b, jd), prov.state(b, jd).lon)));
      }
    }
    expect(worst).toBeLessThan(1.5 / 60);
  });

  it('successive inferior conjunctions are one synodic period apart on average', () => {
    const ic = inferiorConjunctions('mercury', 2460000, 2462000);
    const mean = (ic.at(-1)! - ic[0]!) / (ic.length - 1);
    expect(Math.abs(mean - synodicDays('mercury'))).toBeLessThan(1.5);
  });
});
