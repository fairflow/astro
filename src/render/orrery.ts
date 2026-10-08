import {
  findStations, geometricLon, helioXY, inferiorConjunctions, superiorConjunctions, PRECESSION_PER_DAY,
  SIDEREAL_DAYS, synodicDays, type InnerPlanet, type OrreryBody, type Station,
} from '../chart/retrograde.js';
import { J2000_JD, degDiff, normDeg, type EphemerisProvider } from '../ephemeris/types.js';
import { BODY_GLYPHS, SIGN_GLYPHS_SVG, type GlyphDef, type GlyphStyle } from './glyphset.js';

/**
 * Canvas orrery for the Retrograde tab: Mercury, Venus and Earth seen from
 * above the north ecliptic pole inside a zodiac "celestial sphere", each
 * inner planet's apparent track drawn as a time spiral, and a strip chart
 * of apparent longitude against time.
 *
 * Positions come from an OrreryModel: the app's ephemeris (true orbits,
 * stations exact to the provider) or an idealised circular model for
 * teaching. Time is jdUt throughout.
 */

export const INNER: InnerPlanet[] = ['mercury', 'venus'];

export interface OrreryModel {
  readonly kind: 'ephemeris' | 'circular';
  /** Heliocentric position in the ecliptic plane, AU. */
  pos(b: OrreryBody, jd: number): [number, number];
  /** Geocentric longitude used for drawing (deg, equinox of date). */
  geoLon(b: InnerPlanet, jd: number): number;
  /** Apparent motion used for drawing, deg/day. */
  rate(b: InnerPlanet, jd: number): number;
  /** The Sun's geocentric longitude (deg). */
  sunLon(jd: number): number;
  /** Stations within at least ±600 days of jd. */
  stations(b: InnerPlanet, jd: number): Station[];
  /** Inferior conjunctions covering at least [jd − 10 synodic periods, jd + 1 synodic period]. */
  conjunctions(b: InnerPlanet, jd: number): number[];
  /** Superior conjunctions, same coverage. */
  superiorConjunctions(b: InnerPlanet, jd: number): number[];
  /** Orbit outline, AU. */
  orbit(b: OrreryBody, jd: number): [number, number][];
}

// ---------- models ----------

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/** Idealised: circular, coplanar orbits at mean distance and mean motion. */
export function circularModel(): OrreryModel {
  const A: Record<OrreryBody, number> = { mercury: 0.387098, venus: 0.723332, earth: 1 };
  const L0: Record<OrreryBody, number> = { mercury: 252.25084, venus: 181.97973, earth: 100.46435 };
  const L = (b: OrreryBody, jd: number) => L0[b] + 360 * (jd - J2000_JD) / SIDEREAL_DAYS[b];
  const pos = (b: OrreryBody, jd: number): [number, number] =>
    [A[b] * Math.cos(L(b, jd) * D2R), A[b] * Math.sin(L(b, jd) * D2R)];
  const geoLon = (b: InnerPlanet, jd: number) => {
    const p = pos(b, jd), e = pos('earth', jd);
    return normDeg(Math.atan2(p[1] - e[1], p[0] - e[0]) * R2D);
  };
  const rate = (b: InnerPlanet, jd: number) => {
    const p = pos(b, jd), e = pos('earth', jd);
    const n = (x: OrreryBody) => 2 * Math.PI / SIDEREAL_DAYS[x];
    const vp = [-n(b) * p[1], n(b) * p[0]], ve = [-n('earth') * e[1], n('earth') * e[0]];
    const dx = p[0] - e[0], dy = p[1] - e[1], vx = vp[0]! - ve[0]!, vy = vp[1]! - ve[1]!;
    return (dx * vy - dy * vx) / (dx * dx + dy * dy) * R2D;
  };
  const cache = new Map<InnerPlanet, { from: number; to: number; list: Station[] }>();
  const stations = (b: InnerPlanet, jd: number) => {
    let c = cache.get(b);
    if (!c || jd < c.from + 600 || jd > c.to - 600) {
      const from = jd - 2000, to = jd + 2000, list: Station[] = [];
      let ta = from, ra = rate(b, ta);
      for (let tb = from + 0.5; tb <= to; tb += 0.5) {
        const rb = rate(b, tb);
        if ((ra > 0) !== (rb > 0)) {
          let lo = ta, hi = tb;
          while (hi - lo > 1e-5) { const m = (lo + hi) / 2; if ((rate(b, m) > 0) === (ra > 0)) lo = m; else hi = m; }
          const t = (lo + hi) / 2;
          list.push({ kind: ra > 0 ? 'SR' : 'SD', jdUt: t, lon: geoLon(b, t) });
        }
        ta = tb; ra = rb;
      }
      c = { from, to, list }; cache.set(b, c);
    }
    return c.list;
  };
  // phase 0: inferior conjunction (same heliocentric longitude); 0.5: superior
  const phased = (b: InnerPlanet, jd: number, phase: number) => {
    const S = synodicDays(b), k0 = Math.floor(((L(b, jd) - L('earth', jd)) / 360));
    const out: number[] = [];
    for (let k = k0 - 11; k <= k0 + 1; k++) {
      out.push(J2000_JD + ((k + phase) * 360 - (L0[b] - L0.earth)) * S / 360);
    }
    return out;
  };
  return {
    kind: 'circular', pos, geoLon, rate, stations,
    conjunctions: (b, jd) => phased(b, jd, 0),
    superiorConjunctions: (b, jd) => phased(b, jd, 0.5),
    sunLon: jd => normDeg(L('earth', jd) + 180),
    orbit: b => Array.from({ length: 181 }, (_, i) =>
      [A[b] * Math.cos(i * 2 * D2R), A[b] * Math.sin(i * 2 * D2R)] as [number, number]),
  };
}

