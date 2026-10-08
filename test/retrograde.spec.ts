import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CoreProvider } from '../src/ephemeris/core.js';
import { degDiff } from '../src/ephemeris/types.js';
import {
  findStations, geometricLon, inferiorConjunctions, oppositions, PLANETS_IN_ORDER, retroArc,
  retroPeriods, solarConjunctions, superiorConjunctions, synodicDays, type InnerPlanet, type Planet,
} from '../src/chart/retrograde.js';

interface GoldenStation { kind: 'SR' | 'SD'; jdUt: number; lon: number }
const golden: Record<Planet, GoldenStation[]> = JSON.parse(
  readFileSync(new URL('./golden/stations.json', import.meta.url), 'utf8'),
);

// Station times are ill-conditioned (speed crosses zero slowly), so a
// 1-arcminute position difference between models moves them by minutes,
// more for the slow outer planets. Tolerances sit above the worst case
// measured 1990-2040 (minutes): Mercury 10, Venus 7, Mars 8, Jupiter 9,
// Saturn 17, Uranus 30, Neptune 41, Pluto 44. Longitudes agree to 18″.
const JD_TOL: Record<Planet, number> = {
  mercury: 0.02, venus: 0.02, mars: 0.02, jupiter: 0.02,
  saturn: 0.02, uranus: 0.03, neptune: 0.04, pluto: 0.05,
};
const LON_TOL = 0.03;

describe('stations vs Swiss Ephemeris (1990-2040)', () => {
  const prov = new CoreProvider();
  for (const body of PLANETS_IN_ORDER) {
    it(`${body}: every station found, time within ${JD_TOL[body]} d, longitude within ${LON_TOL}°`, () => {
      const ref = golden[body];
      const got = findStations(prov, body, ref[0]!.jdUt - 3, ref.at(-1)!.jdUt + 3);
      expect(got.length).toBe(ref.length);
      let worstT = 0, worstL = 0;
      got.forEach((s, i) => {
        expect(s.kind).toBe(ref[i]!.kind);
        worstT = Math.max(worstT, Math.abs(s.jdUt - ref[i]!.jdUt));
        worstL = Math.max(worstL, Math.abs(degDiff(s.lon, ref[i]!.lon)));
      });
      expect(worstT).toBeLessThan(JD_TOL[body]);
      expect(worstL).toBeLessThan(LON_TOL);
    });
  }

  it('a fast geometric scan finds the same stations as the full provider scan', () => {
    for (const body of ['mercury', 'jupiter', 'pluto'] as Planet[]) {
      const a = findStations(prov, body, 2460000, 2462000);
      const rate = (jd: number) => degDiff(geometricLon(body, jd + 0.05), geometricLon(body, jd - 0.05)) / 0.1;
      const b = findStations(prov, body, 2460000, 2462000, 2, rate);
      expect(b.length).toBe(a.length);
      b.forEach((s, i) => expect(Math.abs(s.jdUt - a[i]!.jdUt)).toBeLessThan(1e-4));
    }
  });
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

  it('superior conjunctions alternate with inferior ones, with Venus beside the Sun', () => {
    const inf = inferiorConjunctions('venus', 2460000, 2463000);
    const sup = superiorConjunctions('venus', 2460000, 2463000);
    expect(Math.abs(sup.length - inf.length)).toBeLessThanOrEqual(1);
    for (const j of sup) {
      const before = inf.filter(x => x < j).at(-1), after = inf.find(x => x > j);
      if (before !== undefined && after !== undefined) {
        // roughly midway through the synodic cycle (orbits are slightly eccentric)
        expect(Math.abs((j - before) / (after - before) - 0.5)).toBeLessThan(0.05);
      }
      // seen from Earth, Venus stands with the Sun (within the ~0.1° light-time/aberration slop)
      expect(Math.abs(degDiff(prov.state('venus', j).lon, prov.state('sun', j).lon))).toBeLessThan(0.1);
    }
  });

  it('outer planets: opposition puts the planet opposite the Sun, mid-retrograde', () => {
    for (const b of ['mars', 'jupiter', 'saturn', 'neptune'] as const) {
      const ops = oppositions(b, 2460000, 2462000), cjs = solarConjunctions(b, 2460000, 2462000);
      expect(ops.length).toBeGreaterThan(0);
      expect(cjs.length).toBeGreaterThan(0);
      const st = findStations(prov, b, 2459800, 2462200);
      for (const j of ops) {
        expect(Math.abs(degDiff(prov.state(b, j).lon, prov.state('sun', j).lon + 180))).toBeLessThan(0.1);
        expect(prov.state(b, j).speed).toBeLessThan(0); // retrograde at opposition
        const p = retroPeriods(st).find(r => r.sr.jdUt < j && r.sd.jdUt > j);
        expect(p).toBeDefined();
      }
      for (const j of cjs) expect(Math.abs(degDiff(prov.state(b, j).lon, prov.state('sun', j).lon))).toBeLessThan(0.1);
    }
  });
});
