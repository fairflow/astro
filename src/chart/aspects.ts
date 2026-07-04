import { BodyKey, EclipticState, degDiff } from '../ephemeris/types.js';

export type AspectName =
  | 'conjunction' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';

export type AspectClass = 'neutral' | 'flowing' | 'challenge' | 'adjusting';

export interface AspectDef {
  name: AspectName;
  angle: number;
  baseOrb: number;
  luminaryOrb: number;
  klass: AspectClass;
}

/** Standard modern orbs (DESIGN.md §3c); user-configurable in the app. */
export const DEFAULT_ASPECTS: AspectDef[] = [
  { name: 'conjunction', angle: 0, baseOrb: 8, luminaryOrb: 10, klass: 'neutral' },
  { name: 'sextile', angle: 60, baseOrb: 5, luminaryOrb: 6, klass: 'flowing' },
  { name: 'square', angle: 90, baseOrb: 7, luminaryOrb: 8, klass: 'challenge' },
  { name: 'trine', angle: 120, baseOrb: 8, luminaryOrb: 9, klass: 'flowing' },
  { name: 'quincunx', angle: 150, baseOrb: 2.5, luminaryOrb: 3, klass: 'adjusting' },
  { name: 'opposition', angle: 180, baseOrb: 8, luminaryOrb: 10, klass: 'challenge' },
];

export interface AspectOptions {
  defs?: AspectDef[];
  /** Cap applied when either body is an asteroid/point (default 3°). */
  minorBodyOrbCap?: number;
  luminaries?: Set<BodyKey>;
  minorBodies?: Set<BodyKey>;
}

export interface ChartPoint {
  body: BodyKey;
  state: EclipticState;
}

export interface Aspect {
  a: BodyKey;
  b: BodyKey;
  def: AspectDef;
  /** Unsigned deviation from exactness, degrees. */
  orb: number;
  maxOrb: number;
  /** True when the aspect is still tightening (uses both speeds). */
  applying: boolean;
  /** Salience in [0,1]-ish; drives display opacity and reading order. */
  weight: number;
}

const DEFAULT_LUMINARIES = new Set<BodyKey>(['sun', 'moon']);
const DEFAULT_MINOR = new Set<BodyKey>([
  'chiron', 'ceres', 'pallas', 'juno', 'vesta', 'eris', 'meanNode', 'lilith',
]);

export function findAspects(points: ChartPoint[], opts: AspectOptions = {}): Aspect[] {
  const defs = opts.defs ?? DEFAULT_ASPECTS;
  const lum = opts.luminaries ?? DEFAULT_LUMINARIES;
  const minor = opts.minorBodies ?? DEFAULT_MINOR;
  const cap = opts.minorBodyOrbCap ?? 3;
  const out: Aspect[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const P = points[i]!, Q = points[j]!;
      const sep = Math.abs(degDiff(P.state.lon, Q.state.lon));
      for (const def of defs) {
        const luminary = lum.has(P.body) || lum.has(Q.body);
        let maxOrb = luminary ? def.luminaryOrb : def.baseOrb;
        if (minor.has(P.body) || minor.has(Q.body)) maxOrb = Math.min(maxOrb, cap);
        const orb = Math.abs(sep - def.angle);
        if (orb > maxOrb) continue;

        // Applying if |separation - exact| is shrinking.
        const dSep = Math.sign(degDiff(P.state.lon, Q.state.lon))
          * (P.state.speed - Q.state.speed);
        const applying = (sep - def.angle) * dSep < 0;

        const wLum = (lum.has(P.body) ? 1.6 : 1) * (lum.has(Q.body) ? 1.6 : 1);
        out.push({
          a: P.body, b: Q.body, def, orb, maxOrb, applying,
          weight: (1 - orb / maxOrb) * wLum,
        });
      }
    }
  }
  return out.sort((x, y) => y.weight - x.weight);
}
