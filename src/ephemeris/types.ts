/** Bodies the app knows about. */
export type BodyKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'
  | 'uranus' | 'neptune' | 'pluto'
  | 'chiron' | 'ceres' | 'pallas' | 'juno' | 'vesta' | 'eris'
  | 'meanNode' | 'lilith';

export const PLANETS: BodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
];
export const ASTEROIDS: BodyKey[] = ['chiron', 'ceres', 'pallas', 'juno', 'vesta', 'eris'];
export const POINTS: BodyKey[] = ['meanNode', 'lilith'];

/** Geocentric ecliptic-of-date state. Degrees; speed in degrees/day (negative = retrograde). */
export interface EclipticState {
  lon: number;
  lat: number;
  speed: number;
}

/**
 * A source of positions. jdUt is a Julian Day in Universal Time.
 * Implementations must throw RangeError when asked outside their coverage;
 * `available` lets callers check first.
 */
export interface EphemerisProvider {
  available(body: BodyKey, jdUt: number): boolean;
  state(body: BodyKey, jdUt: number): EclipticState;
}

export const J2000_JD = 2451545.0;

export function normDeg(d: number): number {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/** Smallest signed difference a-b in degrees, in (-180, 180]. */
export function degDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}
