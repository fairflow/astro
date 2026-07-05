import { BodyKey, normDeg } from '../ephemeris/types.js';
import type { Chart, ChartPosition } from '../chart/chart.js';
import type { Aspect } from '../chart/aspects.js';
import { ASPECT_COLOR, SIGN_ELEMENT } from './glyphs.js';

export interface WheelOptions {
  size?: number;
  /** Multiplies planet/sign glyph sizes (display setting). */
  glyphScale?: number;
  /** Minimum aspect-line opacity (raised in high-contrast mode). */
  opacityFloor?: number;
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
  }[];
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
}

export function aspectKey(a: Aspect): string {
  return `${a.a}|${a.def.name}|${a.b}`;
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
  const R = {
    zodOut: 348 * s, zodIn: 302 * s, planet: 262 * s,
    deg: 234 * s, houseNum: 150 * s, hub: 176 * s,
  };
  const glyphPx = 26 * s * glyphScale;
  const signGlyphPx = 27 * s * Math.min(glyphScale, 1.4);
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
    return {
      from: pt(c, R.hub), to: pt(c, R.zodIn), isAngle,
      label: isAngle
        ? { text: angleLabel[h]!, pos: pt(c, R.zodIn - 14 * s) }
        : undefined,
      num: h + 1, numPos: pt(mid, R.houseNum),
    };
  });

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

  return {
    size, cx, cy, rHub: R.hub, rZodiacOuter: R.zodOut,
    glyphPx, signGlyphPx,
    signs, ticks, cusps, planets, aspects,
  };
}
