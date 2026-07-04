import { describe, expect, it } from 'vitest';
import { localToUt, zoneOffsetMinutes } from '../src/chart/civil.js';
import { jdUtFromUtc } from '../src/chart/time.js';

describe('civil time -> UT via IANA zones', () => {
  it('London BST: 1990-07-15 13:34 local = 12:34 UT', () => {
    const r = localToUt(1990, 7, 15, 13, 34, 'Europe/London');
    expect(r.offsetMinutes).toBe(60);
    expect(r.jdUt).toBeCloseTo(jdUtFromUtc(1990, 7, 15, 12, 34), 8);
  });

  it('London winter: 1962-02-05 00:00 local = 00:00 UT', () => {
    const r = localToUt(1962, 2, 5, 0, 0, 'Europe/London');
    expect(r.offsetMinutes).toBe(0);
    expect(r.jdUt).toBeCloseTo(jdUtFromUtc(1962, 2, 5, 0, 0), 8);
  });

  it('UK double summer time 1943: offset +2h', () => {
    const r = localToUt(1943, 6, 15, 12, 0, 'Europe/London');
    expect(r.offsetMinutes).toBe(120);
  });

  it('New York EST: 1962-02-05 -> UTC-5', () => {
    const r = localToUt(1962, 2, 5, 9, 30, 'America/New_York');
    expect(r.offsetMinutes).toBe(-300);
    expect(r.jdUt).toBeCloseTo(jdUtFromUtc(1962, 2, 5, 14, 30), 8);
  });

  it('Kathmandu: +05:45', () => {
    const r = localToUt(2000, 1, 1, 5, 45, 'Asia/Kathmandu');
    expect(r.offsetMinutes).toBe(345);
    expect(r.jdUt).toBeCloseTo(jdUtFromUtc(2000, 1, 1, 0, 0), 8);
  });

  it('zoneOffsetMinutes flips across a DST boundary', () => {
    const before = zoneOffsetMinutes('Europe/London', Date.UTC(2026, 2, 29, 0, 30));
    const after = zoneOffsetMinutes('Europe/London', Date.UTC(2026, 2, 29, 1, 30));
    expect(before).toBe(0);
    expect(after).toBe(60);
  });
});
