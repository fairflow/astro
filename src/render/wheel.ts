import { BodyKey, normDeg } from '../ephemeris/types.js';
import type { Chart, ChartPosition } from '../chart/chart.js';
import type { Aspect } from '../chart/aspects.js';
import { ASPECT_COLOR, SIGN_ELEMENT } from './glyphs.js';

export interface OuterBody {
  body: BodyKey;
  lon: number;
  retro?: boolean;
}

/** Minimal shape shared by Aspect and CrossAspect for cross-lines. */
export interface CrossLike {
  a: BodyKey;
  b: BodyKey;
  def: Aspect['def'];
  orb: number;
  maxOrb: number;
}

export interface WheelOptions {
  size?: number;
  /** Multiplies planet/sign glyph sizes (display setting). */
  glyphScale?: number;
  /** Minimum aspect-line opacity (raised in high-contrast mode). */
  opacityFloor?: number;
  /**
   * Bi-wheel: a second chart's bodies drawn in an outer ring (Solar
   * Fire style) — transits or a synastry partner. Radii shrink to fit.
   */
  outer?: OuterBody[];
  /** Cross-aspects: outer body (a) to inner natal body (b). */
  crossAspects?: CrossLike[];
}

/**
 * Pure geometry for the natal wheel: everything the SVG template needs,
 * precomputed. Ascendant is fixed at the left (9 o'clock); zodiacal
 * longitude increases counter-clockwise.
 */

export interface XY { x: number; y: number }

export interface WheelGeometry {
  size: number;
  cx: number;
  cy: number;
  rHub: number;
  rZodiacOuter: number;
  /** Glyph edge length for planets and signs (already scaled). */
  glyphPx: number;
  signGlyphPx: number;
  signs: { index: number; element: string; pos: XY; from: XY; to: XY }[];
  ticks: { from: XY; to: XY; major: boolean }[];
  cusps: {
    from: XY; to: XY; isAngle: boolean;
    label?: { text: string; pos: XY };
    num: number; numPos: XY;
    degText: string; degPos: XY;
  }[];
  /** Shaded annulus sectors for alternate houses. */
  houseBands: { shaded: boolean; d: string }[];
  planets: {
    body: BodyKey; luminary: boolean; retro: boolean;
    pos: XY; degText: string; degPos: XY;
    anchorFrom: XY; anchorTo: XY; leaderTo: XY;
  }[];
  aspects: {
    aspect: Aspect; key: string; from: XY; to: XY;
    colorVar: string; opacity: number; width: number;
    dashed: boolean; partile: boolean;
  }[];
  /** Bi-wheel outer ring bodies (empty when no outer chart). */
  outer: {
    body: BodyKey; retro: boolean;
    pos: XY; tickFrom: XY; tickTo: XY; degText: string;
  }[];
  outerGlyphPx: number;
  /** Cross-aspect lines from outer bodies to inner positions. */
  crossLines: {
    index: number; from: XY; to: XY;
    colorVar: string; opacity: number;
  }[];
}

export function aspectKey(a: Aspect): string {
  return `${a.a}|${a.def.name}|${a.b}`;
}

/** Distance from point p to segment ab (for the aspect-click chooser). */
export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0
    : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const qx = a.x + t * dx, qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

const LUMINARIES = new Set<BodyKey>(['sun', 'moon']);

/** Spread crowded display longitudes to at least `minGap` apart. */
function nudge(lons: number[], minGap: number): number[] {
  const order = lons.map((lon, i) => ({ lon, i })).sort((a, b) => a.lon - b.lon);
  const d = order.map(o => o.lon);
  for (let pass = 0; pass < 4; pass++) {
    for (let k = 0; k < d.length; k++) {
      const next = (k + 1) % d.length;
      let gap = normDeg(d[next]! - d[k]!);
      if (gap === 0 && d.length > 1) gap = 360;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        d[k] = normDeg(d[k]! - push);
        d[next] = normDeg(d[next]! + push);
      }
    }
  }
  const out = new Array<number>(lons.length);
  order.forEach((o, k) => { out[o.i] = d[k]!; });
  return out;
}

