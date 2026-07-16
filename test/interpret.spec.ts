import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  aspectVector, modifiersFor, readingFor, tensionReport, tensionText,
} from '../src/interpret/composer.js';
import {
  chironDossier, lunationPhase, saturnDossier, saturnReturns, sunMoonDossier,
  jdToDateString,
} from '../src/interpret/dossiers.js';
import { STYLES } from '../src/interpret/types.js';
import { getNatalLibrary } from '../src/interpret/textstore.js';
import { findAspects, type ChartPoint } from '../src/chart/aspects.js';
import { computeChart, defaultProvider } from '../src/chart/chart.js';
import { CoreProvider } from '../src/ephemeris/core.js';
import { jdUtFromUtc } from '../src/chart/time.js';
import type { ChebPack } from '../src/ephemeris/chebyshev.js';

const pt = (body: string, lon: number, speed = 0): ChartPoint =>
  ({ body: body as ChartPoint['body'], state: { lon, lat: 0, speed } });

function miniChart(points: ChartPoint[]) {
  return {
    jdUt: 0,
    positions: points.map(p => ({ body: p.body, ...p.state, house: 1 })),
    houses: { system: 'placidus' as const, polarFallback: false, cusps: [], asc: 0, mc: 0 },
    aspects: findAspects(points),
    missing: [],
  };
}

describe('composer', () => {
  it('library covers every style for every entry', () => {
    for (const [key, entry] of Object.entries(getNatalLibrary())) {
      for (const texts of Object.values(entry)) {
        for (const s of STYLES) {
          expect(texts[s.id], `${key} ${s.id}`).toBeTruthy();
        }
      }
    }
  });

  it('flowing and challenge aspects get opposite-signed vectors', () => {
    const chart = miniChart([pt('moon', 0), pt('jupiter', 120), pt('saturn', 90)]);
    const trine = chart.aspects.find(a => a.def.name === 'trine')!;
    const square = chart.aspects.find(a => a.def.name === 'square')!;
    expect(aspectVector(trine)['emotion']).toBeGreaterThan(0);
    expect(aspectVector(square)['emotion']).toBeLessThan(0);
  });

  it('detects the Moon trine Jupiter vs Moon square Saturn contradiction', () => {
    const chart = miniChart([pt('moon', 0), pt('jupiter', 120), pt('saturn', 90)]);
    const tensions = tensionReport(chart);
    expect(tensions.length).toBeGreaterThan(0);
    const t = tensions[0]!;
    expect([t.a.def.name, t.b.def.name].sort()).toEqual(['square', 'trine']);
    for (const s of STYLES) expect(tensionText(t, s.id)).toContain(t.theme);
  });

  it('modifiersFor finds shared-planet aspects and classifies the easing case', () => {
    const chart = miniChart([pt('moon', 0), pt('jupiter', 120), pt('saturn', 90)]);
    const square = chart.aspects.find(a => a.def.name === 'square')!;
    const mods = modifiersFor(chart, square);
    expect(mods).toHaveLength(1);
    expect(mods[0]!.shared).toBe('moon');
    expect(mods[0]!.relation).toBe('eases');
  });

  it('readingFor uses authored text for library pairs, template otherwise', () => {
    const chart = miniChart([pt('moon', 0), pt('saturn', 90), pt('mercury', 60)]);
    const moonSaturn = chart.aspects.find(a =>
      (a.a === 'moon' && a.b === 'saturn') || (a.a === 'saturn' && a.b === 'moon'))!;
    expect(readingFor(moonSaturn, 'jungian').source).toBe('authored');
    const mercSaturn = chart.aspects.find(a => a.a === 'mercury' || a.b === 'mercury')!;
    expect(readingFor(mercSaturn, 'jungian').source).toBe('template');
    expect(readingFor(mercSaturn, 'minimal').text.length).toBeGreaterThan(10);
  });
});

describe('dossiers', () => {
  it('lunation phase octants are correct', () => {
    expect(lunationPhase(0, 10).name).toBe('New Moon');
    expect(lunationPhase(0, 50).name).toBe('Crescent');
    expect(lunationPhase(0, 95).name).toBe('First Quarter');
    expect(lunationPhase(0, 180).name).toBe('Full Moon');
    expect(lunationPhase(0, 350).name).toBe('Balsamic');
    expect(lunationPhase(300, 310).name).toBe('New Moon'); // wraps
  });

  it('waxing before Full (0–180°), waning after', () => {
    expect(lunationPhase(0, 90).waxing).toBe(true);   // First Quarter, waxing
    expect(lunationPhase(0, 179).waxing).toBe(true);  // Gibbous, waxing
    expect(lunationPhase(0, 181).waxing).toBe(false); // Full Moon phase, waning
    expect(lunationPhase(0, 300).waxing).toBe(false); // Last Quarter, waning
  });

  it('saturn returns land ~29.5 years apart', () => {
    const provider = new CoreProvider();
    const jdBirth = jdUtFromUtc(1975, 3, 8, 14, 30);
    const natal = provider.state('saturn', jdBirth).lon;
    const returns = saturnReturns(provider, natal, jdBirth);
    expect(returns.length).toBe(3);
    const age1 = (returns[0]! - jdBirth) / 365.25;
    const gap = (returns[1]! - returns[0]!) / 365.25;
    expect(age1).toBeGreaterThan(28);
    expect(age1).toBeLessThan(31);
    expect(gap).toBeGreaterThan(28);
    expect(gap).toBeLessThan(31);
    expect(jdToDateString(returns[0]!)).toMatch(/^200[3-4]/);
  });

  it('all three dossiers render sections in every style (real chart)', () => {
    const packDir = fileURLToPath(new URL('../data/packs/', import.meta.url));
    const packBodies = ['ceres', 'pallas', 'juno', 'vesta', 'chiron', 'eris'];
    if (!packBodies.every(b => existsSync(`${packDir}${b}.json`))) return;
    const packs: ChebPack[] = packBodies.map(b =>
      JSON.parse(readFileSync(`${packDir}${b}.json`, 'utf8')));
    const provider = defaultProvider(packs);
    const jd = jdUtFromUtc(1975, 3, 8, 14, 30);
    const chart = computeChart(provider, { jdUt: jd, lat: 51.5, lon: -0.13 });
    for (const s of STYLES) {
      const c = chironDossier(chart, s.id);
      const sa = saturnDossier(chart, s.id, provider, jd);
      const sm = sunMoonDossier(chart, s.id);
      expect(c.sections.length).toBeGreaterThan(2);
      expect(sa.sections.length).toBeGreaterThan(3);
      expect(sm.sections.length).toBeGreaterThanOrEqual(3);
      expect(sa.sections.some(x => x.heading === 'Saturn returns')).toBe(true);
      for (const d of [c, sa, sm]) {
        for (const sec of d.sections) expect(sec.text.length).toBeGreaterThan(5);
      }
    }
  });
});
