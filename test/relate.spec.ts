import { describe, expect, it } from 'vitest';
import {
  circularMidpoint, compositeChart, crossAspects, houseOverlay,
  midpointContacts, sunMoonMidpointHits, transitAspects,
} from '../src/chart/relate.js';
import { contextReading } from '../src/interpret/contexts.js';
import { readingFor } from '../src/interpret/composer.js';
import {
  careerDossier, relationshipsDossier,
} from '../src/interpret/dossiers-life.js';
import { STYLES } from '../src/interpret/types.js';
import { findAspects, type ChartPoint } from '../src/chart/aspects.js';
import type { Chart } from '../src/chart/chart.js';

const pt = (body: string, lon: number, speed = 0): ChartPoint =>
  ({ body: body as ChartPoint['body'], state: { lon, lat: 0, speed } });

function miniChart(points: ChartPoint[], asc = 0): Chart {
  const cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
  return {
    jdUt: 2451545,
    positions: points.map(p => ({ body: p.body, ...p.state, house: 1 })),
    houses: { system: 'placidus', polarFallback: false, cusps, asc, mc: (asc + 270) % 360 },
    aspects: findAspects(points),
    missing: [],
  };
}

describe('circularMidpoint', () => {
  it('takes the shorter arc across 0°', () => {
    expect(circularMidpoint(350, 10)).toBeCloseTo(0, 10);
    expect(circularMidpoint(10, 350)).toBeCloseTo(0, 10);
    expect(circularMidpoint(90, 180)).toBeCloseTo(135, 10);
  });
});

describe('crossAspects', () => {
  it('applies the synastry orb factor', () => {
    // 6° from exact square: inside luminary orb 8*0.75=6, outside base 7*0.75=5.25
    const lum = crossAspects([pt('sun', 0)], [pt('moon', 96)]);
    expect(lum.some(a => a.def.name === 'square')).toBe(true);
    const nonLum = crossAspects([pt('venus', 0)], [pt('mars', 96)]);
    expect(nonLum.some(a => a.def.name === 'square')).toBe(false);
  });
});

describe('transitAspects', () => {
  it('uses tight orbs and trims the transiting Moon', () => {
    expect(transitAspects([pt('saturn', 0)], [pt('sun', 3.5)]).length).toBe(1); // 4° lum orb
    expect(transitAspects([pt('saturn', 0)], [pt('venus', 3.5)]).length).toBe(0); // 3° base
    expect(transitAspects([pt('moon', 0)], [pt('venus', 2)]).length).toBe(0); // moon ≤1°
    expect(transitAspects([pt('moon', 0)], [pt('venus', 0.5)]).length).toBe(1);
  });
});

describe('compositeChart', () => {
  const a = miniChart([pt('sun', 10), pt('moon', 100)], 0);
  const b = miniChart([pt('sun', 30), pt('moon', 160)], 60);
  const comp = compositeChart(a, b);

  it('midpoints the like planets and the cusps', () => {
    expect(comp.positions.find(p => p.body === 'sun')!.lon).toBeCloseTo(20, 8);
    expect(comp.positions.find(p => p.body === 'moon')!.lon).toBeCloseTo(130, 8);
    expect(comp.houses.asc).toBeCloseTo(30, 8);
    expect(comp.houses.cusps[1]).toBeCloseTo(60, 8);
  });

  it('finds aspects within the composite', () => {
    // composite sun 20, moon 130: 110° apart -> trine at 10° orb? No: outside.
    // give it a real aspect instead:
    const c2 = compositeChart(
      miniChart([pt('sun', 0), pt('venus', 118)]),
      miniChart([pt('sun', 20), pt('venus', 126)]),
    );
    // sun 10, venus 122 -> trine orb 8 within luminary orb 9
    expect(c2.aspects.some(x => x.def.name === 'trine')).toBe(true);
  });
});