export function wheelGeometry(chart: Chart, opts: WheelOptions = {}): WheelGeometry {
  const size = opts.size ?? 720;
  const glyphScale = opts.glyphScale ?? 1.25;
  const floor = opts.opacityFloor ?? 0.25;
  const cx = size / 2, cy = size / 2;
  const s = size / 720; // radii tuned at 720
  // Bi-wheel: shrink the natal wheel to make room for the outer ring.
  const k = opts.outer ? 0.855 : 1;
  const R = {
    zodOut: 348 * s * k, zodIn: 302 * s * k, planet: 262 * s * k,
    deg: 234 * s * k, houseNum: 150 * s * k, hub: 176 * s * k,
    outerRing: 332 * s,
  };
  const glyphPx = 26 * s * glyphScale * (opts.outer ? 0.92 : 1);
  const signGlyphPx = 27 * s * Math.min(glyphScale, 1.4) * k;
  const outerGlyphPx = 22 * s * glyphScale;
  const asc = chart.houses.asc;
  const pt = (lon: number, r: number): XY => {
    const d = (normDeg(lon) - asc) * Math.PI / 180;
    return { x: cx - r * Math.cos(d), y: cy + r * Math.sin(d) };
  };

  const signs = SIGN_ELEMENT.map((element, i) => ({
    index: i,
    element,
    pos: pt(i * 30 + 15, (R.zodOut + R.zodIn) / 2),
    from: pt(i * 30, R.zodIn),
    to: pt(i * 30, R.zodOut),
  }));

  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 10 === 0;
    ticks.push({ from: pt(d, R.zodIn), to: pt(d, R.zodIn + (major ? 10 : 6) * s), major });
  }

  const angleLabel: Record<number, string> = { 0: 'ASC', 3: 'IC', 6: 'DSC', 9: 'MC' };
  const cusps = chart.houses.cusps.map((c, h) => {
    const isAngle = h % 3 === 0;
    const next = chart.houses.cusps[(h + 1) % 12]!;
    const mid = c + normDeg(next - c) / 2;
    const within = normDeg(c) % 30;
    return {
      from: pt(c, R.hub), to: pt(c, R.zodIn), isAngle,
      label: isAngle
        ? { text: angleLabel[h]!, pos: pt(c, R.zodIn - 14 * s) }
        : undefined,
      num: h + 1, numPos: pt(mid, R.houseNum),
      // cusp degree within its sign, shown near the zodiac band (F4)
      degText: `${Math.floor(within)}°`,
      degPos: pt(c + 3.5, R.zodIn - 12 * s),
    };
  });

  // Alternate-house shading between hub and zodiac band (F4): annulus
  // sector per even house. Longitudes increase counter-clockwise on
  // screen, so the outer arc runs sweep=0 from cusp to next cusp.
  const houseBands = chart.houses.cusps.map((c, h) => {
    const next = chart.houses.cusps[(h + 1) % 12]!;
    const span = normDeg(next - c);
    const large = span > 180 ? 1 : 0;
    const p1 = pt(c, R.hub), p2 = pt(next, R.hub);
    const q1 = pt(c, R.zodIn), q2 = pt(next, R.zodIn);
    return {
      shaded: h % 2 === 1,
      d: `M ${p1.x} ${p1.y} A ${R.hub} ${R.hub} 0 ${large} 0 ${p2.x} ${p2.y} `
        + `L ${q2.x} ${q2.y} A ${R.zodIn} ${R.zodIn} 0 ${large} 1 ${q1.x} ${q1.y} Z`,
    };
  }).filter(b => b.shaded);

  const shown: ChartPosition[] = chart.positions;
  const displayLons = nudge(shown.map(p => p.lon), 6.8 + 2.6 * glyphScale);
  const planets = shown.map((p, i) => ({
    body: p.body,
    luminary: LUMINARIES.has(p.body),
    retro: p.speed < 0,
    pos: pt(displayLons[i]!, R.planet),
    degText: `${Math.floor(normDeg(p.lon) % 30)}°`,
    degPos: pt(displayLons[i]!, R.deg - glyphPx / 2),
    anchorFrom: pt(p.lon, R.hub),
    anchorTo: pt(p.lon, R.hub + 8 * s),
    leaderTo: pt(displayLons[i]!, R.planet - glyphPx / 2 - 4 * s),
  }));

  const aspects = chart.aspects.map(a => {
    const pa = shown.find(p => p.body === a.a)!;
    const pb = shown.find(p => p.body === a.b)!;
    const tight = 1 - a.orb / a.maxOrb;
    return {
      aspect: a,
      key: aspectKey(a),
      from: pt(pa.lon, R.hub),
      to: pt(pb.lon, R.hub),
      colorVar: ASPECT_COLOR[a.def.name],
      opacity: floor + (1 - floor) * tight,
      width: a.orb < 2 ? 2.2 : 1.4,
      dashed: a.def.name === 'quincunx',
      partile: a.orb < 1,
    };
  });

  // Bi-wheel outer ring + cross-aspect lines
  const outerBodies = opts.outer ?? [];
  const outerLons = nudge(outerBodies.map(o => o.lon), 5.5 + 1.5 * glyphScale);
  const outer = outerBodies.map((o, i) => ({
    body: o.body,
    retro: o.retro ?? false,
    pos: pt(outerLons[i]!, R.outerRing),
    tickFrom: pt(o.lon, R.zodOut),
    tickTo: pt(o.lon, R.zodOut + 7 * s),
    degText: `${Math.floor(normDeg(o.lon) % 30)}°`,
  }));

  const crossLines = (opts.crossAspects ?? []).map((x, index) => {
    const from = outerBodies.find(o => o.body === x.a);
    const to = shown.find(p => p.body === x.b);
    if (!from || !to) return null;
    const tight = 1 - x.orb / x.maxOrb;
    return {
      index,
      from: pt(from.lon, R.zodOut + 2 * s),
      to: pt(to.lon, R.hub),
      colorVar: ASPECT_COLOR[x.def.name],
      opacity: floor + (1 - floor) * tight,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    size, cx, cy, rHub: R.hub, rZodiacOuter: R.zodOut,
    glyphPx, signGlyphPx, outerGlyphPx,
    signs, ticks, cusps, houseBands, planets, aspects, outer, crossLines,
  };
}
