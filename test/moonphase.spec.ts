// The Moon's phase (astro-ht7).
import { describe, expect, it } from 'vitest';
import { litPath, moonPhaseAt, nextQuarters, phaseName, SYNODIC_MONTH } from '../src/chart/moonphase.js';
import { jdUtFromDate } from '../src/chart/time.js';

describe('phaseName', () => {
  it('names the quarters near them and the crescents and gibbous phases between', () => {
    expect(phaseName(2)).toBe('New Moon');
    expect(phaseName(358)).toBe('New Moon');
    expect(phaseName(30)).toBe('Waxing crescent');
    expect(phaseName(92)).toBe('First quarter');
    expect(phaseName(150)).toBe('Waxing gibbous');
    expect(phaseName(184)).toBe('Full Moon');
    expect(phaseName(200)).toBe('Waning gibbous');
    expect(phaseName(266)).toBe('Last quarter');
    expect(phaseName(300)).toBe('Waning crescent');
  });
});

describe('moonPhaseAt and nextQuarters', () => {
  const start = jdUtFromDate(new Date('2026-10-24T00:00:00Z'));
  const qs = nextQuarters(start, 8);

  it('finds the quarters in order, about a quarter of a month apart', () => {
    expect(qs[0]!.jdUt).toBeGreaterThan(start);
    const order = ['New Moon', 'First quarter', 'Full Moon', 'Last quarter'];
    for (let i = 1; i < qs.length; i++) {
      const gap = qs[i]!.jdUt - qs[i - 1]!.jdUt;
      expect(gap).toBeGreaterThan(5.5);
      expect(gap).toBeLessThan(9);
      expect(order.indexOf(qs[i]!.name)).toBe((order.indexOf(qs[i - 1]!.name) + 1) % 4);
    }
    // two full cycles span about two months
    expect(qs[4]!.jdUt - qs[0]!.jdUt).toBeCloseTo(SYNODIC_MONTH, -1);
  });

  it('at each quarter the phase reads as that quarter, lit as expected', () => {
    const lit = { 'New Moon': 0, 'First quarter': 0.5, 'Full Moon': 1, 'Last quarter': 0.5 } as Record<string, number>;
    for (const q of qs) {
      const p = moonPhaseAt(q.jdUt);
      expect(p.name).toBe(q.name);
      expect(p.lit).toBeCloseTo(lit[q.name]!, 1);
    }
  });
});

describe('litPath', () => {
  it('nothing at New Moon; a full disc at Full Moon; the lit side follows waxing and waning', () => {
    expect(litPath(0, 10)).toBeNull();
    // Full: both arcs have radius 10, so the whole disc
    expect(litPath(180, 10)).toBe('M 0 -10 A 10 10 0 0 0 0 10 A 10 10 0 0 0 0 -10 Z');
    // first quarter: right half, straight terminator
    expect(litPath(90, 10)).toMatch(/^M 0 -10 A 10 10 0 0 1 0 10 A 0 10 0 0 \d 0 -10 Z$/);
    // waxing limb runs round the right (sweep 1), waning round the left (sweep 0)
    expect(litPath(45, 10)!.split(' A ')[1]).toMatch(/0 0 1 0 10$/);
    expect(litPath(315, 10)!.split(' A ')[1]).toMatch(/0 0 0 0 10$/);
  });
});