/**
 * The app's ephemeris: astronomy-engine heliocentric vectors for drawing
 * (cached on a fixed time grid so animation frames reuse them), and the
 * provider's apparent positions for stations, so they match the chart.
 */
export function ephemerisModel(provider: EphemerisProvider): OrreryModel {
  const GRID = 0.25;
  const lonCache = new Map<string, number>();
  const gridLon = (b: InnerPlanet, i: number) => {
    const key = b.charAt(0) + i;
    let v = lonCache.get(key);
    if (v === undefined) {
      if (lonCache.size > 400000) lonCache.clear();
      v = geometricLon(b, i * GRID); lonCache.set(key, v);
    }
    return v;
  };
  const geoLon = (b: InnerPlanet, jd: number) => {
    const i = Math.floor(jd / GRID), f = jd / GRID - i, a = gridLon(b, i);
    return normDeg(a + f * degDiff(gridLon(b, i + 1), a));
  };
  const rate = (b: InnerPlanet, jd: number) => {
    const i = Math.round(jd / GRID);
    return degDiff(gridLon(b, i + 1), gridLon(b, i - 1)) / (2 * GRID);
  };
  const st = new Map<InnerPlanet, { from: number; to: number; list: Station[] }>();
  const stations = (b: InnerPlanet, jd: number) => {
    let c = st.get(b);
    if (!c || jd < c.from + 600 || jd > c.to - 600) {
      const from = jd - 1200, to = jd + 1200;
      const lo = Math.max(from, J2000_JD - 300 * 365.25), hi = Math.min(to, J2000_JD + 200 * 365.25);
      c = { from, to, list: lo < hi ? findStations(provider, b, lo, hi) : [] };
      st.set(b, c);
    }
    return c.list;
  };
  const cj = new Map<string, { from: number; to: number; list: number[] }>();
  const cached = (kind: 'inf' | 'sup', b: InnerPlanet, jd: number) => {
    const S = synodicDays(b), key = kind + b;
    let c = cj.get(key);
    if (!c || jd < c.from + 10.5 * S || jd > c.to - S) {
      const from = jd - 13 * S, to = jd + 3 * S;
      c = { from, to, list: (kind === 'inf' ? inferiorConjunctions : superiorConjunctions)(b, from, to) };
      cj.set(key, c);
    }
    return c.list;
  };
  const orbits = new Map<string, [number, number][]>();
  return {
    kind: 'ephemeris', geoLon, rate, stations,
    conjunctions: (b, jd) => cached('inf', b, jd),
    superiorConjunctions: (b, jd) => cached('sup', b, jd),
    pos: (b, jd) => helioXY(b, jd),
    sunLon: jd => {
      const e = helioXY('earth', jd);
      return normDeg(Math.atan2(e[1], e[0]) * R2D + 180 + PRECESSION_PER_DAY * (jd - J2000_JD));
    },
    orbit: (b, jd) => {
      // one sidereal period of real positions centred on jd (refreshed monthly)
      const k = `${b}${Math.round(jd / 30)}`;
      let o = orbits.get(k);
      if (!o) {
        if (orbits.size > 60) orbits.clear();
        const P = SIDEREAL_DAYS[b], t0 = Math.round(jd / 30) * 30 - P / 2;
        o = Array.from({ length: 241 }, (_, i) => helioXY(b, t0 + P * i / 240));
        orbits.set(k, o);
      }
      return o;
    },
  };
}

// ---------- drawing ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateOfJd = (jd: number) => new Date((jd - 2440587.5) * 86400000);

export const PALETTE = {
  night: '#05080f', sky: '#0a1020', brass: '#d6b46e', retro: '#ff6f7f', direct: '#7fe0a8',
  mercury: '#a8dcec', venus: '#f4c98c', earth: '#7aa9ff', ink: '#e2e8f4', muted: '#8b98b4',
  superior: '#c39bff',
};
const COLOR: Record<OrreryBody, string> = {
  mercury: PALETTE.mercury, venus: PALETTE.venus, earth: PALETTE.earth,
};
const EARTH_GLYPH: GlyphDef = { d: 'M50 18 A32 32 0 1 1 49.9 18 Z M50 18 V82 M18 50 H82' };
const GLYPH: Record<OrreryBody, GlyphDef> = {
  mercury: BODY_GLYPHS.mercury, venus: BODY_GLYPHS.venus, earth: EARTH_GLYPH,
};
/**
 * The celestial sphere is a ring centred on Earth (geocentric longitude is
 * a direction from Earth, so a sight line from Earth meets the ring exactly
 * at the planet's apparent longitude). Radii in AU from Earth; the ring
 * must clear every orbit wherever Earth is (the far side of Earth's own
 * orbit is 2.03 AU away).
 */
