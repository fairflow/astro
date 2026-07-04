import { SiderealTime } from 'astronomy-engine';
import { J2000_JD, normDeg } from '../ephemeris/types.js';
import { timeFromJdUt } from '../ephemeris/core.js';

/** Julian Day (UT) from a civil UTC instant. */
export function jdUtFromUtc(
  year: number, month: number, day: number,
  hour = 0, minute = 0, second = 0,
): number {
  // Fliegel & Van Flandern, valid for all Gregorian dates.
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn - 0.5 + (hour + minute / 60 + second / 3600) / 24;
}

export function jdUtFromDate(d: Date): number {
  return J2000_JD + (d.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
}

/**
 * Right ascension of the local meridian (RAMC), degrees.
 * East longitude positive.
 */
export function ramc(jdUt: number, geoLonDeg: number): number {
  const gastHours = SiderealTime(timeFromJdUt(jdUt)); // Greenwich apparent
  return normDeg(gastHours * 15 + geoLonDeg);
}

/** Mean obliquity of the ecliptic (Meeus 22.2), degrees. Good to <1" here. */
export function obliquity(jdUt: number): number {
  const T = timeFromJdUt(jdUt).tt / 36525;
  return 23 + 26 / 60 + 21.448 / 3600
    - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}
