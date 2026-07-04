import { describe, expect, it } from 'vitest';
import { findAspects, ChartPoint } from '../src/chart/aspects.js';

const pt = (body: string, lon: number, speed = 0): ChartPoint =>
  ({ body: body as ChartPoint['body'], state: { lon, lat: 0, speed } });

describe('findAspects', () => {
  it('finds a tight trine and weights it above a loose square', () => {
    const aspects = findAspects([
      pt('sun', 10), pt('moon', 130.5), pt('mars', 106),
    ]);
    const trine = aspects.find(a => a.def.name === 'trine');
    const square = aspects.find(a => a.def.name === 'square');
    expect(trine).toBeDefined();
    expect(square).toBeDefined();
    expect(trine!.orb).toBeCloseTo(0.5, 5);
    expect(square!.orb).toBeCloseTo(6, 5);
    expect(trine!.weight).toBeGreaterThan(square!.weight);
  });

  it('applies luminary orbs', () => {
    // 9 deg conjunction: within 10 (luminary) but outside 8 (base)
    expect(findAspects([pt('sun', 0), pt('moon', 9)]).length).toBe(1);
    expect(findAspects([pt('venus', 0), pt('mars', 9)]).length).toBe(0);
  });

  it('caps orbs for minor bodies', () => {
    // 4 deg conjunction to Chiron: inside base orb 8, outside minor cap 3
    expect(findAspects([pt('venus', 0), pt('chiron', 4)]).length).toBe(0);
    expect(findAspects([pt('venus', 0), pt('chiron', 2)]).length).toBe(1);
  });

  it('handles the 0/360 wrap', () => {
    const a = findAspects([pt('sun', 358), pt('moon', 3)]);
    expect(a.length).toBe(1);
    expect(a[0]!.def.name).toBe('conjunction');
    expect(a[0]!.orb).toBeCloseTo(5, 5);
  });

  it('classifies applying vs separating', () => {
    // Moon at 118 moving faster than Sun at 0: separation 118 -> 120 trine,
    // gap tightening => applying.
    const applying = findAspects([pt('sun', 0, 1), pt('moon', 118, 13)]);
    const tr1 = applying.find(a => a.def.name === 'trine')!;
    expect(tr1.applying).toBe(true);
    // Moon past exactness at 122 and still faster => separating.
    const separating = findAspects([pt('sun', 0, 1), pt('moon', 122, 13)]);
    const tr2 = separating.find(a => a.def.name === 'trine')!;
    expect(tr2.applying).toBe(false);
  });
});