const R_IN = 2.06, R_BAND_IN = 2.40, R_BAND_OUT = 2.62, R_EDGE = 2.68;
/**
 * Sun-centred view: the same ring drawn round the Sun instead, scaled so
 * its edge is 1.56 AU out (clear of Earth's orbit). Ring radii above are
 * then ring units, not AU; a sight line from Earth meets this ring a few
 * degrees from the planet's true longitude, because the drawn sphere is
 * not at infinity.
 */
const SUN_RING_EDGE_AU = 1.56;
/** Track lanes inside the ring, [inner, outer]. */
const LANE: Record<InnerPlanet, [number, number]> = { mercury: [2.075, 2.20], venus: [2.215, 2.34] };
/** Where the Sun-centred ecliptic ring used to be: now a plain circle round the Sun. */
const OLD_ECLIPTIC = 1.385;
const CONJ_SHOWN: Record<InnerPlanet, number> = { mercury: 3, venus: 5 };
// Bright stars near the ecliptic, J2000 longitudes.
const STARS: [string, number][] = [
  ['Aldebaran', 69.8], ['Pollux', 113.2], ['Regulus', 149.8], ['Spica', 203.8], ['Antares', 249.8],
];

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const pathCache = new Map<string, Path2D>();
/** Draws one of the app's stroke glyphs centred on (x, y), `size` px tall. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D, def: GlyphDef, x: number, y: number, size: number,
  color: string, style: GlyphStyle, halo = true,
) {
  let p = pathCache.get(def.d);
  if (!p) { p = new Path2D(def.d); pathCache.set(def.d, p); }
  const s = size / 100;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2); ctx.scale(s, s);
  if (style.slant) { ctx.translate(50, 50); ctx.transform(1, 0, -Math.tan(style.slant * D2R), 1, 0, 0); ctx.translate(-50, -50); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (halo) { ctx.strokeStyle = rgba(PALETTE.night, .85); ctx.lineWidth = style.weight + 14; ctx.stroke(p); }
  ctx.strokeStyle = color; ctx.lineWidth = style.weight; ctx.stroke(p);
  ctx.fillStyle = color;
  for (const [cx, cy, r] of def.dots ?? []) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
  ctx.restore();
}

export interface Pulse { at: number; xy: [number, number]; color: string; label: string; earth?: [number, number] }

export interface PlateState {
  jd: number;
  jdStart: number;
  show: Record<InnerPlanet, boolean>;
  sight: boolean;
  /** Inferior-conjunction figures (orbits, and the Venus pentagram on the zodiac). */
  inferior: boolean;
  /** Superior-conjunction figures, in their own colour. */
  superior: boolean;
  /** Venus's conjunctions seen from the Sun: the two stars interleave as a decagram. */
  decagram: boolean;
  /** Keep Earth (and so the zodiac) still, or the Sun. */
  view: 'earth' | 'sun';
  pulses: Pulse[];
  glyphStyle: GlyphStyle;
  /** Optional chart moment to mark (natal date) as a ring on Earth's orbit. */
  markJd?: number | null;
}

type XYp = [number, number];

