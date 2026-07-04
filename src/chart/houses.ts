import { normDeg } from '../ephemeris/types.js';
import { obliquity, ramc } from './time.js';

const D = Math.PI / 180;

export type HouseSystem = 'placidus' | 'porphyry';

export interface Houses {
  system: HouseSystem;
  /** True when Placidus was requested but undefined at this latitude. */
  polarFallback: boolean;
  /** cusps[0] = 1st house cusp = Ascendant, ecliptic longitude degrees. */
  cusps: number[];
  asc: number;
  mc: number;
}

/** Ecliptic longitude of the ecliptic point with right ascension `raDeg`. */
function eclLonOfRa(raDeg: number, epsDeg: number): number {
  const ra = raDeg * D;
  return normDeg(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(epsDeg * D)) / D);
}

export function mcLongitude(ramcDeg: number, epsDeg: number): number {
  return eclLonOfRa(ramcDeg, epsDeg);
}

export function ascendant(ramcDeg: number, epsDeg: number, latDeg: number): number {
  const ra = ramcDeg * D, eps = epsDeg * D, phi = latDeg * D;
  return normDeg(Math.atan2(
    Math.cos(ra),
    -(Math.sin(ra) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)),
  ) / D);
}

class PolarError extends Error {}

/**
 * One Placidus intermediate cusp by fixed-point iteration on right ascension.
 * `offset` is the target fraction of the relevant semi-arc expressed through
 * the classic formulation:
 *   cusp 11: RA - RAMC = SAd/3        cusp 12: RA - RAMC = 2*SAd/3
 *   cusp  2: RA - RAMC = 180 - 2*SAn/3   cusp 3: RA - RAMC = 180 - SAn/3
 * where SAd = 90 + AD, SAn = 90 - AD, AD = asin(tan phi * tan delta).
 */
function placidusCusp(
  ramcDeg: number, epsDeg: number, latDeg: number,
  f: number, nocturnal: boolean,
): number {
  const eps = epsDeg * D, phi = latDeg * D;
  let raDeg = normDeg(ramcDeg + (nocturnal ? 180 - f * 90 : f * 90));
  for (let i = 0; i < 60; i++) {
    const lon = eclLonOfRa(raDeg, epsDeg);
    const delta = Math.asin(Math.sin(eps) * Math.sin(lon * D));
    const x = Math.tan(phi) * Math.tan(delta);
    if (Math.abs(x) >= 1) throw new PolarError();
    const ad = Math.asin(x) / D;
    const sa = nocturnal ? 90 - ad : 90 + ad;
    const next = normDeg(ramcDeg + (nocturnal ? 180 - f * sa : f * sa));
    const step = Math.abs(normDeg(next - raDeg + 180) - 180);
    raDeg = next;
    if (step < 1e-9) break;
  }
  return eclLonOfRa(raDeg, epsDeg);
}

function porphyryCusps(asc: number, mc: number): number[] {
  const cusps = new Array<number>(12).fill(0);
  cusps[0] = asc;
  cusps[9] = mc;
  cusps[3] = normDeg(mc + 180);
  cusps[6] = normDeg(asc + 180);
  const q1 = normDeg(asc - mc);        // MC -> ASC arc
  cusps[10] = normDeg(mc + q1 / 3);
  cusps[11] = normDeg(mc + 2 * q1 / 3);
  const q2 = normDeg(cusps[3]! - asc); // ASC -> IC arc
  cusps[1] = normDeg(asc + q2 / 3);
  cusps[2] = normDeg(asc + 2 * q2 / 3);
  for (const [from, to] of [[10, 4], [11, 5], [1, 7], [2, 8]] as const) {
    cusps[to] = normDeg(cusps[from]! + 180);
  }
  return cusps;
}

export function houses(
  jdUt: number, latDeg: number, geoLonDeg: number,
  system: HouseSystem = 'placidus',
): Houses {
  const ra = ramc(jdUt, geoLonDeg);
  const eps = obliquity(jdUt);
  const asc = ascendant(ra, eps, latDeg);
  const mc = mcLongitude(ra, eps);

  if (system === 'placidus') {
    try {
      const cusps = new Array<number>(12).fill(0);
      cusps[0] = asc;
      cusps[9] = mc;
      cusps[10] = placidusCusp(ra, eps, latDeg, 1 / 3, false); // 11th
      cusps[11] = placidusCusp(ra, eps, latDeg, 2 / 3, false); // 12th
      cusps[1] = placidusCusp(ra, eps, latDeg, 2 / 3, true);   // 2nd
      cusps[2] = placidusCusp(ra, eps, latDeg, 1 / 3, true);   // 3rd
      for (const [from, to] of [[0, 6], [9, 3], [10, 4], [11, 5], [1, 7], [2, 8]] as const) {
        cusps[to] = normDeg(cusps[from]! + 180);
      }
      return { system: 'placidus', polarFallback: false, cusps, asc, mc };
    } catch (e) {
      if (!(e instanceof PolarError)) throw e;
      return {
        system: 'porphyry', polarFallback: true,
        cusps: porphyryCusps(asc, mc), asc, mc,
      };
    }
  }
  return { system: 'porphyry', polarFallback: false, cusps: porphyryCusps(asc, mc), asc, mc };
}

/** House (1-12) containing an ecliptic longitude, given cusps from houses(). */
export function houseOf(lonDeg: number, cusps: number[]): number {
  for (let h = 0; h < 12; h++) {
    const a = cusps[h]!, b = cusps[(h + 1) % 12]!;
    if (normDeg(lonDeg - a) < normDeg(b - a)) return h + 1;
  }
  return 12;
}
