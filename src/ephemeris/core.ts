import {
  Body, GeoVector, MakeTime, RotateVector, Rotation_EQJ_ECT,
} from 'astronomy-engine';
import type { AstroTime } from 'astronomy-engine';
import {
  BodyKey, EclipticState, EphemerisProvider, J2000_JD, normDeg, degDiff,
} from './types.js';
import { meanNodeState, lilithState } from './points.js';

const AE_BODY: Partial<Record<BodyKey, Body>> = {
  sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus,
  mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
  uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
};

/** astronomy-engine validity window (Pluto model bounds the rest). */
const MIN_JD = J2000_JD - 300 * 365.25; // 1700
const MAX_JD = J2000_JD + 200 * 365.25; // 2200

export function timeFromJdUt(jdUt: number): AstroTime {
  return MakeTime(jdUt - J2000_JD);
}

/** Apparent geocentric ecliptic-of-date longitude/latitude, degrees. */
function eclipticOfDate(body: Body, time: AstroTime): { lon: number; lat: number } {
  const eqj = GeoVector(body, time, true); // aberration-corrected, J2000 equatorial
  const ect = RotateVector(Rotation_EQJ_ECT(time), eqj);
  const lon = normDeg(Math.atan2(ect.y, ect.x) * 180 / Math.PI);
  const lat = Math.atan2(ect.z, Math.hypot(ect.x, ect.y)) * 180 / Math.PI;
  return { lon, lat };
}

/**
 * Sun..Pluto from astronomy-engine (MIT, ±1 arcminute, 1700–2200),
 * plus the analytic points (mean Node, mean-apogee Lilith).
 * Asteroids live in the Chebyshev pack provider.
 */
export class CoreProvider implements EphemerisProvider {
  available(body: BodyKey, jdUt: number): boolean {
    if (body === 'meanNode' || body === 'lilith') return true;
    return body in AE_BODY && jdUt >= MIN_JD && jdUt <= MAX_JD;
  }

  state(body: BodyKey, jdUt: number): EclipticState {
    if (body === 'meanNode') return meanNodeState(jdUt);
    if (body === 'lilith') return lilithState(jdUt);
    const ae = AE_BODY[body];
    if (ae === undefined) {
      throw new RangeError(`CoreProvider does not supply '${body}'`);
    }
    if (!this.available(body, jdUt)) {
      throw new RangeError(`jd ${jdUt} outside CoreProvider coverage (1700-2200)`);
    }
    const { lon, lat } = eclipticOfDate(ae, timeFromJdUt(jdUt));
    // Speed by centred difference; dt small enough for the Moon, large
    // enough to stay clear of floating-point noise.
    const dt = 0.05;
    const a = eclipticOfDate(ae, timeFromJdUt(jdUt - dt));
    const b = eclipticOfDate(ae, timeFromJdUt(jdUt + dt));
    const speed = degDiff(b.lon, a.lon) / (2 * dt);
    return { lon, lat, speed };
  }
}
