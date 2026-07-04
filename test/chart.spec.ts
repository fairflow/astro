import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ChebPack } from '../src/ephemeris/chebyshev.js';
import { DEFAULT_BODIES, computeChart, defaultProvider } from '../src/chart/chart.js';
import { jdUtFromUtc } from '../src/chart/time.js';

const packDir = fileURLToPath(new URL('../data/packs/', import.meta.url));
const PACK_BODIES = ['ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris'];
const havePacks = PACK_BODIES.every(b => existsSync(`${packDir}${b}.json`));

describe.skipIf(!havePacks)('computeChart end to end', () => {
  const packs: ChebPack[] = havePacks
    ? PACK_BODIES.map(b => JSON.parse(readFileSync(`${packDir}${b}.json`, 'utf8')))
    : [];
  const provider = defaultProvider(packs);

  it('computes a complete natal chart for London, 1990-07-15 12:34 UT', () => {
    const jd = jdUtFromUtc(1990, 7, 15, 12, 34);
    const chart = computeChart(provider, { jdUt: jd, lat: 51.5074, lon: -0.1278 });

    expect(chart.missing).toEqual([]);
    expect(chart.positions).toHaveLength(DEFAULT_BODIES.length); // 18 bodies
    expect(chart.houses.system).toBe('placidus');
    expect(chart.houses.polarFallback).toBe(false);
    for (const p of chart.positions) {
      expect(p.lon).toBeGreaterThanOrEqual(0);
      expect(p.lon).toBeLessThan(360);
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
    }
    expect(chart.aspects.length).toBeGreaterThan(3);
    // Aspects come out sorted by salience.
    for (let i = 1; i < chart.aspects.length; i++) {
      expect(chart.aspects[i]!.weight).toBeLessThanOrEqual(chart.aspects[i - 1]!.weight);
    }
  });

  it('puts the Sun at ~10 Capricorn at the J2000 epoch', () => {
    const chart = computeChart(provider, {
      jdUt: jdUtFromUtc(2000, 1, 1, 12), lat: 0, lon: 0, bodies: ['sun'],
    });
    expect(chart.positions[0]!.lon).toBeGreaterThan(279.5);
    expect(chart.positions[0]!.lon).toBeLessThan(280.5);
  });

  it('reports uncovered bodies as missing outside pack range', () => {
    const jd = jdUtFromUtc(1750, 1, 1); // before pack coverage, inside core's
    const chart = computeChart(provider, { jdUt: jd, lat: 0, lon: 0 });
    expect(chart.missing).toContain('chiron');
    expect(chart.missing).not.toContain('sun');
  });
});
