import { BodyKey, normDeg } from '../ephemeris/types.js';
import type { Chart, ChartPosition } from '../chart/chart.js';
import type { Aspect } from '../chart/aspects.js';
import {
  ASPECT_COLOR, BODY_GLYPH, SIGN_ELEMENT, SIGN_GLYPHS, VS,
} from './glyphs.js';

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
  signs: { glyph: string; element: string; pos: XY; from: XY; to: XY }[];
  ticks: { from: XY; to: XY; major: boolean }[];
  cusps: {
    from: XY; to: XY; isAngle: boolean;
    label?: { text: string; pos: XY };
    num: number; numPos: XY;
  }[];
  planets: {
    body: BodyKey; glyph: string; luminary: boolean; retro: boolean;
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

export function wheelGeometry(chart: Chart, size = 720): WheelGeometry {
  const cx = size / 2, cy = size / 2;
  const s = size / 720; // radii tuned at 720
  const R = {
    zodOut: 348 * s, zodIn: 302 * s, planet: 262 * s,
    deg: 238 * s, houseNum: 150 * s, hub: 176 * s,
  };
  const asc = chart.houses.asc;
  const pt = (lon: number, r: number): XY => {
    const d = (normDeg(lon) - asc) * Math.PI / 180;
    return { x: cx - r * Math.cos(d), y: cy + r * Math.sin(d) };
  };

  const signs = SIGN_GLYPHS.map((g, i) => ({
    glyph: g + VS,
    element: SIGN_ELEMENT[i]!,
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
  const displayLons = nudge(shown.map(p => p.lon), 8.2);
  const planets = shown.map((p, i) => ({
    body: p.body,
    glyph: BODY_GLYPH[p.body] + VS,
    luminary: LUMINARIES.has(p.body),
    retro: p.speed < 0,
    pos: pt(displayLons[i]!, R.planet),
    degText: `${Math.floor(normDeg(p.lon) % 30)}°`,
    degPos: pt(displayLons[i]!, R.deg),
    anchorFrom: pt(p.lon, R.hub),
    anchorTo: pt(p.lon, R.hub + 8 * s),
    leaderTo: pt(displayLons[i]!, R.planet - 15 * s),
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
      opacity: 0.25 + 0.75 * tight,
      width: a.orb < 2 ? 2.2 : 1.4,
      dashed: a.def.name === 'quincunx',
      partile: a.orb < 1,
    };
  });

  return {
    size, cx, cy, rHub: R.hub, rZodiacOuter: R.zodOut,
    signs, ticks, cusps, planets, aspects,
  };
}
