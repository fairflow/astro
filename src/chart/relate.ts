import {
  Aspect, AspectDef, ChartPoint, DEFAULT_ASPECTS, findAspects,
} from './aspects.js';
import type { Chart, ChartPosition } from './chart.js';
import { houseOf } from './houses.js';
import { BodyKey, EclipticState, degDiff, normDeg } from '../ephemeris/types.js';

/**
 * Relationships between two charts: synastry inter-aspects, house
 * overlays, midpoint composite, and transits (which are structurally a
 * chart-to-chart comparison where chart B is the current sky).
 */

const LUMINARIES = new Set<BodyKey>(['sun', 'moon']);
const MINOR = new Set<BodyKey>([
  'chiron', 'ceres', 'pallas', 'juno', 'vesta', 'eris', 'meanNode', 'lilith',
]);

export interface CrossAspect extends Aspect {
  /** a belongs to chart A (or the transiting sky), b to chart B (natal). */
  aOwner: 'A' | 'B';
}

export interface CrossOptions {
  defs?: AspectDef[];
  /** Multiplies every orb (synastry convention: tighter than natal). */
  orbFactor?: number;
  minorBodyOrbCap?: number;
}

/** Inter-chart aspects: every body of A against every body of B. */
export function crossAspects(
  aPoints: ChartPoint[], bPoints: ChartPoint[], opts: CrossOptions = {},
): CrossAspect[] {
  const defs = opts.defs ?? DEFAULT_ASPECTS;
  const factor = opts.orbFactor ?? 0.75;
  const cap = opts.minorBodyOrbCap ?? 2.5;
  const out: CrossAspect[] = [];
  for (const P of aPoints) {
    for (const Q of bPoints) {
      const sep = Math.abs(degDiff(P.state.lon, Q.state.lon));
      for (const def of defs) {
        const luminary = LUMINARIES.has(P.body) || LUMINARIES.has(Q.body);
        let maxOrb = (luminary ? def.luminaryOrb : def.baseOrb) * factor;
        if (MINOR.has(P.body) || MINOR.has(Q.body)) maxOrb = Math.min(maxOrb, cap);
        const orb = Math.abs(sep - def.angle);
        if (orb > maxOrb) continue;
        const dSep = Math.sign(degDiff(P.state.lon, Q.state.lon))
          * (P.state.speed - Q.state.speed);
        const wLum = (LUMINARIES.has(P.body) ? 1.6 : 1) * (LUMINARIES.has(Q.body) ? 1.6 : 1);
        out.push({
          a: P.body, b: Q.body, def, orb, maxOrb,
          applying: (sep - def.angle) * dSep < 0,
          weight: (1 - orb / maxOrb) * wLum,
          aOwner: 'A',
        });
      }
    }
  }
  return out.sort((x, y) => y.weight - x.weight);
}

/**
 * Transit orbs (tight, per convention — see docs/research): majors 3°
 * (4° to a natal luminary), quincunx 1.5°; the transiting Moon gets
 * ~1° so its hours-long passes don't flood the list.
 */
export function transitAspects(
  sky: ChartPoint[], natal: ChartPoint[],
): CrossAspect[] {
  const defs = DEFAULT_ASPECTS.map(d => ({
    ...d,
    baseOrb: d.name === 'quincunx' ? 1.5 : 3,
    luminaryOrb: d.name === 'quincunx' ? 2 : 4,
  }));
  const out = crossAspects(sky, natal, { defs, orbFactor: 1, minorBodyOrbCap: 2 });
  return out.filter(x => x.a !== 'moon' || x.orb <= 1);
}

/** Where chart B's bodies fall in chart A's houses. */
export interface Overlay {
  body: BodyKey;
  lon: number;
  house: number;
}

export function houseOverlay(bPositions: ChartPosition[], aCusps: number[]): Overlay[] {
  return bPositions.map(p => ({
    body: p.body, lon: p.lon, house: houseOf(p.lon, aCusps),
  }));
}

/** Shorter-arc circular midpoint (standard for composites). */
export function circularMidpoint(a: number, b: number): number {
  return normDeg(a + degDiff(b, a) / 2);
}

