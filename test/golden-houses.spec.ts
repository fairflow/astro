import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { houses } from '../src/chart/houses.js';
import { ramc } from '../src/chart/time.js';
import { degDiff } from '../src/ephemeris/types.js';

interface Case {
  place: string; lat: number; lon: number; jdUt: number;
  cusps: number[]; asc: number; mc: number; armc: number;
}
const cases: Case[] = JSON.parse(
  readFileSync(new URL('./golden/houses.json', import.meta.url), 'utf8'),
);

const TOL = 0.03; // degrees

describe('Placidus houses vs Swiss Ephemeris golden values', () => {
  for (const c of cases) {
    describe(`${c.place} @ jd ${c.jdUt.toFixed(2)}`, () => {
      it('RAMC matches', () => {
        expect(Math.abs(degDiff(ramc(c.jdUt, c.lon), c.armc))).toBeLessThan(TOL);
      });
      it('ASC / MC match', () => {
        const h = houses(c.jdUt, c.lat, c.lon, 'placidus');
        expect(Math.abs(degDiff(h.asc, c.asc))).toBeLessThan(TOL);
        expect(Math.abs(degDiff(h.mc, c.mc))).toBeLessThan(TOL);
      });
      it('all 12 cusps match, no polar fallback', () => {
        const h = houses(c.jdUt, c.lat, c.lon, 'placidus');
        expect(h.polarFallback).toBe(false);
        for (let i = 0; i < 12; i++) {
          expect(
            Math.abs(degDiff(h.cusps[i]!, c.cusps[i]!)),
            `cusp ${i + 1}`,
          ).toBeLessThan(TOL);
        }
      });
    });
  }

  it('falls back to Porphyry above the polar circle', () => {
    const h = houses(2460500.5, 78.2, 15.6, 'placidus'); // Longyearbyen
    expect(h.polarFallback).toBe(true);
    expect(h.system).toBe('porphyry');
    expect(h.cusps).toHaveLength(12);
  });
});