export class OrreryPlate {
  private W = 600; private dpr = 1;
  /** px per AU (orbits) and px per ring unit (the zodiac ring and its lanes). */
  private Rpx = 100; private U = 100;
  /** Screen positions of the Sun (heliocentric origin) and of Earth (centre of the zodiac). */
  private O: XYp = [300, 300];
  private Z: XYp = [300, 300];
  private view: 'earth' | 'sun' = 'earth';
  private back: HTMLCanvasElement | null = null;
  private ring: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement, private font: string) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssWidth: number, dpr: number) {
    this.W = Math.max(280, Math.floor(cssWidth)); this.dpr = Math.min(2, dpr || 1);
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.W * this.dpr;
    this.setScale();
  }
  private setScale() {
    this.U = this.W / 2 / (R_EDGE + .04);
    this.Rpx = this.view === 'earth' ? this.U : this.W / 2 / (SUN_RING_EDGE_AU + .03);
    this.back = null; this.ring = null;
  }

  /** Polar about Earth (the zodiac): r in px, longitude in degrees. */
  private P(r: number, lon: number): XYp {
    return [this.Z[0] + r * Math.cos(lon * D2R), this.Z[1] - r * Math.sin(lon * D2R)];
  }
  /** Polar about the Sun. */
  private S(r: number, lon: number): XYp {
    return [this.O[0] + r * Math.cos(lon * D2R), this.O[1] - r * Math.sin(lon * D2R)];
  }
  /** Heliocentric AU → screen. */
  private XY(v: XYp): XYp {
    return [this.O[0] + v[0] * this.Rpx, this.O[1] - v[1] * this.Rpx];
  }

  private buildBack() {
    const { W } = this;
    const off = document.createElement('canvas'); off.width = W * this.dpr; off.height = W * this.dpr;
    const g = off.getContext('2d')!; g.scale(this.dpr, this.dpr);
    g.fillStyle = PALETTE.night; g.fillRect(0, 0, W, W);
    const rand = rng(11);
    for (let i = 0; i < 420; i++) {
      const x = rand() * W, y = rand() * W, m = rand(), s = m > .93 ? 1.4 : .8;
      g.fillStyle = `rgba(200,212,240,${.08 + .25 * m * m})`; g.fillRect(x, y, s, s);
    }
    this.back = off;
  }

  /** The zodiac ring with its stars, drawn once and placed on Earth each frame. */
  private buildRing(style: GlyphStyle) {
    const Rpx = this.U, k = Rpx * 1.7; // ring-proportional unit for text and ticks
    const D = Math.ceil(2 * (R_EDGE + .02) * Rpx), h = D / 2;
    const off = document.createElement('canvas'); off.width = D * this.dpr; off.height = D * this.dpr;
    const g = off.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const Q = (r: number, lon: number): XYp => [h + r * Math.cos(lon * D2R), h - r * Math.sin(lon * D2R)];
    let gr = g.createRadialGradient(h, h, 0, h, h, Rpx * R_EDGE);
    gr.addColorStop(0, 'rgba(40,52,90,.30)'); gr.addColorStop(.7, 'rgba(16,22,44,.18)'); gr.addColorStop(1, 'rgba(5,8,15,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(h, h, R_EDGE * Rpx, 0, 7); g.fill();
    const rand = rng(7);
    g.save(); g.beginPath(); g.arc(h, h, R_EDGE * Rpx, 0, 2 * Math.PI); g.arc(h, h, R_IN * Rpx, 0, 2 * Math.PI, true); g.clip();
    gr = g.createRadialGradient(h, h, R_IN * Rpx, h, h, R_EDGE * Rpx);
    gr.addColorStop(0, 'rgba(22,32,62,.15)'); gr.addColorStop(.55, 'rgba(26,38,72,.55)'); gr.addColorStop(1, 'rgba(14,20,40,.9)');
    g.fillStyle = gr; g.fillRect(0, 0, D, D);
    // Milky Way: the galactic plane crosses the ecliptic near 266° (Sagittarius) and 86° (Gemini/Taurus)
    const mw = (l: number) => {
      const d1 = Math.abs(((l - 266 + 540) % 360) - 180), d2 = Math.abs(((l - 86 + 540) % 360) - 180);
      return Math.exp(-(d1 * d1) / 512) + .55 * Math.exp(-(d2 * d2) / 392);
    };
    for (let i = 0; i < 2600; i++) {
      const l = rand() * 360;
      if (rand() > .18 + .82 * mw(l)) continue;
      const [x, y] = Q((R_IN + rand() * (R_EDGE - R_IN)) * Rpx, l);
      g.fillStyle = `rgba(190,200,235,${.05 + .12 * rand()})`; g.beginPath(); g.arc(x, y, 1.6 + rand() * 3.5, 0, 7); g.fill();
    }
    for (let i = 0; i < 1100; i++) {
      const l = rand() * 360, [x, y] = Q((R_IN + rand() * (R_EDGE - R_IN)) * Rpx, l), m = rand();
      g.fillStyle = rand() < .25 ? `rgba(255,214,170,${.25 + .6 * m * m})` : `rgba(210,224,255,${.2 + .7 * m * m})`;
      const s = m > .96 ? 1.8 : m > .8 ? 1.2 : .7; g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    g.restore();
    g.strokeStyle = rgba(PALETTE.brass, .55); g.lineWidth = 1;
    for (const r of [R_BAND_IN, R_BAND_OUT]) { g.beginPath(); g.arc(h, h, r * Rpx, 0, 2 * Math.PI); g.stroke(); }
    g.strokeStyle = rgba(PALETTE.brass, .18);
    for (const r of [R_IN, R_EDGE]) { g.beginPath(); g.arc(h, h, r * Rpx, 0, 2 * Math.PI); g.stroke(); }
    for (let d = 0; d < 360; d++) {
      const len = (d % 10 === 0 ? .03 : d % 5 === 0 ? .02 : .01) * k;
      const a = Q(R_BAND_IN * Rpx, d), b = Q(R_BAND_IN * Rpx + len, d);
      g.strokeStyle = rgba(PALETTE.brass, d % 30 === 0 ? .9 : d % 10 === 0 ? .6 : .35); g.lineWidth = d % 30 === 0 ? 1.2 : .8;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    const gs = Math.max(13, k * .085);
    for (let s = 0; s < 12; s++) {
      const a = Q(R_BAND_IN * Rpx, s * 30), b = Q(R_BAND_OUT * Rpx, s * 30);
      g.strokeStyle = rgba(PALETTE.brass, .5); g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      const [gx, gy] = Q((R_BAND_IN + R_BAND_OUT) / 2 * Rpx + 2, s * 30 + 15);
      drawGlyph(g, SIGN_GLYPHS_SVG[s]!, gx, gy, gs, rgba(PALETTE.brass, .95), style, false);
    }
    g.font = `${Math.max(8, k * .032)}px ${this.font}`; g.fillStyle = rgba(PALETTE.brass, .55);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 10; d < 360; d += 10) {
      if (d % 30 === 0) continue;
      const [x, y] = Q(R_BAND_IN * Rpx + .05 * k, d); g.fillText(String(d % 30), x, y);
    }
    const rs = R_BAND_IN * Rpx - .017 * k;
    for (const [name, l] of STARS) {
      const [x, y] = Q(rs, l);
      const gl = g.createRadialGradient(x, y, 0, x, y, 6);
      gl.addColorStop(0, 'rgba(255,248,230,.95)'); gl.addColorStop(1, 'rgba(255,248,230,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill();
      const [lx, ly] = Q(rs, l + 2.2), lower = Math.sin(l * D2R) < 0;
      g.save(); g.translate(lx, ly); g.rotate(-(l + 2.2) * D2R - Math.PI / 2 + (lower ? Math.PI : 0));
      g.font = `${Math.max(8, k * .028)}px ${this.font}`; g.fillStyle = 'rgba(235,228,210,.6)';
      g.textAlign = lower ? 'right' : 'left'; g.fillText(name, 0, 0); g.restore();
    }
    this.ring = off;
  }

  private line(a: XYp, b: XYp, color: string, w = 1, dash: number[] = []) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w; c.setLineDash(dash);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
  }
  private disc(x: number, y: number, r: number, fill: string | null, stroke?: string) {
    const c = this.ctx;
    c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
  }
  private text(t: string, x: number, y: number, color: string, font: string) {
    const c = this.ctx;
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3.5; c.strokeStyle = rgba(PALETTE.night, .85); c.lineJoin = 'round'; c.strokeText(t, x, y);
    c.fillStyle = color; c.fillText(t, x, y);
  }
  /** Where a ray from `from` (AU, heliocentric) towards `lon` meets the zodiac circle of radius R (AU) round `E`. */
  private static ray(from: XYp, E: XYp, lon: number, R: number): XYp {
    const o = [from[0] - E[0], from[1] - E[1]], u = [Math.cos(lon * D2R), Math.sin(lon * D2R)];
    const ou = o[0]! * u[0]! + o[1]! * u[1]!;
    const s = -ou + Math.sqrt(Math.max(0, ou * ou - (o[0]! * o[0]! + o[1]! * o[1]!) + R * R));
    return [from[0] + s * u[0]!, from[1] + s * u[1]!];
  }
  private path(pts: XYp[], color: string, w: number, close = false) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w; c.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.XY(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    if (close) c.closePath();
    c.stroke();
  }

  /**
   * A Venus pentagram against the zodiac: the geocentric longitude of each
   * conjunction, joined in time order. Five synodic periods are 7.99 years,
   * so each new star sits about 2.4° behind the last; the previous star is
   * drawn faintly to show that slow turn. A hollow marker shows where the
   * next conjunction will fall.
   */
  private pentagram(m: OrreryModel, t: number, all: number[], col: string, inside: boolean) {
    const c = this.ctx, R = R_BAND_IN * this.U - 2, k = this.U * 1.7;
    const past = all.filter(j => j <= t).slice(-10), next = all.find(j => j > t);
    const pts = past.map(j => ({ j, xy: this.P(R, m.geoLon('venus', j)) }));
    const font = `500 ${Math.max(9, k * .034)}px ${this.font}`;
    // inferior-conjunction dates sit inside the ring, superior ones a little further in
    const lab = (lon: number) => this.P(R - (inside ? 20 : 42), lon);
    c.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const recent = i >= pts.length - 5; // the latest five chords: a complete star
      const a = pts[i - 1]!.xy, b = pts[i]!.xy;
      c.strokeStyle = rgba(col, recent ? .75 : .16); c.lineWidth = recent ? 1.6 : 1;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    if (next !== undefined && pts.length) {
      const lon = m.geoLon('venus', next), b = this.P(R, lon);
      this.disc(b[0], b[1], 5, null, rgba(col, .8));
      const [lx, ly] = lab(lon), d = dateOfJd(next);
      this.text(`next ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, lx, ly, rgba(col, .6), font);
    }
    pts.forEach((p, i) => {
      const recent = i >= pts.length - 5;
      this.disc(p.xy[0], p.xy[1], recent ? 4.5 : 3, recent ? col : rgba(col, .35), PALETTE.night);
      if (recent) {
        const [lx, ly] = lab(m.geoLon('venus', p.j)), d = dateOfJd(p.j);
        this.text(`${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, lx, ly, rgba(col, .85), font);
      }
    });
  }

  /**
   * One of Venus's conjunction stars as seen from the Sun: Venus's place on
   * its orbit at each conjunction, joined in time order. Inferior and
   * superior stars are 180° apart in heliocentric longitude relative to
   * their geocentric ones, so here they interleave 36° apart: a decagram.
   */
  private helioStar(m: OrreryModel, t: number, all: number[], col: string) {
    const c = this.ctx;
    const past = all.filter(j => j <= t).slice(-10), next = all.find(j => j > t);
    const pts = past.map(j => this.XY(m.pos('venus', j)));
    c.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const recent = i >= pts.length - 5, a = pts[i - 1]!, b = pts[i]!;
      c.strokeStyle = rgba(col, recent ? .75 : .16); c.lineWidth = recent ? 1.5 : 1;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    pts.forEach((p, i) => {
      const recent = i >= pts.length - 5;
      this.disc(p[0], p[1], recent ? 3.6 : 2.4, recent ? col : rgba(col, .35), PALETTE.night);
    });
    if (next !== undefined) { const [x, y] = this.XY(m.pos('venus', next)); this.disc(x, y, 4.5, null, rgba(col, .8)); }
  }

  /** Conjunction points on a planet's orbit, joined in time order (heliocentric figure). */
  private orbitFigure(m: OrreryModel, b: InnerPlanet, t: number, all: number[], col: string) {
    const past = all.filter(j => j <= t).slice(-CONJ_SHOWN[b]), next = all.find(j => j > t);
    this.path(past.map(j => m.pos(b, j)), rgba(col, .22), 1);
    for (const j of past) { const [x, y] = this.XY(m.pos(b, j)); this.disc(x, y, 2.4, rgba(col, .6)); }
    if (next !== undefined) {
      const [x, y] = this.XY(m.pos(b, next));
      this.disc(x, y, 4, null, rgba(col, .5));
    }
  }

  draw(m: OrreryModel, s: PlateState, now: number) {
    const c = this.ctx, t = s.jd;
    if (s.view !== this.view) { this.view = s.view; this.setScale(); }
    const { Rpx, U, W } = this;
    if (!this.back) this.buildBack();
    if (!this.ring) this.buildRing(s.glyphStyle);
    const E = m.pos('earth', t), C = s.view === 'earth' ? E : [0, 0] as XYp;
    this.O = [W / 2 - C[0] * Rpx, W / 2 + C[1] * Rpx];
    // the zodiac's centre: Earth, or the Sun in the Sun-centred view
    const ringC: XYp = s.view === 'earth' ? E : [0, 0], toAU = U / Rpx;
    this.Z = this.XY(ringC);
    const { O, Z } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.back!, 0, 0, W, W);
    const D = this.ring!.width / this.dpr;
    c.drawImage(this.ring!, Z[0] - D / 2, Z[1] - D / 2, D, D);
    const gsz = Math.max(14, Math.min(22, U * .14));
    const vis = INNER.filter(b => s.show[b]);
    const helioLon = (b: OrreryBody, jd: number) => { const p = m.pos(b, jd); return Math.atan2(p[1], p[0]) * R2D; };

    // a plain circle round the Sun where the Sun-centred ecliptic used to be
    if (s.view === 'earth') {
      c.strokeStyle = rgba(PALETTE.brass, .3); c.lineWidth = 1;
      c.beginPath(); c.arc(O[0], O[1], OLD_ECLIPTIC * Rpx, 0, 2 * Math.PI); c.stroke();
    }

    for (const b of [...INNER, 'earth'] as OrreryBody[]) {
      const on = b === 'earth' || s.show[b as InnerPlanet];
      this.path(m.orbit(b, t), rgba(COLOR[b], on ? .38 : .1), 1, m.kind === 'circular');
    }
    // Sun–Earth line across the zodiac: the synodic reference, and where the Sun appears from Earth
    const sunLon = m.sunLon(t);
    this.line(this.P(R_IN * U, sunLon + 180), this.P(R_IN * U, sunLon), rgba(PALETTE.brass, .28));
    if (s.markJd != null) {
      const [x, y] = this.XY(m.pos('earth', s.markJd));
      this.disc(x, y, 7, null, rgba(PALETTE.ink, .7));
      this.text('chart', x, y - 14, rgba(PALETTE.ink, .7), `500 11px ${this.font}`);
    }

    for (const b of vis) {
      // sidereal reference: where the planet was when the counters started, fixed against the stars
      const l0 = helioLon(b, s.jdStart);
      this.line(O, this.S(OLD_ECLIPTIC * Rpx, l0), rgba(COLOR[b], .22), 1);
      const [mx, my] = this.XY(m.pos(b, s.jdStart)); this.disc(mx, my, 3, null, rgba(COLOR[b], .55));

      // Mercury's faint figures on its orbit; Venus's heliocentric figures are the decagram below
      if (b === 'mercury' && s.inferior) this.orbitFigure(m, b, t, m.conjunctions(b, t), COLOR[b]);
      if (b === 'mercury' && s.superior) this.orbitFigure(m, b, t, m.superiorConjunctions(b, t), PALETTE.superior);

      // the retrograde period nearest now: stretches of both orbits, frozen sight lines at each station
      const ep = nearestPeriod(m.stations(b, t), t);
      if (ep) {
        const span = (body: OrreryBody) => Array.from({ length: 49 }, (_, i) =>
          m.pos(body, ep.sr.jdUt + (ep.sd.jdUt - ep.sr.jdUt) * i / 48));
        this.path(span(b), rgba(PALETTE.retro, .55), 3);
        this.path(span('earth'), rgba(PALETTE.retro, .4), 3);
        for (const st of [ep.sr, ep.sd]) {
          const col = st.kind === 'SR' ? PALETTE.retro : PALETTE.direct;
          const Es = m.pos('earth', st.jdUt), Ps = m.pos(b, st.jdUt);
          if (s.sight) this.line(this.XY(Es), this.XY(OrreryPlate.ray(Es, ringC, st.lon, R_IN * toAU)), rgba(col, .25), 1);
          const [px, py] = this.XY(Ps), [ex, ey] = this.XY(Es);
          this.disc(px, py, 4.5, null, rgba(col, .9)); this.disc(ex, ey, 4.5, null, rgba(col, .6));
          const off = this.S(Math.hypot(Ps[0], Ps[1]) * Rpx + 13, helioLon(b, st.jdUt));
          this.text(st.kind === 'SR' ? '℞' : 'D', off[0], off[1], col, `600 ${gsz * .7}px ${this.font}`);
          this.line(this.P(R_BAND_IN * U, st.lon), this.P((R_BAND_IN - .07) * U, st.lon), col, 2);
        }
      }
    }

    if (s.show.venus && s.decagram) {
      this.helioStar(m, t, m.conjunctions('venus', t), PALETTE.venus);
      this.helioStar(m, t, m.superiorConjunctions('venus', t), PALETTE.superior);
    }
    if (s.show.venus && s.inferior) this.pentagram(m, t, m.conjunctions('venus', t), PALETTE.venus, true);
    if (s.show.venus && s.superior) this.pentagram(m, t, m.superiorConjunctions('venus', t), PALETTE.superior, false);

    // apparent tracks: a time spiral in each lane (outer edge = now, older sinks inward)
    c.lineCap = 'round';
    for (const b of vis) {
      const win = synodicDays(b), N = 420, [rIn, rOut] = LANE[b];
      const step = win / N, base = Math.floor(t / step) * step;
      let prev: XYp | null = null;
      for (let i = -1; i <= N; i++) {
        const tt = i < 0 ? t : base - i * step, f = (t - tt) / win;
        const pt = this.P((rOut - (rOut - rIn) * f) * U, m.geoLon(b, tt)), retro = m.rate(b, tt) < 0;
        if (prev) {
          c.strokeStyle = rgba(retro ? PALETTE.retro : COLOR[b], (1 - .82 * f) * (retro ? 1 : .8));
          c.lineWidth = retro ? 2.2 : 1.4; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(pt[0], pt[1]); c.stroke();
        }
        prev = pt;
      }
      for (const st of m.stations(b, t)) {
        if (st.jdUt > t || st.jdUt < t - win) continue;
        const f = (t - st.jdUt) / win, [x, y] = this.P((rOut - (rOut - rIn) * f) * U, st.lon);
        this.disc(x, y, 3.2, PALETTE.night, st.kind === 'SR' ? PALETTE.retro : PALETTE.direct);
      }
      // head of the spiral; with Earth centred, the sight line's dot on the ecliptic already marks it
      if (!(s.view === 'earth' && s.sight)) {
        const [x, y] = this.P(rOut * U, m.geoLon(b, t)); this.disc(x, y, 4, COLOR[b], PALETTE.night);
      }
    }

    { const [x, y] = this.P(R_BAND_IN * U - 3, sunLon); this.disc(x, y, 3.5, PALETTE.brass); }

    // sight lines from Earth to the ecliptic. With Earth at the centre the dot is exactly the
    // planet's apparent longitude; round the Sun it falls a little off it (the sphere is drawn
    // at a finite distance), next to the spiral's head, which marks the true longitude.
    if (s.sight) for (const b of vis) {
      const l = m.geoLon(b, t), hx = this.XY(OrreryPlate.ray(E, ringC, l, R_BAND_IN * toAU));
      this.line(this.XY(E), hx, rgba(COLOR[b], .6), 1.1);
      this.disc(hx[0], hx[1], 4, COLOR[b], PALETTE.night);
    }

    const sg = c.createRadialGradient(O[0], O[1], 0, O[0], O[1], 22);
    sg.addColorStop(0, 'rgba(255,226,150,1)'); sg.addColorStop(.3, 'rgba(255,200,100,.55)'); sg.addColorStop(1, 'rgba(255,180,80,0)');
    c.fillStyle = sg; c.beginPath(); c.arc(O[0], O[1], 22, 0, 7); c.fill();
    this.disc(O[0], O[1], 6.5, '#ffe7a8');
    drawGlyph(c, BODY_GLYPHS.sun, O[0] + 17, O[1] + 17, gsz * .85, PALETTE.brass, s.glyphStyle);

    s.pulses.splice(0, s.pulses.length, ...s.pulses.filter(p => now - p.at < 1800));
    for (const p of s.pulses) {
      const age = (now - p.at) / 1800, [x, y] = this.XY(p.xy);
      c.strokeStyle = rgba(p.color, 1 - age); c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6 + 26 * age, 0, 7); c.stroke();
      if (p.earth) this.line(O, this.XY(p.earth), rgba(p.color, .8 * (1 - age)), 2);
      this.text(p.label, x, y - 18 - 10 * age, rgba(p.color, 1 - age * .8), `500 ${Math.max(11, gsz * .6)}px ${this.font}`);
    }

    for (const b of [...vis, 'earth'] as OrreryBody[]) {
      const v = m.pos(b, t), [x, y] = this.XY(v), r = b === 'earth' ? 7.5 : b === 'mercury' ? 5.5 : 6;
      const glow = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
      glow.addColorStop(0, rgba(COLOR[b], .45)); glow.addColorStop(1, rgba(COLOR[b], 0));
      c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill();
      const retro = b !== 'earth' && m.rate(b, t) < 0;
      this.disc(x, y, r, COLOR[b], retro ? PALETTE.retro : PALETTE.night);
      const [gx, gy] = this.S(Math.hypot(v[0], v[1]) * Rpx + 19, helioLon(b, t));
      drawGlyph(c, GLYPH[b], gx, gy, gsz, COLOR[b], s.glyphStyle);
    }
  }
}

