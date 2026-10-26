import {
  AstroTime, Body, Equator, GeoMoon, GeoVector, Horizon, NextGlobalSolarEclipse, NextLocalSolarEclipse,
  NextLunarEclipse, Observer, RotateVector, Rotation_EQJ_EQD, SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse, SearchLunarEclipse, Vector, VectorObserver,
} from 'astronomy-engine';
import { J2000_JD } from '../ephemeris/types.js';

/**
 * Eclipses round a moment, for the orrery's Moon panel (astro-0qk), from
 * astronomy-engine: the lunar eclipse in progress or next, with whether the
 * Moon is up at a place; the solar eclipse in progress or next as seen from
 * that place; and the next solar eclipse anywhere on Earth. Times are UT
 * Julian days.
 */

export interface Place { name: string; lat: number; lon: number; height: number }
/** The Royal Observatory, Greenwich: the first place (a choice of place may follow). */
export const GREENWICH: Place = { name: 'Greenwich, London', lat: 51.4769, lon: -0.0005, height: 46 };

export type EclipseKind = 'penumbral' | 'partial' | 'annular' | 'total';

export interface LunarEclipse {
  kind: EclipseKind;
  /** Penumbral contact to contact; the umbral (partial) and total phases within, if any. */
  start: number; end: number; peak: number;
  partial: [number, number] | null; total: [number, number] | null;
  /** Fraction of the Moon's disc in the umbra at the peak (0 for a penumbral eclipse). */
  obscuration: number;
  /** The Moon's altitude at the place at the peak, degrees: above 0, the peak can be seen there. */
  moonAlt: number;
  /** When the eclipse before this one ended, if the search passed it (else -Infinity). */
  since: number;
}
export interface LocalSolarEclipse {
  kind: EclipseKind;
  start: number; peak: number; end: number;
  /** Fraction of the Sun's disc covered at the peak, at the place. */
  obscuration: number;
  /** The Sun's altitude at the place at the peak, degrees. */
  sunAlt: number;
  since: number;
}
export interface GlobalSolarEclipse {
  kind: EclipseKind; peak: number;
  /** Where the eclipse is greatest (total and annular eclipses only). */
  lat?: number; lon?: number;
  since: number;
}

const ut = (jd: number) => jd - J2000_JD;
const jdOf = (t: { ut: number }) => t.ut + J2000_JD;
const MIN = 1 / 1440;
// the longest eclipses last about six hours: start searches this far back, so one in progress is found
const BACK = 0.3;

function lunar(e: ReturnType<typeof SearchLunarEclipse>, obs: Observer, since = -Infinity): LunarEclipse {
  const peak = jdOf(e.peak);
  const span = (sd: number): [number, number] | null => (sd > 0 ? [peak - sd * MIN, peak + sd * MIN] : null);
  const eq = Equator(Body.Moon, e.peak, obs, true, true);
  return {
    kind: e.kind as EclipseKind, peak, start: peak - e.sd_penum * MIN, end: peak + e.sd_penum * MIN,
    partial: span(e.sd_partial), total: span(e.sd_total), obscuration: e.obscuration,
    moonAlt: Horizon(e.peak, obs, eq.ra, eq.dec, 'normal').altitude, since,
  };
}

/** The lunar eclipse in progress at jd, or the next one. */
export function lunarEclipseAt(jd: number, place: Place = GREENWICH): LunarEclipse {
  const obs = new Observer(place.lat, place.lon, place.height);
  let e = SearchLunarEclipse(ut(jd - BACK)), since = -Infinity;
  for (let x = lunar(e, obs); x.end < jd; x = lunar(e, obs)) { since = x.end; e = NextLunarEclipse(e.peak); }
  return lunar(e, obs, since);
}

/** The solar eclipse in progress at jd as seen from the place, or the next one seen there. */
export function localSolarEclipseAt(jd: number, place: Place = GREENWICH): LocalSolarEclipse {
  const obs = new Observer(place.lat, place.lon, place.height);
  let e = SearchLocalSolarEclipse(ut(jd - BACK), obs), since = -Infinity;
  while (jdOf(e.partial_end.time) < jd) { since = jdOf(e.partial_end.time); e = NextLocalSolarEclipse(e.peak.time, obs); }
  return {
    kind: e.kind as EclipseKind, obscuration: e.obscuration, sunAlt: e.peak.altitude, since,
    start: jdOf(e.partial_begin.time), peak: jdOf(e.peak.time), end: jdOf(e.partial_end.time),
  };
}

