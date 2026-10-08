import {
  Body, HelioVector, MakeTime, RotateVector, Rotation_EQJ_ECL,
} from 'astronomy-engine';
import {
  BodyKey, EphemerisProvider, J2000_JD, degDiff, normDeg,
} from '../ephemeris/types.js';

/**
 * Retrograde geometry for the planets: exact stations (from the app's
 * ephemeris provider, so they agree with the ℞ on the wheel),
 * heliocentric positions for the top-down orrery, and the alignments
 * with the Sun that pace each synodic cycle (inferior and superior
 * conjunctions for Mercury and Venus; oppositions and conjunctions for
 * the outer planets). Everything here is pure; the canvas drawing lives
 * in src/render/orrery.ts.
 */

export type InnerPlanet = 'mercury' | 'venus';
export type OuterPlanet = 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export type Planet = InnerPlanet | OuterPlanet;
export type OrreryBody = Planet | 'earth';

export const PLANETS_IN_ORDER: Planet[] = [
  'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];
export const isInner = (b: Planet): b is InnerPlanet => b === 'mercury' || b === 'venus';

export interface Station {
  /** SR: station retrograde (speed + → −); SD: station direct (− → +). */
  kind: 'SR' | 'SD';
  jdUt: number;
  /** Apparent geocentric ecliptic-of-date longitude at the station. */
  lon: number;
}

export interface RetroPeriod { sr: Station; sd: Station }

/**
 * Stations of `body` in [jdFrom, jdTo]. Scans the speed at `step` days,
 * then bisects each sign change against the provider to ~1 second. A
 * 2-day step cannot miss a station: retrograde spells last at least 19
 * days (Mercury) and direct spells far longer.
 *
 * `scanSpeed`, if given, is a cheaper speed estimate used only for the
 * scan (the animation's geometric longitudes); each bracket it finds is
 * widened by a day and refined with the provider, so the reported times
 * and longitudes are still the provider's.
 */
export function findStations(
  provider: EphemerisProvider, body: BodyKey, jdFrom: number, jdTo: number, step = 2,
  scanSpeed?: (jd: number) => number,
): Station[] {
  const speed = (jd: number) => provider.state(body, jd).speed;
  const scan = scanSpeed ?? speed;
  const out: Station[] = [];
  let ta = jdFrom;
  let sa = scan(ta);
  for (let tb = jdFrom + step; ta < jdTo; tb += step) {
    const sb = scan(tb);
    if ((sa > 0) !== (sb > 0)) {
      const pos = sa > 0;
      let lo = ta, hi = tb;
      if (scanSpeed) {
        lo = ta - 1; hi = tb + 1;
        if ((speed(lo) > 0) !== pos || (speed(hi) > 0) === pos) { ta = tb; sa = sb; continue; }
      }
      const jd = rootIn(speed, lo, hi);
      if (jd >= jdFrom && jd <= jdTo) {
        out.push({ kind: pos ? 'SR' : 'SD', jdUt: jd, lon: provider.state(body, jd).lon });
      }
    }
    ta = tb;
    sa = sb;
  }
  return out;
}

/**
 * Root of f in [lo, hi], where f changes sign, to 1e-5 day (~1 s). Illinois
 * method: a secant step that keeps the root bracketed and halves a stale
 * end's weight, so it converges in a handful of evaluations where
 * bisection needs ~18, and can never leave the bracket.
 */
function rootIn(f: (x: number) => number, lo: number, hi: number): number {
  let fa = f(lo), fb = f(hi), side = 0;
  for (let i = 0; i < 60 && hi - lo > 1e-5; i++) {
    let x = (lo * fb - hi * fa) / (fb - fa);
    // keep each step at least a little inside the bracket so its width always shrinks
    const eps = (hi - lo) * 1e-3;
    x = Math.min(hi - eps, Math.max(lo + eps, x));
    const fx = f(x);
    if ((fx > 0) === (fa > 0)) { lo = x; fa = fx; if (side === -1) fb /= 2; side = -1; }
    else { hi = x; fb = fx; if (side === 1) fa /= 2; side = 1; }
    if (Math.abs(fx) < 1e-12) return x;
  }
  return (lo + hi) / 2;
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
  mercury: Body.Mercury, venus: Body.Venus, earth: Body.Earth, mars: Body.Mars,
  jupiter: Body.Jupiter, saturn: Body.Saturn, uranus: Body.Uranus,
  neptune: Body.Neptune, pluto: Body.Pluto,
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
export function geometricLon(body: Planet, jdUt: number): number {
  const p = helioXY(body, jdUt), e = helioXY('earth', jdUt);
  return normDeg(Math.atan2(p[1] - e[1], p[0] - e[0]) * 180 / Math.PI
    + PRECESSION_PER_DAY * (jdUt - J2000_JD));
}

/** Heliocentric longitude difference planet − Earth, degrees in (−180, 180]. */
export function helioElongation(body: Planet, jdUt: number): number {
  const p = helioXY(body, jdUt), e = helioXY('earth', jdUt);
  return degDiff(Math.atan2(p[1], p[0]) * 180 / Math.PI, Math.atan2(e[1], e[0]) * 180 / Math.PI);
}

/** Mean sidereal periods (days) and the synodic periods they imply. */
export const SIDEREAL_DAYS: Record<OrreryBody, number> = {
  mercury: 87.9691, venus: 224.7008, earth: 365.25636, mars: 686.980,
  jupiter: 4332.589, saturn: 10759.22, uranus: 30685.4, neptune: 60189, pluto: 90560,
};
export function synodicDays(body: Planet): number {
  return 1 / Math.abs(1 / SIDEREAL_DAYS[body] - 1 / SIDEREAL_DAYS.earth);
}

/**
 * Oppositions of an outer planet (Earth passes between it and the Sun:
 * equal heliocentric longitude), mid-retrograde, in [jdFrom, jdTo].
 */
export function oppositions(body: OuterPlanet, jdFrom: number, jdTo: number): number[] {
  return conjunctions(body, jdFrom, jdTo, 0);
}

/** Conjunctions of an outer planet with the Sun (it passes behind the Sun). */
export function solarConjunctions(body: OuterPlanet, jdFrom: number, jdTo: number): number[] {
  return conjunctions(body, jdFrom, jdTo, 180);
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
function conjunctions(body: Planet, jdFrom: number, jdTo: number, offset: number): number[] {
  const out: number[] = [];
  // the scan step must stay well under half a synodic cycle; the outer planets' alignments
  // drift about 1°/day, so 8 days is ample, and Mercury's need 2
  const step = isInner(body) ? 2 : 8;
  // the faster body gains on the slower: the inner planet on Earth, or Earth on an outer
  // planet, so the (signed) difference always rises through 0 at an alignment
  const sign = isInner(body) ? 1 : -1;
  const d = (jd: number) => sign * degDiff(helioElongation(body, jd), offset);
  let ta = jdFrom, da = d(ta);
  for (let tb = jdFrom + step; ta < jdTo; tb += step) {
    const db = d(tb);
    if (da < 0 && db >= 0 && db - da < 90) {
      const jd = rootIn(d, ta, tb);
      if (jd >= jdFrom && jd <= jdTo) out.push(jd);
    }
    ta = tb;
    da = db;
  }
  return out;
}