export function nearestPeriod(stations: Station[], jd: number) {
  let best: { sr: Station; sd: Station } | null = null, bd = Infinity;
  for (let i = 0; i + 1 < stations.length; i++) {
    const sr = stations[i]!, sd = stations[i + 1]!;
    if (sr.kind !== 'SR' || sd.kind !== 'SD') continue;
    const d = Math.abs((sr.jdUt + sd.jdUt) / 2 - jd);
    if (d < bd) { bd = d; best = { sr, sd }; }
  }
  return best;
}

// ---------- strip chart ----------


export class StripChart {
  private ctx: CanvasRenderingContext2D;
  private w = 600; private h = 230; private dpr = 1;
  constructor(private canvas: HTMLCanvasElement, private font: string) { this.ctx = canvas.getContext('2d')!; }
  resize(cssWidth: number, dpr: number) {
    this.w = Math.max(260, Math.floor(cssWidth)); this.dpr = Math.min(2, dpr || 1);
    this.canvas.width = this.w * this.dpr; this.canvas.height = this.h * this.dpr;
  }

  draw(m: OrreryModel, jd: number, show: Record<InnerPlanet, boolean>, style: GlyphStyle) {
    const c = this.ctx, { w, h } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const padL = 34, padR = 8, padT = 6, padB = 22, iw = w - padL - padR, ih = h - padT - padB;
    const t0 = jd - 520, t1 = jd + 130;
    const X = (tt: number) => padL + (tt - t0) / (t1 - t0) * iw, Y = (l: number) => padT + ih - l / 360 * ih;
    c.fillStyle = PALETTE.sky; c.fillRect(0, 0, w, h);
    for (let s = 0; s < 12; s++) {
      if (s % 2) { c.fillStyle = 'rgba(255,255,255,.018)'; c.fillRect(padL, Y((s + 1) * 30), iw, ih / 12); }
      c.strokeStyle = rgba(PALETTE.brass, .12); c.lineWidth = 1;
      c.beginPath(); c.moveTo(padL, Y(s * 30)); c.lineTo(padL + iw, Y(s * 30)); c.stroke();
      drawGlyph(c, SIGN_GLYPHS_SVG[s]!, padL - 15, Y(s * 30 + 15), Math.min(14, ih / 12 - 2), rgba(PALETTE.brass, .85), style, false);
    }
    c.font = `10px ${this.font}`; c.textBaseline = 'top'; c.textAlign = 'center';
    const d0 = dateOfJd(t0);
    let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1;
    for (let i = 0; i < 30; i++) {
      if (mo > 11) { mo = 0; y++; }
      const tt = Date.UTC(y, mo, 1) / 86400000 + 2440587.5;
      if (tt > t1) break;
      const x = X(tt);
      c.strokeStyle = mo === 0 ? 'rgba(214,180,110,.3)' : 'rgba(140,152,180,.1)';
      c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + ih); c.stroke();
      if (mo % 2 === 0) { c.fillStyle = mo === 0 ? PALETTE.brass : PALETTE.muted; c.fillText(mo === 0 ? String(y) : MONTHS[mo]!, x, padT + ih + 5); }
      mo++;
    }
    const plot = (fn: (t: number) => number, color: string, retro: ((t: number) => boolean) | null, width: number, dash: number[] = []) => {
      let prev: { l: number; x: number; y: number } | null = null;
      const step = .5, start = Math.floor(t0 / step) * step;
      c.setLineDash(dash);
      for (let tt = start; tt <= t1 + step; tt += step) {
        const l = fn(tt), x = X(tt), yy = Y(l);
        if (prev && Math.abs(l - prev.l) < 180) {
          const r = retro?.(tt) ?? false;
          c.strokeStyle = tt > jd ? rgba(r ? PALETTE.retro : color, .35) : (r ? PALETTE.retro : color);
          c.lineWidth = r ? width + 1.6 : width;
          c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(x, yy); c.stroke();
        }
        prev = { l, x, y: yy };
      }
      c.setLineDash([]);
    };
    plot(t => m.sunLon(t), rgba(PALETTE.brass, .7), null, 1);
    for (const b of INNER.filter(x => show[x])) {
      plot(t => m.geoLon(b, t), COLOR[b], t => m.rate(b, t) < 0, 1.3);
      for (const st of m.stations(b, jd)) {
        if (st.jdUt < t0 || st.jdUt > t1) continue;
        const x = X(st.jdUt), yy = Y(st.lon), col = st.kind === 'SR' ? PALETTE.retro : PALETTE.direct;
        c.globalAlpha = st.jdUt > jd ? .5 : 1;
        c.beginPath(); c.arc(x, yy, 3.2, 0, 7); c.fillStyle = PALETTE.sky; c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
        c.font = `600 11px ${this.font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col;
        c.fillText(st.kind === 'SR' ? '℞' : 'D', x, yy + (st.kind === 'SR' ? -11 : 11));
        c.globalAlpha = 1;
      }
      const x = X(jd), yy = Y(m.geoLon(b, jd));
      c.beginPath(); c.arc(x, yy, 4, 0, 7); c.fillStyle = COLOR[b]; c.fill();
    }
    c.strokeStyle = 'rgba(226,232,244,.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(jd), padT); c.lineTo(X(jd), padT + ih); c.stroke();
    c.font = `10px ${this.font}`; c.fillStyle = PALETTE.ink; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText('now', X(jd) + 4, padT + 2);
  }
}
