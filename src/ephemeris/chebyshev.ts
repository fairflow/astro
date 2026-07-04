import {
  BodyKey, EclipticState, EphemerisProvider, normDeg,
} from './types.js';

/**
 * Piecewise-Chebyshev ephemeris pack, produced by tools/make_packs.py from
 * JPL Horizons data (geocentric, mean-ecliptic-of-date, light-time corrected).
 * Longitude coefficients are fitted on the *unwrapped* longitude within each
 * segment, so evaluation is continuous inside a segment and normalised after.
 */
export interface ChebPack {
  body: BodyKey;
  source: string;
  frame: string;
  jdStart: number;       // segment 0 starts here (JD UT)
  segmentDays: number;
  count: number;         // number of segments
  degree: number;        // polynomial degree (coeff arrays have degree+1 entries)
  lon: number[][];
  lat: number[][];
  fitMaxErrDeg: number;  // max |residual| over the fitting grid, degrees
}

/** Clenshaw evaluation of a Chebyshev series at x in [-1, 1]. */
export function chebEval(c: number[], x: number): number {
  let b1 = 0, b2 = 0;
  for (let k = c.length - 1; k >= 1; k--) {
    const t = b1;
    b1 = 2 * x * b1 - b2 + (c[k] ?? 0);
    b2 = t;
  }
  return x * b1 - b2 + (c[0] ?? 0);
}

/** Coefficients of the derivative series (same convention as numpy chebder). */
export function chebDerCoeffs(c: number[]): number[] {
  const n = c.length - 1;
  if (n <= 0) return [0];
  const d = new Array<number>(n).fill(0);
  for (let j = n; j >= 1; j--) {
    d[j - 1] = (j + 1 < n ? (d[j + 1] ?? 0) : 0) + 2 * j * (c[j] ?? 0);
  }
  d[0] = (d[0] ?? 0) / 2;
  return d;
}

export class ChebProvider implements EphemerisProvider {
  private packs = new Map<BodyKey, ChebPack>();

  add(pack: ChebPack): void {
    this.packs.set(pack.body, pack);
  }

  available(body: BodyKey, jdUt: number): boolean {
    const p = this.packs.get(body);
    if (!p) return false;
    return jdUt >= p.jdStart && jdUt <= p.jdStart + p.count * p.segmentDays;
  }

  state(body: BodyKey, jdUt: number): EclipticState {
    const p = this.packs.get(body);
    if (!p || !this.available(body, jdUt)) {
      throw new RangeError(`no chebyshev pack coverage for ${body} at jd ${jdUt}`);
    }
    let seg = Math.floor((jdUt - p.jdStart) / p.segmentDays);
    if (seg === p.count) seg--; // exact end of coverage
    const t0 = p.jdStart + seg * p.segmentDays;
    const x = 2 * (jdUt - t0) / p.segmentDays - 1;
    const clon = p.lon[seg]!, clat = p.lat[seg]!;
    const lon = normDeg(chebEval(clon, x));
    const lat = chebEval(clat, x);
    // d/dx -> d/dday
    const speed = chebEval(chebDerCoeffs(clon), x) * 2 / p.segmentDays;
    return { lon, lat, speed };
  }
}

/**
 * Chain of providers; first one that covers the (body, jd) wins.
 * CoreProvider + ChebProvider is the app default; a Swiss Ephemeris
 * provider can be prepended by power users.
 */
export class ChainProvider implements EphemerisProvider {
  constructor(private providers: EphemerisProvider[]) {}

  available(body: BodyKey, jdUt: number): boolean {
    return this.providers.some(p => p.available(body, jdUt));
  }

  state(body: BodyKey, jdUt: number): EclipticState {
    for (const p of this.providers) {
      if (p.available(body, jdUt)) return p.state(body, jdUt);
    }
    throw new RangeError(`no provider covers ${body} at jd ${jdUt}`);
  }
}