describe('houseOverlay and midpointContacts', () => {
  it('places B bodies in A houses', () => {
    const a = miniChart([pt('sun', 10)], 0);
    const o = houseOverlay(
      [{ body: 'venus', lon: 95, lat: 0, speed: 0, house: 1 }], a.houses.cusps);
    expect(o[0]!.house).toBe(4); // 95° with equal cusps from 0 -> 4th house
  });

  it('finds Venus on the Sun/Moon midpoint (classic indicator), incl. 90° dial', () => {
    const a = miniChart([pt('sun', 0), pt('moon', 60)]); // Sun/Moon mid = 30
    const direct = midpointContacts(a, miniChart([pt('venus', 30.5)]));
    expect(direct.some(m => m.body === 'venus'
      && m.pair.includes('sun') && m.pair.includes('moon'))).toBe(true);
    const dial = midpointContacts(a, miniChart([pt('venus', 120.8)]));
    expect(dial.some(m => m.body === 'venus')).toBe(true);
    const miss = midpointContacts(a, miniChart([pt('venus', 33)]));
    expect(miss.some(m => m.body === 'venus' && m.pair.includes('sun')
      && m.pair.includes('moon'))).toBe(false);
  });
});

describe('sunMoonMidpointHits', () => {
  it('finds a transiting body on the S/M midpoint incl. the 90° dial', () => {
    const chart = miniChart([pt('sun', 0), pt('moon', 60)]); // mid = 30
    const direct = sunMoonMidpointHits([pt('saturn', 30.8)], chart);
    expect(direct).toHaveLength(1);
    expect(direct[0]!.orb).toBeCloseTo(0.8, 6);
    const dial = sunMoonMidpointHits([pt('pluto', 120.5)], chart);
    expect(dial).toHaveLength(1);
    const miss = sunMoonMidpointHits([pt('saturn', 33)], chart);
    expect(miss).toHaveLength(0);
    // transiting Moon and minor bodies are excluded
    expect(sunMoonMidpointHits([pt('moon', 30)], chart)).toHaveLength(0);
    expect(sunMoonMidpointHits([pt('vesta', 30)], chart)).toHaveLength(0);
  });
});

describe('context readings are not locked together', () => {
  const chart = miniChart([pt('sun', 0), pt('saturn', 90)]);
  const aspect = chart.aspects.find(a => a.def.name === 'square')!;

  it('natal, transit, synastry and composite texts all differ', () => {
    for (const s of STYLES) {
      const natal = readingFor(aspect, s.id).text;
      const transit = contextReading({ a: 'saturn', b: 'sun', def: aspect.def }, s.id, 'transit').text;
      const synastry = contextReading(aspect, s.id, 'synastry').text;
      const composite = contextReading(aspect, s.id, 'composite').text;
      const all = [natal, transit, synastry, composite];
      expect(new Set(all).size, `style ${s.id}`).toBe(4);
      for (const t of all) expect(t.length).toBeGreaterThan(20);
    }
  });

  it('authored transit text is used for transiting Saturn to natal Sun', () => {
    const r = contextReading(
      { a: 'saturn', b: 'sun', def: aspect.def }, 'jungian', 'transit');
    expect(r.source).toBe('authored');
    const template = contextReading(
      { a: 'venus', b: 'mars', def: aspect.def }, 'jungian', 'transit');
    expect(template.source).toBe('template');
  });
});

describe('life dossiers (7d/7e)', () => {
  const chart = miniChart([
    pt('sun', 5), pt('moon', 95), pt('venus', 40), pt('mars', 130),
    pt('saturn', 185), pt('juno', 220), pt('meanNode', 275),
  ]);

  it('career and relationships render in all styles', () => {
    for (const s of STYLES) {
      const c = careerDossier(chart, s.id);
      const r = relationshipsDossier(chart, s.id);
      expect(c.sections.length).toBeGreaterThan(2);
      expect(r.sections.length).toBeGreaterThan(4);
      for (const sec of [...c.sections, ...r.sections]) {
        expect(sec.text.length).toBeGreaterThan(5);
      }
    }
  });

  it('relationships dossier extends with synastry input', () => {
    const other = miniChart([pt('sun', 96), pt('venus', 6)]);
    const cross = crossAspects(
      chart.positions.map(p => ({ body: p.body, state: p })),
      other.positions.map(p => ({ body: p.body, state: p })),
    );
    const d = relationshipsDossier(chart, 'minimal', {
      otherName: 'Partner',
      cross,
      overlays: houseOverlay(other.positions, chart.houses.cusps),
      midpoints: midpointContacts(chart, other),
    });
    expect(d.sections.some(s => s.heading.includes('Synastry with Partner'))).toBe(true);
    expect(d.factors).toContain('Partner');
  });
});