/** The next solar eclipse anywhere (its peak after jd, or within the last few hours). */
export function globalSolarEclipseAt(jd: number): GlobalSolarEclipse {
  let e = SearchGlobalSolarEclipse(ut(jd - 0.3)), since = -Infinity;
  while (jdOf(e.peak) < jd - 0.15) { since = jdOf(e.peak) + 0.15; e = NextGlobalSolarEclipse(e.peak); }
  return { kind: e.kind as EclipseKind, peak: jdOf(e.peak), lat: e.latitude, lon: e.longitude, since };
}

const AU_KM = 149_597_870.7;
// WGS 84
const EARTH_A = 6378.137 / AU_KM, EARTH_B = 6356.752 / AU_KM;

/**
 * Where the axis of the Moon's shadow meets the Earth at jd: a point on the
 * central line of a total or annular solar eclipse, or null when the axis
 * misses the Earth.
 */
export function shadowAxisPoint(jd: number): { lat: number; lon: number } | null {
  const t = new AstroTime(ut(jd));
  const rot = Rotation_EQJ_EQD(t);
  const m = RotateVector(rot, GeoMoon(t)), s = RotateVector(rot, GeoVector(Body.Sun, t, true));
  // the line from the Sun through the Moon, in coordinates where the Earth is a unit sphere
  const k = EARTH_A / EARTH_B;
  const p = [m.x / EARTH_A, m.y / EARTH_A, m.z * k / EARTH_A];
  const d0 = [m.x - s.x, m.y - s.y, (m.z - s.z) * k];
  const n = Math.hypot(d0[0]!, d0[1]!, d0[2]!), d = d0.map(c => c / n);
  // |p + u d| = 1, nearer root
  const b = p[0]! * d[0]! + p[1]! * d[1]! + p[2]! * d[2]!;
  const c = p[0]! ** 2 + p[1]! ** 2 + p[2]! ** 2 - 1;
  const disc = b * b - c;
  if (disc < 0) return null;
  const u = -b - Math.sqrt(disc);
  const q = p.map((x, i) => x + u * d[i]!);
  const o = VectorObserver(new Vector(q[0]! * EARTH_A, q[1]! * EARTH_A, q[2]! * EARTH_A / k, t), true);
  return { lat: o.latitude, lon: o.longitude };
}

/**
 * The central line of the solar eclipse peaking at `peak`: the shadow axis's
 * landing point every `stepMin` minutes while it touches the Earth, with the
 * first and last points (sunrise and sunset on the line) found to the second.
 * Empty when the axis misses the Earth (a partial eclipse).
 */
export function centralLine(peak: number, stepMin = 10): { jd: number; lat: number; lon: number }[] {
  if (!shadowAxisPoint(peak)) return [];
  // the axis crosses the Earth in at most about 3.5 hours: the edges lie within 2 hours of the peak
  const edge = (dir: 1 | -1) => {
    let on = peak, off = peak + dir * 120 * MIN;
    while (Math.abs(off - on) > 1 / 86400) {
      const mid = (on + off) / 2;
      if (shadowAxisPoint(mid)) on = mid; else off = mid;
    }
    return on;
  };
  const first = edge(-1), last = edge(1), step = stepMin * MIN;
  const times = [first];
  for (let jd = peak - Math.floor((peak - first) / step) * step; jd < last; jd += step) if (jd > first) times.push(jd);
  times.push(last);
  return times.map(jd => ({ jd, ...shadowAxisPoint(jd)! }));
}

/** The Earth–Moon distance at jd, km (centre to centre). */
export function moonDistanceKm(jd: number): number {
  const v = GeoMoon(ut(jd));
  return Math.hypot(v.x, v.y, v.z) * AU_KM;
}

export interface EclipseSet { lunar: LunarEclipse; localSolar: LocalSolarEclipse; globalSolar: GlobalSolarEclipse }

/**
 * Eclipses for a moment, recomputed only when the moment leaves the span the
 * last answer covers (the orrery asks ten times a second while it plays).
 */
export function eclipseCache(place: Place = GREENWICH) {
  let from = Infinity, until = -Infinity, set: EclipseSet | null = null;
  return (jd: number): EclipseSet => {
    if (!set || jd < from || jd > until) {
      set = { lunar: lunarEclipseAt(jd, place), localSolar: localSolarEclipseAt(jd, place), globalSolar: globalSolarEclipseAt(jd) };
      // still right until the first of them ends (or passes), and back to where the searches
      // began or the end of an eclipse they passed, whichever is later
      from = Math.max(jd - BACK, set.lunar.since, set.localSolar.since, set.globalSolar.since);
      until = Math.min(set.lunar.end, set.localSolar.end, set.globalSolar.peak + 0.15);
    }
    return set;
  };
}
