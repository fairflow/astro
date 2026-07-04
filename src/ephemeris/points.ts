import { MakeTime } from 'astronomy-engine';
import { EclipticState, J2000_JD, normDeg } from './types.js';

/** Julian centuries of TT since J2000 for a UT Julian day (ΔT via astronomy-engine). */
function centuriesTT(jdUt: number): number {
  const t = MakeTime(jdUt - J2000_JD);
  return t.tt / 36525;
}

function polyState(jdUt: number, coeffs: number[]): EclipticState {
  const T = centuriesTT(jdUt);
  let lon = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) lon = lon * T + (coeffs[i] ?? 0);
  let dLon = 0; // d(lon)/dT
  for (let i = coeffs.length - 1; i >= 1; i--) dLon = dLon * T + i * (coeffs[i] ?? 0);
  return { lon: normDeg(lon), lat: 0, speed: dLon / 36525 };
}

/** Mean ascending lunar node (Meeus, Astronomical Algorithms ch. 47). */
export function meanNodeState(jdUt: number): EclipticState {
  return polyState(jdUt, [
    125.0445479, -1934.1362891, 0.0020754, 1 / 467441, -1 / 60616000,
  ]);
}

/**
 * Black Moon Lilith = mean lunar apogee: Meeus' mean perigee + 180°,
 * reduced from the lunar orbit plane to the ecliptic with the classical
 * -tan²(i/2)·sin(2(apogee-node)) term, which is what Swiss Ephemeris
 * publishes as SE_MEAN_APOG (agreement ≤0.006° over 1900-2100).
 */
const REDUCTION_DEG = 0.115696;

export function lilithState(jdUt: number): EclipticState {
  const apo = polyState(jdUt, [
    83.3532465 + 180, 4069.0137287, -0.01032, -1 / 80053, 1 / 18999000,
  ]);
  const node = meanNodeState(jdUt);
  const argDeg = 2 * (apo.lon - node.lon);
  const argRad = argDeg * Math.PI / 180;
  const lon = normDeg(apo.lon - REDUCTION_DEG * Math.sin(argRad));
  const dArg = 2 * (apo.speed - node.speed); // deg/day
  const speed = apo.speed
    - REDUCTION_DEG * Math.cos(argRad) * dArg * Math.PI / 180;
  return { lon, lat: 0, speed };
}
