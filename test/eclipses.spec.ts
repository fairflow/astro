// Eclipses for the orrery's Moon panel (astro-0qk), against eclipses on record.
import { describe, expect, it } from 'vitest';
import {
  centralLine, eclipseCache, globalSolarEclipseAt, localSolarEclipseAt, lunarEclipseAt, moonDistanceKm,
} from '../src/chart/eclipses.js';

const jd = (s: string) => new Date(s).getTime() / 86400000 + 2440587.5;
const iso = (j: number) => new Date((j - 2440587.5) * 86400000).toISOString().slice(0, 13);

describe('eclipses on record', () => {
  it('the total solar eclipse of 12 August 2026 (Iceland, Spain): partial at Greenwich, the Sun low', () => {
    const g = globalSolarEclipseAt(jd('2026-08-01'));
    expect(g.kind).toBe('total');
    expect(iso(g.peak)).toBe('2026-08-12T17');
    const l = localSolarEclipseAt(jd('2026-08-01'));
    expect(l.kind).toBe('partial');
    expect(iso(l.peak)).toBe('2026-08-12T18');
    expect(l.obscuration).toBeGreaterThan(0.8);
    expect(l.sunAlt).toBeGreaterThan(0);
  });

  it('the total lunar eclipse of 3 March 2026 happens in daylight at Greenwich (Moon below the horizon)', () => {
    const e = lunarEclipseAt(jd('2026-02-20'));
    expect(e.kind).toBe('total');
    expect(iso(e.peak)).toBe('2026-03-03T11');
    expect(e.total).not.toBeNull();
    expect(e.moonAlt).toBeLessThan(0);
  });

  it('the partial lunar eclipse of 28 August 2026 is up at Greenwich', () => {
    const e = lunarEclipseAt(jd('2026-08-20'));
    expect(e.kind).toBe('partial');
    expect(iso(e.peak)).toBe('2026-08-28T04');
    expect(e.total).toBeNull();
    expect(e.moonAlt).toBeGreaterThan(0);
  });
});

describe('in progress, then the next', () => {
  it('an eclipse is returned while it is under way, and the next one once it has ended', () => {
    const e = lunarEclipseAt(jd('2026-02-20'));
    expect(lunarEclipseAt(e.peak).peak).toBe(e.peak);              // at its peak: still this one
    const after = lunarEclipseAt(e.end + 0.01);
    expect(after.peak).toBeGreaterThan(e.end);                      // then the next
    expect(after.since).toBeCloseTo(e.end, 5);                      // which says when this one ended
  });

  it('the cache gives what a fresh search gives, going forwards and back', () => {
    const at = eclipseCache();
    const start = jd('2026-02-25');
    for (let t = start; t < start + 40; t += 0.37) {
      expect(at(t).lunar.peak).toBe(lunarEclipseAt(t).peak);
    }
    for (let t = start + 40; t > start; t -= 0.37) {
      expect(at(t).lunar.peak).toBe(lunarEclipseAt(t).peak);
    }
  });
});

describe('centralLine', () => {
  it('12 August 2026: Siberia at sunrise, over the Pole, west of Iceland, ending at sunset past Spain', () => {
    const g = globalSolarEclipseAt(jd('2026-08-01'));
    const line = centralLine(g.peak);
    const first = line[0]!, last = line.at(-1)!;
    expect(first.lat).toBeGreaterThan(70);
    expect(first.lon).toBeGreaterThan(90);           // Taymyr
    expect(Math.max(...line.map(p => p.lat))).toBeGreaterThan(85);
    // at the peak the axis lands on astronomy-engine's own point of greatest eclipse
    const peak = line.find(p => Math.abs(p.jd - g.peak) < 1e-6)!;
    expect(peak.lat).toBeCloseTo(g.lat!, 1);
    expect(peak.lon).toBeCloseTo(g.lon!, 1);
    expect(last.lat).toBeGreaterThan(38);
    expect(last.lat).toBeLessThan(40.5);
    expect(last.lon).toBeGreaterThan(2);             // the Balearics
    expect(last.lon).toBeLessThan(6);
    expect((last.jd - first.jd) * 1440).toBeGreaterThan(80);
  });

  it('2 August 2027: crosses the Strait of Gibraltar and passes Luxor', () => {
    const line = centralLine(globalSolarEclipseAt(jd('2027-07-20')).peak);
    const near = (lat: number, lon: number) => Math.min(...line.map(p => Math.hypot(p.lat - lat, p.lon - lon)));
    expect(near(35.9, -5.6)).toBeLessThan(1.5);
    expect(near(25.7, 32.6)).toBeLessThan(1.5);
  });

  it('is empty for a partial eclipse (the axis misses the Earth)', () => {
    const g = globalSolarEclipseAt(jd('2025-09-01'));
    expect(g.kind).toBe('partial');
    expect(centralLine(g.peak)).toEqual([]);
  });
});

describe('moonDistanceKm', () => {
  it('stays between perigee and apogee', () => {
    for (let t = jd('2026-01-01'); t < jd('2026-03-01'); t += 1.5) {
      const d = moonDistanceKm(t);
      expect(d).toBeGreaterThan(355_000);
      expect(d).toBeLessThan(407_000);
    }
  });
});
