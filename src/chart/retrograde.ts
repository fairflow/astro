import {
  Body, HelioVector, MakeTime, RotateVector, Rotation_EQJ_ECL,
} from 'astronomy-engine';
import {
  BodyKey, EphemerisProvider, J2000_JD, degDiff, normDeg,
} from '../ephemeris/types.js';

/**
 * Retrograde geometry for the inner planets: exact stations (from the
 * app's ephemeris provider, so they agree with the ℞ on the wheel),
 * heliocentric positions for the top-down orrery, and inferior
 * conjunctions. Everything here is pure; the canvas drawing lives in
 * src/render/orrery.ts.
 */

export type InnerPlanet = 'mercury' | 'venus';
export type OrreryBody = InnerPlanet | 'earth';

export interface Station {
  /** SR: station retrograde (speed + → −); SD: station direct (− → +). */
  kind: 'SR' | 'SD';
  jdUt: number;
  /** Apparent geocentric ecliptic-of-date longitude at the station. */
  lon: number;
}

export interface RetroPeriod { sr: Station; sd: Station }

/**
 * Stations of `body` in [jdFrom, jdTo]. Scans the provider's speed at
 * `step` days, then bisects each sign change to ~1 second. A 2-day step
 * cannot miss a station of Mercury or Venus: their retrograde spells last
 * at least 19 days and their direct spells far longer.
 */
export function findStations(
  provider: EphemerisProvider, body: BodyKey, jdFrom: number, jdTo: number, step = 2,
): Station[] {
  const speed = (jd: number) => provider.state(body, jd).speed;
  const out: Station[] = [];
  let ta = jdFrom;
  let sa = speed(ta);
  for (let tb = jdFrom + step; ta < jdTo; tb += step) {
    const sb = speed(tb);
    if ((sa > 0) !== (sb > 0)) {
      let lo = ta, hi = tb;
      const pos = sa > 0;
      while (hi - lo > 1e-5) {
        const mid = (lo + hi) / 2;
        if ((speed(mid) > 0) === pos) lo = mid; else hi = mid;
      }
      const jd = (lo + hi) / 2;
      if (jd >= jdFrom && jd <= jdTo) {
        out.push({ kind: pos ? 'SR' : 'SD', jdUt: jd, lon: provider.state(body, jd).lon });
      }
    }
    ta = tb;
    sa = sb;
  }
  return out;
}

/** Pairs each station retrograde with the station direct that follows it. */
export function retroPeriods(stations: Station[]): RetroPeriod[] {
  const out: RetroPeriod[] = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const sr = stations[i]!, sd = stations[i + 1]!;
    if (sr.kind === 'SR' && sd.kind === 'SD') out.push({ sr, sd });
  }
  return out;
}

/** Arc travelled backwards during a retrograde period, degrees. */
export function retroArc(p: RetroPeriod): number {
  return normDeg(p.sr.lon - p.sd.lon);
}

const AE: Record<OrreryBody, Body> = {
  mercury: Body.Mercury, venus: Body.Venus, earth: Body.Earth,
};
const EQJ_ECL = Rotation_EQJ_ECL();
/** General precession in longitude, deg/day: J2000 ecliptic → equinox of date. */
export const PRECESSION_PER_DAY = 1.396971 / 36525;

/**
 * Heliocentric position projected onto the ecliptic plane, AU, in the
 * J2000 ecliptic frame (x towards the J2000 equinox). For drawing.
 */
export function helioXY(body: OrreryBody, jdUt: number): [number, number] {
  const v = RotateVector(EQJ_ECL, HelioVector(AE[body], MakeTime(jdUt - J2000_JD)));
  return [v.x, v.y];
}

/**
 * Geometric geocentric longitude, equinox of date: the direction from
 * Earth to the planet in the drawing. Differs from the provider's
 * apparent longitude by aberration, light time and nutation (under 1.5′),
 * so it is used for the animated tracks, never for reported values.
 */
export function geometricLon(body: InnerPlanet, jdUt: number): number {
  const p = helioXY(body, jdUt), e = helioXY('earth', jdUt);
  return normDeg(Math.atan2(p[1] - e[1], p[0] - e[0]) * 180 / Math.PI
    + PRECESSION_PER_DAY * (jdUt - J2000_JD));
}

/** Heliocentric longitude difference planet − Earth, degrees in (−180, 180]. */
export function helioElongation(body: InnerPlanet, jdUt: number): number {
  const p = helioXY(body, jdUt), e = helioXY('earth', jdUt);
  return degDiff(Math.atan2(p[1], p[0]) * 180 / Math.PI, Math.atan2(e[1], e[0]) * 180 / Math.PI);
}

/** Mean sidereal periods (days) and the synodic periods they imply. */
export const SIDEREAL_DAYS: Record<OrreryBody, number> = {
  mercury: 87.9691, venus: 224.7008, earth: 365.25636,
};
export function synodicDays(body: InnerPlanet): number {
  return 1 / (1 / SIDEREAL_DAYS[body] - 1 / SIDEREAL_DAYS.earth);
}

/**
 * Inferior conjunctions (planet passes between Sun and Earth: equal
 * heliocentric longitude) in [jdFrom, jdTo], to ~1 second.
 */
export function inferiorConjunctions(body: InnerPlanet, jdFrom: number, jdTo: number): number[] {
  return conjunctions(body, jdFrom, jdTo, 0);
}

/**
 * Superior conjunctions (planet passes behind the Sun: heliocentric
 * longitudes 180° apart) in [jdFrom, jdTo], to ~1 second.
 */
export function superiorConjunctions(body: InnerPlanet, jdFrom: number, jdTo: number): number[] {
  return conjunctions(body, jdFrom, jdTo, 180);
}

/** Times when planet − Earth heliocentric longitude passes `offset` degrees. */
function conjunctions(body: InnerPlanet, jdFrom: number, jdTo: number, offset: number): number[] {
  const out: number[] = [];
  const step = 2;
  const d = (jd: number) => degDiff(helioElongation(body, jd), offset);
  let ta = jdFrom, da = d(ta);
  for (let tb = jdFrom + step; ta < jdTo; tb += step) {
    const db = d(tb);
    // the inner planet gains on Earth, so the difference rises through 0
    if (da < 0 && db >= 0 && db - da < 90) {
      let lo = ta, hi = tb;
      while (hi - lo > 1e-5) {
        const mid = (lo + hi) / 2;
        if (d(mid) < 0) lo = mid; else hi = mid;
      }
      const jd = (lo + hi) / 2;
      if (jd >= jdFrom && jd <= jdTo) out.push(jd);
    }
    ta = tb;
    da = db;
  }
  return out;
}
