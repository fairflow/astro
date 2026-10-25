import { Body, Illumination, MoonPhase, SearchMoonQuarter } from 'astronomy-engine';
import { J2000_JD } from '../ephemeris/types.js';

/**
 * The Moon's phase, astronomically (astro-ht7): the eight named phases, the
 * phase at a moment and the next quarters, from astronomy-engine. Distinct
 * from the eight astrological lunation phases of interpret/dossiers.ts
 * (Rudhyar), which divide the cycle into 45° sectors starting at New Moon.
 */

/** Mean synodic month (New Moon to New Moon), days. */
export const SYNODIC_MONTH = 29.530589;

/** The eight phases, each at its elongation (Moon's longitude minus the Sun's). */
export const PHASES = [
  { name: 'New Moon', elong: 0 },
  { name: 'Waxing crescent', elong: 45 },
  { name: 'First quarter', elong: 90 },
  { name: 'Waxing gibbous', elong: 135 },
  { name: 'Full Moon', elong: 180 },
  { name: 'Waning gibbous', elong: 225 },
  { name: 'Last quarter', elong: 270 },
  { name: 'Waning crescent', elong: 315 },
] as const;

const QUARTER = ['New Moon', 'First quarter', 'Full Moon', 'Last quarter'] as const;
/** Within this many degrees of a quarter (about half a day), the quarter's own name. */
const AT_QUARTER = 6;

const utDays = (jdUt: number) => jdUt - J2000_JD;

export interface MoonPhaseNow {
  /** Moon's ecliptic longitude minus the Sun's, 0–360° (0 New, 180 Full). */
  elong: number;
  /** Fraction of the disc lit, 0–1. */
  lit: number;
  /** Days since New Moon, from the elongation and the mean month. */
  age: number;
  name: string;
  waxing: boolean;
}

/** The name for an elongation: a quarter's own name near it, else the crescent or gibbous between. */
export function phaseName(elong: number): string {
  const q = Math.round(elong / 90) % 4;
  if (Math.abs(elong - Math.round(elong / 90) * 90) <= AT_QUARTER) return QUARTER[q]!;
  return PHASES[Math.floor(elong / 90) * 2 + 1]!.name;
}

export function moonPhaseAt(jdUt: number): MoonPhaseNow {
  const elong = MoonPhase(utDays(jdUt));
  return {
    elong,
    lit: Illumination(Body.Moon, utDays(jdUt)).phase_fraction,
    age: (elong / 360) * SYNODIC_MONTH,
    name: phaseName(elong),
    waxing: elong < 180,
  };
}

/** The next n quarters (New, First quarter, Full, Last quarter) after jdUt. */
export function nextQuarters(jdUt: number, n = 4): { name: string; jdUt: number }[] {
  const out: { name: string; jdUt: number }[] = [];
  let q = SearchMoonQuarter(utDays(jdUt));
  for (let i = 0; i < n; i++) {
    out.push({ name: QUARTER[q.quarter]!, jdUt: q.time.ut + J2000_JD });
    q = SearchMoonQuarter(q.time.ut + 1);
  }
  return out;
}

/**
 * SVG path of the lit part of the Moon's disc as seen from Earth (northern
 * hemisphere: waxing lit on the right), for a disc of radius r centred at 0,0;
 * null at New Moon. The lit limb is a half circle on the Sun's side; the
 * terminator is a half ellipse of half-width r·|cos elong|, bulging toward the
 * lit limb for a crescent and away from it for a gibbous Moon.
 */
export function litPath(elong: number, r: number): string | null {
  const e = ((elong % 360) + 360) % 360;
  const c = Math.cos((e * Math.PI) / 180);
  if (c > 0.9995) return null;                        // new: nothing lit
  const rx = +(Math.abs(c) * r).toFixed(3);   // plain decimals: 6e-16 at a quarter reads as 0
  const waxing = e < 180;
  const crescent = c > 0;
  // limb from top to bottom: clockwise (sweep 1) round the right for waxing, the left for waning
  const limb = `M 0 ${-r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r}`;
  // terminator back to the top: on the limb's side for a crescent, the far side for a gibbous
  const sweep = waxing === crescent ? 0 : 1;
  return `${limb} A ${rx} ${r} 0 0 ${sweep} 0 ${-r} Z`;
}
