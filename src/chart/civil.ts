import { J2000_JD } from '../ephemeris/types.js';

/**
 * Civil (wall-clock) birth time + IANA zone -> UT, using the runtime's
 * full IANA database via Intl. Handles historical rules (e.g. UK double
 * summer time in the 1940s) without shipping our own tzdb.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(zone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false, era: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dtfCache.set(zone, f);
  }
  return f;
}

/** UTC offset of `zone` at a UTC instant, in minutes (east positive). */
export function zoneOffsetMinutes(zone: string, utcMs: number): number {
  const parts: Record<string, string> = {};
  for (const p of dtf(zone).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  const wall = Date.UTC(
    year, Number(parts.month) - 1, Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute), Number(parts.second),
  );
  return Math.round((wall - utcMs) / 60000);
}

export interface LocalToUt {
  jdUt: number;
  utcMs: number;
  offsetMinutes: number;
}

/**
 * Wall-clock local time in `zone` -> UT. Two fixed-point passes resolve
 * DST; for times inside a spring-forward gap or repeated fall-back hour
 * the earlier plausible offset wins, which is the common convention.
 */
export function localToUt(
  year: number, month: number, day: number,
  hour: number, minute: number, zone: string,
): LocalToUt {
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  let offset = zoneOffsetMinutes(zone, wallMs);
  let utcMs = wallMs - offset * 60000;
  offset = zoneOffsetMinutes(zone, utcMs);
  utcMs = wallMs - offset * 60000;
  return {
    jdUt: J2000_JD + (utcMs - Date.UTC(2000, 0, 1, 12)) / 86400000,
    utcMs,
    offsetMinutes: offset,
  };
}

/** Format an offset like "UTC+01:00". */
export function fmtOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const m = Math.abs(minutes);
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  return `UTC${sign}${h}:${String(m % 60).padStart(2, '0')}`;
}
