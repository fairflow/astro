import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pairText } from '../src/interpret/templates.js';
import { markersFor } from '../src/interpret/markers.js';
import { chartSnapshot, synastrySnapshot } from '../src/interpret/snapshot.js';
import {
  crossAspects, houseOverlay, midpointContacts,
} from '../src/chart/relate.js';
import { STYLES } from '../src/interpret/types.js';
import { findAspects, type ChartPoint } from '../src/chart/aspects.js';
import { computeChart, defaultProvider } from '../src/chart/chart.js';
import { jdUtFromUtc } from '../src/chart/time.js';
import type { ChebPack } from '../src/ephemeris/chebyshev.js';

const pt = (body: string, lon: number): ChartPoint =>
  ({ body: body as ChartPoint['body'], state: { lon, lat: 0, speed: 0 } });

describe('user-test part 2 fixes', () => {
  it('hard-aspect templates include a how-to-work-it line in every style', () => {
    for (const s of STYLES) {
      const challenge = pairText('venus', 'saturn', 'challenge', s.id);
      const flowing = pairText('venus', 'saturn', 'flowing', s.id);
      // the practice line makes hard aspects strictly longer than soft ones
      expect(challenge.length, s.id).toBeGreaterThan(flowing.length);
    }
    expect(pairText('venus', 'saturn', 'challenge', 'jungian')).toMatch(/conscious/i);
    expect(pairText('venus', 'saturn', 'challenge', 'minimal')).toMatch(/work it|lanes/i);
  });

  it('different pairs open with different lead sentences (anti-repetition)', () => {
    const texts = [
      pairText('sun', 'pluto', 'challenge', 'jungian'),
      pairText('venus', 'uranus', 'challenge', 'jungian'),
      pairText('mercury', 'lilith', 'challenge', 'jungian'),
    ].map(t => t.split(/(?<=[.!?])\s/)[0]);
    expect(new Set(texts).size).toBeGreaterThan(1);
  });

  it('markersFor gives keywords and an open question for every class', () => {
    const chart = findAspects([
      pt('sun', 0), pt('moon', 120.5), pt('saturn', 91), pt('venus', 150.8), pt('mercury', 1.2),
    ]);
    expect(chart.length).toBeGreaterThan(2);
    for (const a of chart) {
      const m = markersFor(a);
      expect(m.keywords.length).toBeGreaterThanOrEqual(3);
      expect(m.question.endsWith('?')).toBe(true);
    }
  });

  it('chartSnapshot produces pasteable markdown from a real chart', () => {
    const packDir = fileURLToPath(new URL('../data/packs/', import.meta.url));
    const packBodies = ['ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris'];
    if (!packBodies.every(b => existsSync(`${packDir}${b}.json`))) return;
    const packs: ChebPack[] = packBodies.map(b =>
      JSON.parse(readFileSync(`${packDir}${b}.json`, 'utf8')));
    const chart = computeChart(defaultProvider(packs), {
      jdUt: jdUtFromUtc(1975, 3, 8, 14, 30), lat: 51.5, lon: -0.13,
    });
    const md = chartSnapshot(chart, {
      name: 'Test', date: '1975-03-08', time: '14:30', accuracy: 'exact',
      place: { name: 'London', country: 'GB', lat: 51.5, lon: -0.13, zone: 'Europe/London' },
      offsetMinutes: 0,
    });
    expect(md).toContain('# Natal chart — Test');
    expect(md).toContain('## Positions');
    expect(md).toContain('## Aspects');
    expect(md).toContain('Ascendant:');
    expect(md.match(/^- /gm)!.length).toBeGreaterThan(20);
    expect(md).not.toContain('︎');
    expect(md).toContain('Interpretations deliberately omitted');
  });

  it('synastrySnapshot covers both charts, inter-aspects and midpoints', () => {
    const packDir = fileURLToPath(new URL('../data/packs/', import.meta.url));
    const packBodies = ['ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris'];
    if (!packBodies.every(b => existsSync(`${packDir}${b}.json`))) return;
    const packs: ChebPack[] = packBodies.map(b =>
      JSON.parse(readFileSync(`${packDir}${b}.json`, 'utf8')));
    const provider = defaultProvider(packs);
    const a = computeChart(provider, {
      jdUt: jdUtFromUtc(1961, 12, 3, 14, 15), lat: 50.85, lon: 4.35,
    });
    const b = computeChart(provider, {
      jdUt: jdUtFromUtc(1955, 4, 2, 9, 20), lat: 51.07, lon: -1.79,
    });
    const toPts = (c: typeof a) => c.positions.map(p => ({ body: p.body, state: p }));
    const cross = crossAspects(toPts(a), toPts(b));
    const md = synastrySnapshot(
      a,
      { name: 'A', date: '1961-12-03', time: '15:15', accuracy: 'exact',
        place: { name: 'Brussels', country: 'BE', lat: 50.85, lon: 4.35, zone: 'Europe/Brussels' },
        offsetMinutes: 60 },
      b, 'B', cross,
      houseOverlay(b.positions, a.houses.cusps),
      midpointContacts(a, b), midpointContacts(b, a),
    );
    expect(md).toContain('# Synastry — A × B');
    expect(md).toContain('## Inter-aspects');
    expect(md).toContain("A's Sun trine B's Sun");
    expect(md).toContain('Midpoint contacts');
    expect(md).not.toContain('︎');
  });
});