/**
 * Midpoint composite chart: like-planet midpoints, cusp midpoints.
 * The composite is not a sky that ever existed — houses are indicative
 * (cusp-midpoint method, as astro.com defaults to for composite houses).
 */
export function compositeChart(a: Chart, b: Chart): Chart {
  const positions: ChartPosition[] = [];
  const cusps = a.houses.cusps.map((c, i) =>
    circularMidpoint(c, b.houses.cusps[i]!));
  for (const pa of a.positions) {
    const pb = b.positions.find(p => p.body === pa.body);
    if (!pb) continue;
    const lon = circularMidpoint(pa.lon, pb.lon);
    const state: EclipticState = {
      lon, lat: (pa.lat + pb.lat) / 2, speed: (pa.speed + pb.speed) / 2,
    };
    positions.push({ body: pa.body, ...state, house: houseOf(lon, cusps) });
  }
  const aspects = findAspects(
    positions.map(p => ({ body: p.body, state: p })),
  );
  return {
    jdUt: (a.jdUt + b.jdUt) / 2,
    positions,
    houses: {
      system: a.houses.system,
      polarFallback: a.houses.polarFallback || b.houses.polarFallback,
      cusps,
      asc: circularMidpoint(a.houses.asc, b.houses.asc),
      mc: circularMidpoint(a.houses.mc, b.houses.mc),
    },
    aspects,
    missing: [...new Set([...a.missing, ...b.missing])],
  };
}

/**
 * Ebertin-style midpoint contacts in synastry: B's body conjunct or
 * opposite A's X/Y midpoint (or square, on the 90° dial), tight orb.
 */
export interface MidpointContact {
  /** The person whose midpoint is touched. */
  pair: [BodyKey, BodyKey];
  midpoint: number;
  /** The other person's body making the contact. */
  body: BodyKey;
  bodyLon: number;
  /** Angle on the 90° dial: 0 = conj/opp/square structure collapse. */
  orb: number;
  weight: number;
}

const MIDPOINT_BODIES: BodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
];

/**
 * Transiting bodies on a chart's Sun/Moon midpoint (Ebertin 90° dial,
 * tight orb) — used by the transits-to-couple view.
 */
export function sunMoonMidpointHits(
  sky: ChartPoint[], chart: Chart, orb = 1.5,
): { body: BodyKey; orb: number }[] {
  const sun = chart.positions.find(p => p.body === 'sun');
  const moon = chart.positions.find(p => p.body === 'moon');
  if (!sun || !moon) return [];
  const mid = circularMidpoint(sun.lon, moon.lon);
  const out: { body: BodyKey; orb: number }[] = [];
  for (const p of sky) {
    if (MINOR.has(p.body) || p.body === 'moon') continue;
    const d = Math.abs(degDiff(p.state.lon, mid));
    const dial = Math.min(d % 90, 90 - (d % 90));
    if (dial <= orb) out.push({ body: p.body, orb: dial });
  }
  return out.sort((x, y) => x.orb - y.orb);
}

export function midpointContacts(
  ofChart: Chart, byChart: Chart, orb = 1.5, max = 12,
): MidpointContact[] {
  const out: MidpointContact[] = [];
  const A = ofChart.positions.filter(p => MIDPOINT_BODIES.includes(p.body));
  const B = byChart.positions.filter(p => MIDPOINT_BODIES.includes(p.body));
  for (let i = 0; i < A.length; i++) {
    for (let j = i + 1; j < A.length; j++) {
      const mid = circularMidpoint(A[i]!.lon, A[j]!.lon);
      for (const q of B) {
        // 90° dial: conjunction, opposition and squares to the midpoint
        // all count as the hard-contact structure Ebertin reads.
        const d = Math.abs(degDiff(q.lon, mid));
        const dial = Math.min(d % 90, 90 - (d % 90));
        if (dial <= orb) {
          const lum = (n: BodyKey) => LUMINARIES.has(n) ? 1.5 : 1;
          out.push({
            pair: [A[i]!.body, A[j]!.body], midpoint: mid,
            body: q.body, bodyLon: q.lon, orb: dial,
            weight: (1 - dial / orb) * lum(q.body) * lum(A[i]!.body) * lum(A[j]!.body),
          });
        }
      }
    }
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, max);
}
