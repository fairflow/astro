import {
  findStations, geometricLon, helioXY, inferiorConjunctions, isInner, oppositions,
  PLANETS_IN_ORDER, PRECESSION_PER_DAY, SIDEREAL_DAYS, solarConjunctions, superiorConjunctions,
  synodicDays, type OrreryBody, type Planet, type Station,
} from '../chart/retrograde.js';
import { J2000_JD, degDiff, normDeg, type EphemerisProvider } from '../ephemeris/types.js';
import { BODY_GLYPHS, SIGN_GLYPHS_SVG, type GlyphDef, type GlyphStyle } from './glyphset.js';

/**
 * Canvas orrery for the Retrograde tab: the planets seen from above the
 * north ecliptic pole inside a zodiac "celestial sphere", each planet's
 * apparent track drawn as a time spiral, and a strip chart of apparent
 * longitude against time.
 *
 * Positions come from an OrreryModel: the app's ephemeris (true orbits,
 * stations exact to the provider) or an idealised circular model for
 * teaching. Time is jdUt throughout.
 *
 * Distances are true to scale out to Mars and logarithmic beyond (see
 * radial()), so Saturn and Pluto fit on the same plate as Mercury. The
 * stretch is centred on the Sun in the Sun-centred view and on Earth in
 * the Earth-centred view, so in each view lines from the centre stay
 * straight; other true straight lines (sight lines from Earth in the Sun
 * view) are drawn through the same stretch and so curve.
 */

export { PLANETS_IN_ORDER };
export const GROUPS: { id: string; label: string; planets: Planet[] }[] = [
  { id: 'inner', label: 'Inner', planets: ['mercury', 'venus'] },
  { id: 'classical', label: 'Classical outer', planets: ['mars', 'jupiter', 'saturn'] },
  { id: 'modern', label: 'Modern outer', planets: ['uranus', 'neptune', 'pluto'] },
];

export interface OrreryModel {
  readonly kind: 'ephemeris' | 'circular';
  /** Heliocentric position in the ecliptic plane, AU (J2000 frame). */
  pos(b: OrreryBody, jd: number): [number, number];
  /** Geocentric longitude used for drawing (deg, equinox of date). */
  geoLon(b: Planet, jd: number): number;
  /** Apparent motion used for drawing, deg/day. */
  rate(b: Planet, jd: number): number;
  /** The Sun's geocentric longitude (deg). */
  sunLon(jd: number): number;
  /** Stations within at least ±600 days of jd. */
  stations(b: Planet, jd: number): Station[];
  /**
   * The alignment at the middle of each retrograde spell: inferior
   * conjunction (Mercury, Venus) or opposition (outer planets). Covers at
   * least [jd − 10 synodic periods, jd + 1 synodic period].
   */
  midRetro(b: Planet, jd: number): number[];
  /** The planet behind the Sun: superior conjunction, or conjunction with the Sun. */
  behindSun(b: Planet, jd: number): number[];
  /** Orbit outline, AU. */
  orbit(b: OrreryBody, jd: number): [number, number][];
}

// ---------- models ----------

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/** Mean distance (AU) and J2000 mean longitude (deg) for the circular model. */
const MEAN: Record<OrreryBody, [number, number]> = {
  mercury: [0.387098, 252.25084], venus: [0.723332, 181.97973], earth: [1, 100.46435],
  mars: [1.523679, 355.43328], jupiter: [5.20260, 34.35148], saturn: [9.55491, 50.07747],
  uranus: [19.21845, 314.05501], neptune: [30.11039, 304.34867], pluto: [39.48212, 238.92904],
};
/** Aphelion distances (AU), for sizing the plate to the planets shown. */
const APHELION: Record<OrreryBody, number> = {
  mercury: .467, venus: .728, earth: 1.017, mars: 1.666, jupiter: 5.46,
  saturn: 10.1, uranus: 20.1, neptune: 30.3, pluto: 49.3,
};

/** Idealised: circular, coplanar orbits at mean distance and mean motion. */
export function circularModel(): OrreryModel {
  const L = (b: OrreryBody, jd: number) => MEAN[b][1] + 360 * (jd - J2000_JD) / SIDEREAL_DAYS[b];
  const pos = (b: OrreryBody, jd: number): [number, number] => {
    const a = MEAN[b][0], l = L(b, jd) * D2R;
    return [a * Math.cos(l), a * Math.sin(l)];
  };
  const geoLon = (b: Planet, jd: number) => {
    const p = pos(b, jd), e = pos('earth', jd);
    return normDeg(Math.atan2(p[1] - e[1], p[0] - e[0]) * R2D);
  };
  const rate = (b: Planet, jd: number) => {
    const p = pos(b, jd), e = pos('earth', jd);
    const n = (x: OrreryBody) => 2 * Math.PI / SIDEREAL_DAYS[x];
    const vp = [-n(b) * p[1], n(b) * p[0]], ve = [-n('earth') * e[1], n('earth') * e[0]];
    const dx = p[0] - e[0], dy = p[1] - e[1], vx = vp[0]! - ve[0]!, vy = vp[1]! - ve[1]!;
    return (dx * vy - dy * vx) / (dx * dx + dy * dy) * R2D;
  };
  const cache = new Map<Planet, { from: number; to: number; list: Station[] }>();
  const stations = (b: Planet, jd: number) => {
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
  // phase 0: the faster body overtakes the slower (inferior conjunction or opposition); 0.5: behind the Sun
  const phased = (b: Planet, jd: number, phase: number) => {
    const S = synodicDays(b), sgn = isInner(b) ? 1 : -1;
    const d0 = sgn * (MEAN[b][1] - MEAN.earth[1]);
    const k0 = Math.floor((sgn * (L(b, jd) - L('earth', jd))) / 360);
    const out: number[] = [];
    for (let k = k0 - 11; k <= k0 + 1; k++) out.push(J2000_JD + ((k + phase) * 360 - d0) * S / 360);
    return out;
  };
  return {
    kind: 'circular', pos, geoLon, rate, stations,
    midRetro: (b, jd) => phased(b, jd, 0),
    behindSun: (b, jd) => phased(b, jd, 0.5),
    sunLon: jd => normDeg(L('earth', jd) + 180),
    orbit: b => Array.from({ length: 241 }, (_, i) =>
      [MEAN[b][0] * Math.cos(i * 1.5 * D2R), MEAN[b][0] * Math.sin(i * 1.5 * D2R)] as [number, number]),
  };
}

/**
 * The app's ephemeris: astronomy-engine heliocentric vectors for drawing
 * (cached on a fixed time grid so animation frames reuse them), and the
 * provider's apparent positions for stations, so they match the chart.
 */
export function ephemerisModel(provider: EphemerisProvider): OrreryModel {
  // grid step per planet: finer where the apparent motion is faster
  const GRID: Record<Planet, number> = {
    mercury: .25, venus: .25, mars: .5, jupiter: 1, saturn: 2, uranus: 3, neptune: 3, pluto: 4,
  };
  // one numeric-keyed cache per body (string keys cost more than the lookups they save)
  const caches = new Map<Planet | 'sun', Map<number, number>>();
  const cacheOf = (b: Planet | 'sun') => {
    let c = caches.get(b);
    if (!c) caches.set(b, c = new Map());
    else if (c.size > 100000) c.clear();
    return c;
  };
  const gridLon = (b: Planet, i: number) => {
    const c = cacheOf(b);
    let v = c.get(i);
    if (v === undefined) { v = geometricLon(b, i * GRID[b]); c.set(i, v); }
    return v;
  };
  const geoLon = (b: Planet, jd: number) => {
    const g = GRID[b], i = Math.floor(jd / g), f = jd / g - i, a = gridLon(b, i);
    return normDeg(a + f * degDiff(gridLon(b, i + 1), a));
  };
  const rate = (b: Planet, jd: number) => {
    const g = GRID[b], i = Math.round(jd / g);
    return degDiff(gridLon(b, i + 1), gridLon(b, i - 1)) / (2 * g);
  };
  // stations: scanned on the cached grid, refined against the provider; the cache grows in
  // chunks as time moves on, so fast playback never recomputes a whole window at once
  const LIMIT_LO = J2000_JD - 300 * 365.25, LIMIT_HI = J2000_JD + 200 * 365.25, CHUNK = 900, KEEP = 3000;
  const st = new Map<Planet, { from: number; to: number; list: Station[] }>();
  const scan = (b: Planet, from: number, to: number) => {
    const lo = Math.max(from, LIMIT_LO), hi = Math.min(to, LIMIT_HI);
    return lo < hi ? findStations(provider, b, lo, hi, 2, jd => rate(b, jd)) : [];
  };
  const stations = (b: Planet, jd: number) => {
    let c = st.get(b);
    if (!c || jd < c.from - CHUNK || jd > c.to + CHUNK) {
      c = { from: jd - 1200, to: jd + 1200, list: scan(b, jd - 1200, jd + 1200) };
      st.set(b, c);
    }
    const near = (list: Station[], s: Station) => list.some(x => Math.abs(x.jdUt - s.jdUt) < .5);
    while (jd > c.to - 600) {
      const cur: { from: number; to: number; list: Station[] } = c;
      const add = scan(b, cur.to, cur.to + CHUNK).filter(s => !near(cur.list, s));
      cur.list = [...cur.list, ...add].filter(s => s.jdUt > jd - KEEP);
      cur.to += CHUNK; cur.from = Math.max(cur.from, jd - KEEP);
    }
    while (jd < c.from + 600) {
      const cur: { from: number; to: number; list: Station[] } = c;
      const add = scan(b, cur.from - CHUNK, cur.from).filter(s => !near(cur.list, s));
      cur.list = [...add, ...cur.list].filter(s => s.jdUt < jd + KEEP);
      cur.from -= CHUNK; cur.to = Math.min(cur.to, jd + KEEP);
    }
    return c.list;
  };
  // alignment lists also grow a chunk at a time, keeping ~10 cycles behind and 2 ahead
  const cj = new Map<string, { from: number; to: number; list: number[] }>();
  const cached = (kind: 'mid' | 'behind', b: Planet, jd: number) => {
    const S = synodicDays(b), key = kind + b;
    const find = (a: number, z: number) => isInner(b)
      ? (kind === 'mid' ? inferiorConjunctions : superiorConjunctions)(b, a, z)
      : (kind === 'mid' ? oppositions : solarConjunctions)(b, a, z);
    const merge = (list: number[], add: number[]) =>
      [...list, ...add.filter(x => !list.some(y => Math.abs(x - y) < 1))].sort((x, y) => x - y);
    let c = cj.get(key);
    if (!c || jd < c.from - 3 * S || jd > c.to + 3 * S) {
      c = { from: jd - 11 * S, to: jd + 2 * S, list: find(jd - 11 * S, jd + 2 * S) };
      cj.set(key, c);
    }
    while (jd > c.to - S) {
      c.list = merge(c.list, find(c.to, c.to + 2 * S)).filter(x => x > jd - 11 * S);
      c.to += 2 * S; c.from = Math.max(c.from, jd - 11 * S);
    }
    while (jd < c.from + 10.5 * S) {
      c.list = merge(c.list, find(c.from - 2 * S, c.from)).filter(x => x < jd + 2 * S);
      c.from -= 2 * S; c.to = Math.min(c.to, jd + 2 * S);
    }
    return c.list;
  };
  const orbits = new Map<string, [number, number][]>();
  return {
    kind: 'ephemeris', geoLon, rate, stations,
    midRetro: (b, jd) => cached('mid', b, jd),
    behindSun: (b, jd) => cached('behind', b, jd),
    pos: (b, jd) => helioXY(b, jd),
    sunLon: jd => {
      // on a half-day grid, cached like the planets' longitudes (the strip chart asks ~1,300 times a frame)
      const sc = cacheOf('sun');
      const sun = (i: number) => {
        let v = sc.get(i);
        if (v === undefined) {
          const e = helioXY('earth', i * .5);
          v = normDeg(Math.atan2(e[1], e[0]) * R2D + 180 + PRECESSION_PER_DAY * (i * .5 - J2000_JD));
          sc.set(i, v);
        }
        return v;
      };
      const i = Math.floor(jd / .5), f = jd / .5 - i, a = sun(i);
      return normDeg(a + f * degDiff(sun(i + 1), a));
    },
    orbit: (b, jd) => {
      // one sidereal period of real positions centred on jd, refreshed every 1/40 of an orbit
      // (1/10 for the outer planets, whose orbits barely change between refreshes)
      const P = SIDEREAL_DAYS[b], step = Math.max(30, P / (b === 'earth' || isInner(b as Planet) ? 40 : 10));
      const k = `${b}${Math.round(jd / step)}`;
      let o = orbits.get(k);
      if (!o) {
        if (orbits.size > 120) orbits.clear();
        const t0 = Math.round(jd / step) * step - P / 2;
        o = Array.from({ length: 241 }, (_, i) => helioXY(b, t0 + P * i / 240));
        orbits.set(k, o);
      }
      return o;
    },
  };
}

// ---------- palettes ----------

export interface Palette {
  night: string; sky: string; brass: string; retro: string; direct: string; superior: string;
  ink: string; muted: string; sunCore: string;
  mercury: string; venus: string; earth: string; mars: string; jupiter: string;
  saturn: string; uranus: string; neptune: string; pluto: string;
  /** rgb triples for the star field */
  star: string; starWarm: string; haze: string; field: string;
  /** ring band gradient stops and the plate's central glow */
  band: [string, string, string]; glow: [string, string];
  sun: [string, string, string]; label: string;
}
export const DARK: Palette = {
  night: '#05080f', sky: '#0a1020', brass: '#d6b46e', retro: '#ff6f7f', direct: '#7fe0a8',
  superior: '#c39bff', ink: '#e2e8f4', muted: '#8b98b4', sunCore: '#ffe7a8',
  mercury: '#a8dcec', venus: '#f4c98c', earth: '#8ab4ff', mars: '#ff9a5c', jupiter: '#ffd166',
  saturn: '#c2cc8a', uranus: '#6fe0d0', neptune: '#6f86ff', pluto: '#d6a8a0',
  star: '210,224,255', starWarm: '255,214,170', haze: '190,200,235', field: '200,212,240',
  band: ['rgba(22,32,62,.15)', 'rgba(26,38,72,.55)', 'rgba(14,20,40,.9)'],
  glow: ['rgba(40,52,90,.30)', 'rgba(16,22,44,.18)'],
  sun: ['rgba(255,226,150,1)', 'rgba(255,200,100,.55)', 'rgba(255,180,80,0)'],
  label: 'rgba(235,228,210,.6)',
};
/** Ink on paper: an old star atlas rather than a night sky. */
export const LIGHT: Palette = {
  night: '#f4efe3', sky: '#fbf8f1', brass: '#8a6a28', retro: '#c62f43', direct: '#1d8650',
  superior: '#7a4cc4', ink: '#2c2820', muted: '#6d6656', sunCore: '#e0a030',
  mercury: '#2a7d98', venus: '#a8681f', earth: '#2f5fc4', mars: '#c4501a', jupiter: '#9c7400',
  saturn: '#66742a', uranus: '#0f8a7c', neptune: '#2f42b8', pluto: '#8a5248',
  star: '40,36,28', starWarm: '110,60,20', haze: '120,100,60', field: '70,60,40',
  band: ['rgba(140,115,60,.05)', 'rgba(140,115,60,.12)', 'rgba(120,95,45,.2)'],
  glow: ['rgba(255,250,235,.6)', 'rgba(244,239,227,0)'],
  sun: ['rgba(232,160,40,1)', 'rgba(240,180,70,.45)', 'rgba(240,190,90,0)'],
  label: 'rgba(60,50,30,.7)',
};
export const paletteFor = (theme: 'dark' | 'light'): Palette => theme === 'light' ? LIGHT : DARK;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateOfJd = (jd: number) => new Date((jd - 2440587.5) * 86400000);

const EARTH_GLYPH: GlyphDef = { d: 'M50 18 A32 32 0 1 1 49.9 18 Z M50 18 V82 M18 50 H82' };
const glyphOf = (b: OrreryBody): GlyphDef => b === 'earth' ? EARTH_GLYPH : BODY_GLYPHS[b];
/** Disc radius (px) per body. */
const SIZE: Record<OrreryBody, number> = {
  mercury: 5, venus: 6, earth: 7.5, mars: 5.5, jupiter: 8, saturn: 7.5, uranus: 6.5, neptune: 6.5, pluto: 4.5,
};

/**
 * The celestial sphere is a ring centred on Earth (or on the Sun in the
 * Sun-centred view). Radii are in ring units; the plate scales so the
 * ring clears every orbit shown.
 */
const R_IN = 2.06, R_BAND_IN = 2.40, R_BAND_OUT = 2.62, R_EDGE = 2.68;
/** Track lanes share this band inside the ring, one per planet shown. */
const LANES_IN = 2.075, LANES_OUT = 2.345;
/** Where the inner planets' Sun-centred ecliptic was first drawn: a plain circle round the Sun. */
const OLD_ECLIPTIC = 1.385;
// Bright stars near the ecliptic, J2000 longitudes.
const STARS: [string, number][] = [
  ['Aldebaran', 69.8], ['Pollux', 113.2], ['Regulus', 149.8], ['Spica', 203.8], ['Antares', 249.8],
];

/**
 * Radial stretch: true distance r (AU) → drawn distance. Linear out to r0,
 * then r0·(1 + ln(r/r0)): continuous with a continuous slope, so equal
 * distance ratios beyond r0 get equal steps.
 */
export function radial(r: number, r0: number): number {
  return r <= r0 ? r : r0 * (1 + Math.log(r / r0));
}
/** Sun-centred stretch starts just past Mars; Earth-centred just past the far side of Earth's orbit. */
export const R0_SUN = 1.7, R0_EARTH = 2.1;

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
  color: string, style: GlyphStyle, halo: string | null,
) {
  let p = pathCache.get(def.d);
  if (!p) { p = new Path2D(def.d); pathCache.set(def.d, p); }
  const s = size / 100;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2); ctx.scale(s, s);
  if (style.slant) { ctx.translate(50, 50); ctx.transform(1, 0, -Math.tan(style.slant * D2R), 1, 0, 0); ctx.translate(-50, -50); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (halo) { ctx.strokeStyle = rgba(halo, .85); ctx.lineWidth = style.weight + 14; ctx.stroke(p); }
  ctx.strokeStyle = color; ctx.lineWidth = style.weight; ctx.stroke(p);
  ctx.fillStyle = color;
  for (const [cx, cy, r] of def.dots ?? []) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); }
  ctx.restore();
}

export interface Pulse { at: number; xy: [number, number]; color: string; label: string; earth?: [number, number] }

export interface PlateState {
  jd: number;
  jdStart: number;
  show: Record<Planet, boolean>;
  sight: boolean;
  /** Inferior-conjunction figures (Mercury's on its orbit, and the Venus pentagram on the zodiac). */
  inferior: boolean;
  /** Superior-conjunction figures, in their own colour. */
  superior: boolean;
  /** Venus's conjunctions seen from the Sun: the two stars interleave as a decagram. */
  decagram: boolean;
  /** Keep Earth (and so the zodiac) still, or the Sun. */
  view: 'earth' | 'sun';
  theme: 'dark' | 'light';
  pulses: Pulse[];
  glyphStyle: GlyphStyle;
  /** Optional chart moment to mark (natal date) as a ring on Earth's orbit. */
  markJd?: number | null;
}

type XYp = [number, number];

export class OrreryPlate {
  private W = 600; private dpr = 1;
  /** px per drawn distance unit (orbits) and px per ring unit (the zodiac ring and its lanes). */
  private Rpx = 100; private U = 100;
  /** Ring centre (Earth or Sun) and the Sun, on screen. */
  private Z: XYp = [300, 300];
  private O: XYp = [300, 300];
  // the drawing transform for this frame
  private view: 'earth' | 'sun' = 'earth';
  private E: XYp = [1, 0];
  private psi = 0; private cosPsi = 1; private sinPsi = 0;
  private theme: 'dark' | 'light' = 'dark';
  private pal: Palette = DARK;
  private back: HTMLCanvasElement | null = null;
  private ring: HTMLCanvasElement | null = null;
  /** Orbit stretches covered during a retrograde spell, by planet and spell (AU, not yet drawn). */
  private spans = new Map<string, [number, number][]>();
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement, private font: string) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssWidth: number, dpr: number) {
    this.W = Math.max(280, Math.floor(cssWidth)); this.dpr = Math.min(2, dpr || 1);
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.W * this.dpr;
    this.U = this.W / 2 / (R_EDGE + .04);
    this.back = null; this.ring = null;
  }

  private rot(v: XYp): XYp {
    return [v[0] * this.cosPsi - v[1] * this.sinPsi, v[0] * this.sinPsi + v[1] * this.cosPsi];
  }
  /** Heliocentric AU (J2000 frame) → drawn plane (of-date frame, stretched). */
  private disp(v: XYp): XYp {
    const [x, y] = this.rot(v);
    if (this.view === 'sun') {
      const r = Math.hypot(x, y); if (r === 0) return [0, 0];
      const k = radial(r, R0_SUN) / r; return [x * k, y * k];
    }
    const E = this.rot(this.E), dx = x - E[0], dy = y - E[1], r = Math.hypot(dx, dy);
    if (r === 0) return E;
    const k = radial(r, R0_EARTH) / r; return [E[0] + dx * k, E[1] + dy * k];
  }
  /** Drawn plane → screen. The view's centre (Earth or Sun) sits at the middle of the plate. */
  private scr(d: XYp): XYp {
    const C: XYp = this.view === 'earth' ? this.rot(this.E) : [0, 0];
    return [this.W / 2 + (d[0] - C[0]) * this.Rpx, this.W / 2 - (d[1] - C[1]) * this.Rpx];
  }
  private XY(v: XYp): XYp { return this.scr(this.disp(v)); }
  /** Polar about the ring centre: r in px, longitude in degrees (equinox of date). */
  private P(r: number, lon: number): XYp {
    return [this.Z[0] + r * Math.cos(lon * D2R), this.Z[1] - r * Math.sin(lon * D2R)];
  }

  private buildBack() {
    const { W, pal } = this;
    const off = document.createElement('canvas'); off.width = W * this.dpr; off.height = W * this.dpr;
    const g = off.getContext('2d')!; g.scale(this.dpr, this.dpr);
    g.fillStyle = pal.night; g.fillRect(0, 0, W, W);
    const rand = rng(11);
    for (let i = 0; i < 420; i++) {
      const x = rand() * W, y = rand() * W, m = rand(), s = m > .93 ? 1.4 : .8;
      g.fillStyle = `rgba(${pal.field},${.08 + .25 * m * m})`; g.fillRect(x, y, s, s);
    }
    this.back = off;
  }

  /** The zodiac ring with its stars, drawn once and placed on its centre each frame. */
  private buildRing(style: GlyphStyle) {
    const { pal } = this, Rpx = this.U, k = Rpx * 1.7; // ring-proportional unit for text and ticks
    const D = Math.ceil(2 * (R_EDGE + .02) * Rpx), h = D / 2;
    const off = document.createElement('canvas'); off.width = D * this.dpr; off.height = D * this.dpr;
    const g = off.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const Q = (r: number, lon: number): XYp => [h + r * Math.cos(lon * D2R), h - r * Math.sin(lon * D2R)];
    let gr = g.createRadialGradient(h, h, 0, h, h, Rpx * R_EDGE);
    gr.addColorStop(0, pal.glow[0]); gr.addColorStop(.7, pal.glow[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(h, h, R_EDGE * Rpx, 0, 7); g.fill();
    const rand = rng(7);
    g.save(); g.beginPath(); g.arc(h, h, R_EDGE * Rpx, 0, 2 * Math.PI); g.arc(h, h, R_IN * Rpx, 0, 2 * Math.PI, true); g.clip();
    gr = g.createRadialGradient(h, h, R_IN * Rpx, h, h, R_EDGE * Rpx);
    gr.addColorStop(0, pal.band[0]); gr.addColorStop(.55, pal.band[1]); gr.addColorStop(1, pal.band[2]);
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
      g.fillStyle = `rgba(${pal.haze},${.05 + .12 * rand()})`; g.beginPath(); g.arc(x, y, 1.6 + rand() * 3.5, 0, 7); g.fill();
    }
    for (let i = 0; i < 1100; i++) {
      const l = rand() * 360, [x, y] = Q((R_IN + rand() * (R_EDGE - R_IN)) * Rpx, l), m = rand();
      g.fillStyle = rand() < .25 ? `rgba(${pal.starWarm},${.25 + .6 * m * m})` : `rgba(${pal.star},${.2 + .7 * m * m})`;
      const s = m > .96 ? 1.8 : m > .8 ? 1.2 : .7; g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    g.restore();
    g.strokeStyle = rgba(pal.brass, .55); g.lineWidth = 1;
    for (const r of [R_BAND_IN, R_BAND_OUT]) { g.beginPath(); g.arc(h, h, r * Rpx, 0, 2 * Math.PI); g.stroke(); }
    g.strokeStyle = rgba(pal.brass, .18);
    for (const r of [R_IN, R_EDGE]) { g.beginPath(); g.arc(h, h, r * Rpx, 0, 2 * Math.PI); g.stroke(); }
    for (let d = 0; d < 360; d++) {
      const len = (d % 10 === 0 ? .03 : d % 5 === 0 ? .02 : .01) * k;
      const a = Q(R_BAND_IN * Rpx, d), b = Q(R_BAND_IN * Rpx + len, d);
      g.strokeStyle = rgba(pal.brass, d % 30 === 0 ? .9 : d % 10 === 0 ? .6 : .35); g.lineWidth = d % 30 === 0 ? 1.2 : .8;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    const gs = Math.max(13, k * .085);
    for (let s = 0; s < 12; s++) {
      const a = Q(R_BAND_IN * Rpx, s * 30), b = Q(R_BAND_OUT * Rpx, s * 30);
      g.strokeStyle = rgba(pal.brass, .5); g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      const [gx, gy] = Q((R_BAND_IN + R_BAND_OUT) / 2 * Rpx + 2, s * 30 + 15);
      drawGlyph(g, SIGN_GLYPHS_SVG[s]!, gx, gy, gs, rgba(pal.brass, .95), style, null);
    }
    g.font = `${Math.max(8, k * .032)}px ${this.font}`; g.fillStyle = rgba(pal.brass, .6);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 10; d < 360; d += 10) {
      if (d % 30 === 0) continue;
      const [x, y] = Q(R_BAND_IN * Rpx + .05 * k, d); g.fillText(String(d % 30), x, y);
    }
    const rs = R_BAND_IN * Rpx - .017 * k;
    for (const [name, l] of STARS) {
      const [x, y] = Q(rs, l);
      const gl = g.createRadialGradient(x, y, 0, x, y, 6);
      gl.addColorStop(0, `rgba(${pal.star},.9)`); gl.addColorStop(1, `rgba(${pal.star},0)`);
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.fillStyle = this.theme === 'light' ? pal.ink : '#fff'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill();
      const [lx, ly] = Q(rs, l + 2.2), lower = Math.sin(l * D2R) < 0;
      g.save(); g.translate(lx, ly); g.rotate(-(l + 2.2) * D2R - Math.PI / 2 + (lower ? Math.PI : 0));
      g.font = `${Math.max(8, k * .028)}px ${this.font}`; g.fillStyle = pal.label;
      g.textAlign = lower ? 'right' : 'left'; g.fillText(name, 0, 0); g.restore();
    }
    this.ring = off;
  }

  /**
   * Strokes many short segments with few draw calls: segments sharing a
   * style key go into one path. `style(key)` sets colour and width.
   */
  private static batched(c: CanvasRenderingContext2D, segs: { k: string; a: XYp; b: XYp }[], style: (k: string) => void) {
    const by = new Map<string, { a: XYp; b: XYp }[]>();
    for (const s of segs) { let l = by.get(s.k); if (!l) by.set(s.k, l = []); l.push(s); }
    for (const [k, l] of by) {
      style(k); c.beginPath();
      for (const { a, b } of l) { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
      c.stroke();
    }
  }

  private line(a: XYp, b: XYp, color: string, w = 1) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  private poly(pts: XYp[], color: string, w = 1, close = false) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = w; c.beginPath();
    pts.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
    if (close) c.closePath();
    c.stroke();
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
    c.lineWidth = 3.5; c.strokeStyle = rgba(this.pal.night, .85); c.lineJoin = 'round'; c.strokeText(t, x, y);
    c.fillStyle = color; c.fillText(t, x, y);
  }
  /** A true straight segment a→b (AU), drawn through the stretch (so possibly curved). */
  private seg(a: XYp, b: XYp, n = 24): XYp[] {
    return Array.from({ length: n + 1 }, (_, i) => this.XY([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]));
  }
  /**
   * A true sight line from `from` (AU) towards longitude `lon` (of date),
   * drawn through the stretch until it meets the ring circle of radius
   * `R` px about the ring centre. It ends at the planet's apparent
   * longitude: exactly with Earth centred, within a fraction of a degree
   * with the Sun centred (the line is followed out to over 100 AU).
   */
  private sightLine(from: XYp, lon: number, R: number): XYp[] {
    const l = lon * D2R - this.psi, u: XYp = [Math.cos(l), Math.sin(l)];
    const at = (s: number) => this.XY([from[0] + s * u[0], from[1] + s * u[1]]);
    const out = (p: XYp) => Math.hypot(p[0] - this.Z[0], p[1] - this.Z[1]) >= R;
    const pts: XYp[] = [at(0)];
    let s = 0, ds = .02;
    for (let i = 0; i < 400; i++) {
      const s2 = s + ds, p = at(s2);
      if (out(p)) {
        let lo = s, hi = s2;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (out(at(m))) hi = m; else lo = m; }
        pts.push(at(hi)); return pts;
      }
      pts.push(p); s = s2; ds *= 1.08;
    }
    return pts;
  }

  /**
   * A Venus pentagram against the zodiac: the geocentric longitude of each
   * conjunction, joined in time order. The previous star is drawn faintly to
   * show its slow turn; a hollow marker shows where the next will fall.
   */
  private pentagram(m: OrreryModel, t: number, all: number[], col: string, inside: boolean) {
    const c = this.ctx, R = R_BAND_IN * this.U - 2, k = this.U * 1.7;
    const past = all.filter(j => j <= t).slice(-10), next = all.find(j => j > t);
    const pts = past.map(j => ({ j, xy: this.P(R, m.geoLon('venus', j)) }));
    const font = `500 ${Math.max(9, k * .034)}px ${this.font}`;
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
      this.disc(p.xy[0], p.xy[1], recent ? 4.5 : 3, recent ? col : rgba(col, .35), this.pal.night);
      if (recent) {
        const [lx, ly] = lab(m.geoLon('venus', p.j)), d = dateOfJd(p.j);
        this.text(`${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, lx, ly, rgba(col, .85), font);
      }
    });
  }

  /** One of Venus's conjunction stars as seen from the Sun (with the other, a decagram). */
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
      this.disc(p[0], p[1], recent ? 3.6 : 2.4, recent ? col : rgba(col, .35), this.pal.night);
    });
    if (next !== undefined) { const [x, y] = this.XY(m.pos('venus', next)); this.disc(x, y, 4.5, null, rgba(col, .8)); }
  }

  /** Mercury's conjunction points on its orbit, joined in time order. */
  private orbitFigure(m: OrreryModel, t: number, all: number[], col: string) {
    const past = all.filter(j => j <= t).slice(-3), next = all.find(j => j > t);
    this.poly(past.map(j => this.XY(m.pos('mercury', j))), rgba(col, .22), 1);
    for (const j of past) { const [x, y] = this.XY(m.pos('mercury', j)); this.disc(x, y, 2.4, rgba(col, .6)); }
    if (next !== undefined) { const [x, y] = this.XY(m.pos('mercury', next)); this.disc(x, y, 4, null, rgba(col, .5)); }
  }

  /** Screen point `px` beyond `p`, directly away from the Sun. */
  private away(p: XYp, px: number): XYp {
    const dx = p[0] - this.O[0], dy = p[1] - this.O[1], r = Math.hypot(dx, dy) || 1;
    return [p[0] + dx / r * px, p[1] + dy / r * px];
  }

  draw(m: OrreryModel, s: PlateState, now: number) {
    const c = this.ctx, t = s.jd;
    if (s.theme !== this.theme) { this.theme = s.theme; this.pal = paletteFor(s.theme); this.back = null; this.ring = null; }
    const pal = this.pal;
    if (!this.back) this.buildBack();
    if (!this.ring) this.buildRing(s.glyphStyle);
    const vis = PLANETS_IN_ORDER.filter(b => s.show[b]);
    const { U, W } = this;

    // frame transform: precession to the equinox of date, the view, and a scale that fits
    // the ring round every orbit shown
    this.view = s.view;
    this.psi = m.kind === 'ephemeris' ? PRECESSION_PER_DAY * (t - J2000_JD) * D2R : 0;
    this.cosPsi = Math.cos(this.psi); this.sinPsi = Math.sin(this.psi);
    const E = m.pos('earth', t); this.E = E;
    const far = Math.max(...[...vis, 'earth' as OrreryBody].map(b => APHELION[b]));
    if (s.view === 'earth') {
      // the far side of the largest orbit as drawn from Earth; inner planets alone: as before
      const dmax = radial(far + APHELION.earth, R0_EARTH);
      this.Rpx = U * 2.034 / Math.max(2.034, dmax);
    } else {
      const dmax = radial(far, R0_SUN);
      this.Rpx = (W / 2 / 1.59) * APHELION.earth / Math.max(APHELION.earth, dmax);
    }
    this.O = this.XY([0, 0]);
    this.Z = s.view === 'earth' ? this.XY(E) : this.O;
    const { O, Z } = this;
    const outerShown = vis.some(b => !isInner(b));

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.back!, 0, 0, W, W);
    const D = this.ring!.width / this.dpr;
    c.drawImage(this.ring!, Z[0] - D / 2, Z[1] - D / 2, D, D);
    const gsz = Math.max(14, Math.min(22, U * .14));

    // a plain circle round the Sun where the inner planets' Sun-centred ecliptic was
    if (s.view === 'earth' && !outerShown) {
      const ring = Array.from({ length: 121 }, (_, i) => this.XY([OLD_ECLIPTIC * Math.cos(i * 3 * D2R), OLD_ECLIPTIC * Math.sin(i * 3 * D2R)]));
      this.poly(ring, rgba(pal.brass, .3), 1, true);
    }

    for (const b of [...vis, 'earth'] as OrreryBody[]) {
      this.poly(m.orbit(b, t).map(v => this.XY(v)), rgba(pal[b], .38), 1, m.kind === 'circular');
    }
    // Sun–Earth line across the zodiac: the synodic reference, and where the Sun appears from Earth
    const sunLon = m.sunLon(t);
    this.line(this.P(R_IN * U, sunLon + 180), this.P(R_IN * U, sunLon), rgba(pal.brass, .28));
    if (s.markJd != null) {
      const [x, y] = this.XY(m.pos('earth', s.markJd));
      this.disc(x, y, 7, null, rgba(pal.ink, .7));
      this.text('chart', x, y - 14, rgba(pal.ink, .7), `500 11px ${this.font}`);
    }

    for (const b of vis) {
      // sidereal reference: where the planet was when the counters started, fixed against the stars
      const p0 = m.pos(b, s.jdStart);
      this.poly(this.seg([0, 0], [p0[0] * 1.15, p0[1] * 1.15]), rgba(pal[b], .22), 1);
      const [mx, my] = this.XY(p0); this.disc(mx, my, 3, null, rgba(pal[b], .55));

      if (b === 'mercury' && s.inferior) this.orbitFigure(m, t, m.midRetro(b, t), pal[b]);
      if (b === 'mercury' && s.superior) this.orbitFigure(m, t, m.behindSun(b, t), pal.superior);

      // the retrograde period nearest now: stretches of both orbits, frozen sight lines at each station
      const ep = nearestPeriod(m.stations(b, t), t);
      if (ep) {
        const span = (body: OrreryBody) => {
          const key = `${m.kind}${body}${b}${ep.sr.jdUt}`;
          let v = this.spans.get(key);
          if (!v) {
            if (this.spans.size > 200) this.spans.clear();
            v = Array.from({ length: 49 }, (_, i) => m.pos(body, ep.sr.jdUt + (ep.sd.jdUt - ep.sr.jdUt) * i / 48));
            this.spans.set(key, v);
          }
          return v.map(p => this.XY(p));
        };
        this.poly(span(b), rgba(pal.retro, .55), 3);
        this.poly(span('earth'), rgba(pal.retro, .4), 3);
        for (const st of [ep.sr, ep.sd]) {
          const col = st.kind === 'SR' ? pal.retro : pal.direct;
          const Es = m.pos('earth', st.jdUt), Ps = m.pos(b, st.jdUt);
          // frozen sight lines at the stations: only when few planets are shown, or the plate clutters
          if (s.sight && vis.length <= 3) this.poly(this.sightLine(Es, st.lon, R_IN * U), rgba(col, .25), 1);
          const [px, py] = this.XY(Ps), [ex, ey] = this.XY(Es);
          this.disc(px, py, 4.5, null, rgba(col, .9)); this.disc(ex, ey, 4.5, null, rgba(col, .6));
          const off = this.away([px, py], 13);
          this.text(st.kind === 'SR' ? '℞' : 'D', off[0], off[1], col, `600 ${gsz * .7}px ${this.font}`);
          this.line(this.P(R_BAND_IN * U, st.lon), this.P((R_BAND_IN - .07) * U, st.lon), col, 2);
        }
      }
    }

    if (s.show.venus && s.decagram) {
      this.helioStar(m, t, m.midRetro('venus', t), pal.venus);
      this.helioStar(m, t, m.behindSun('venus', t), pal.superior);
    }
    if (s.show.venus && s.inferior) this.pentagram(m, t, m.midRetro('venus', t), pal.venus, true);
    if (s.show.venus && s.superior) this.pentagram(m, t, m.behindSun('venus', t), pal.superior, false);

    // apparent tracks: a time spiral in each lane (outer edge = now, older sinks inward)
    c.lineCap = 'round';
    const lw = (LANES_OUT - LANES_IN) / Math.max(1, vis.length);
    vis.forEach((b, li) => {
      const rIn = LANES_IN + li * lw + Math.min(.008, lw * .1), rOut = LANES_IN + (li + 1) * lw;
      // fewer samples for the slow outer planets, whose tracks are smoother
      const win = synodicDays(b), N = isInner(b) ? 420 : b === 'mars' ? 300 : 160;
      const step = win / N, base = Math.floor(t / step) * step;
      let prev: XYp | null = null;
      const segs: { k: string; a: XYp; b: XYp }[] = [];
      for (let i = -1; i <= N; i++) {
        const tt = i < 0 ? t : base - i * step, f = (t - tt) / win;
        const pt = this.P((rOut - (rOut - rIn) * f) * U, m.geoLon(b, tt)), retro = m.rate(b, tt) < 0;
        // the fade with age is quantised into 12 steps so segments can share a path
        if (prev) segs.push({ k: (retro ? 'r' : 'd') + Math.min(11, Math.floor(f * 12)), a: prev, b: pt });
        prev = pt;
      }
      OrreryPlate.batched(c, segs, k => {
        const retro = k[0] === 'r', f = (+k.slice(1) + .5) / 12;
        c.strokeStyle = rgba(retro ? pal.retro : pal[b], (1 - .82 * f) * (retro ? 1 : .8));
        c.lineWidth = retro ? 2.2 : 1.4;
      });
      for (const st of m.stations(b, t)) {
        if (st.jdUt > t || st.jdUt < t - win) continue;
        const f = (t - st.jdUt) / win, [x, y] = this.P((rOut - (rOut - rIn) * f) * U, st.lon);
        this.disc(x, y, 3.2, pal.night, st.kind === 'SR' ? pal.retro : pal.direct);
      }
      // head of the spiral; with Earth centred, the sight line's dot on the ecliptic already marks it
      if (!(s.view === 'earth' && s.sight)) {
        const [x, y] = this.P(rOut * U, m.geoLon(b, t)); this.disc(x, y, 4, pal[b], pal.night);
      }
    });

    { const [x, y] = this.P(R_BAND_IN * U - 3, sunLon); this.disc(x, y, 3.5, pal.brass); }

    // sight lines from Earth to the ecliptic, ending in a dot at the planet's apparent longitude
    if (s.sight) for (const b of vis) {
      const pts = this.sightLine(E, m.geoLon(b, t), R_BAND_IN * U), end = pts.at(-1)!;
      this.poly(pts, rgba(pal[b], .6), 1.1);
      this.disc(end[0], end[1], 4, pal[b], pal.night);
    }

    const sg = c.createRadialGradient(O[0], O[1], 0, O[0], O[1], 22);
    sg.addColorStop(0, pal.sun[0]); sg.addColorStop(.3, pal.sun[1]); sg.addColorStop(1, pal.sun[2]);
    c.fillStyle = sg; c.beginPath(); c.arc(O[0], O[1], 22, 0, 7); c.fill();
    this.disc(O[0], O[1], 6.5, pal.sunCore);
    drawGlyph(c, BODY_GLYPHS.sun, O[0] + 17, O[1] + 17, gsz * .85, pal.brass, s.glyphStyle, pal.night);

    s.pulses.splice(0, s.pulses.length, ...s.pulses.filter(p => now - p.at < 1800));
    for (const p of s.pulses) {
      const age = (now - p.at) / 1800, [x, y] = this.XY(p.xy);
      c.strokeStyle = rgba(p.color, 1 - age); c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6 + 26 * age, 0, 7); c.stroke();
      if (p.earth) this.poly(this.seg([0, 0], p.earth, 12), rgba(p.color, .8 * (1 - age)), 2);
      this.text(p.label, x, y - 18 - 10 * age, rgba(p.color, 1 - age * .8), `500 ${Math.max(11, gsz * .6)}px ${this.font}`);
    }

    for (const b of [...vis, 'earth'] as OrreryBody[]) {
      const [x, y] = this.XY(m.pos(b, t)), r = SIZE[b];
      const glow = c.createRadialGradient(x, y, 0, x, y, r * 2.6);
      glow.addColorStop(0, rgba(pal[b], .45)); glow.addColorStop(1, rgba(pal[b], 0));
      c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill();
      const retro = b !== 'earth' && m.rate(b, t) < 0;
      this.disc(x, y, r, pal[b], retro ? pal.retro : pal.night);
      if (b === 'saturn') { // a ring, so Saturn reads at a glance
        c.strokeStyle = pal[b]; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y, r * 1.9, r * .7, -.35, 0, 7); c.stroke();
      }
      const [gx, gy] = this.away([x, y], r + 13);
      drawGlyph(c, glyphOf(b), gx, gy, gsz, pal[b], s.glyphStyle, pal.night);
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

  draw(m: OrreryModel, jd: number, show: Record<Planet, boolean>, style: GlyphStyle, theme: 'dark' | 'light') {
    const c = this.ctx, { w, h } = this, pal = paletteFor(theme);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const padL = 34, padR = 8, padT = 6, padB = 22, iw = w - padL - padR, ih = h - padT - padB;
    const t0 = jd - 520, t1 = jd + 130;
    const X = (tt: number) => padL + (tt - t0) / (t1 - t0) * iw, Y = (l: number) => padT + ih - l / 360 * ih;
    c.fillStyle = pal.sky; c.fillRect(0, 0, w, h);
    for (let s = 0; s < 12; s++) {
      if (s % 2) { c.fillStyle = rgba(pal.ink, .03); c.fillRect(padL, Y((s + 1) * 30), iw, ih / 12); }
      c.strokeStyle = rgba(pal.brass, .14); c.lineWidth = 1;
      c.beginPath(); c.moveTo(padL, Y(s * 30)); c.lineTo(padL + iw, Y(s * 30)); c.stroke();
      drawGlyph(c, SIGN_GLYPHS_SVG[s]!, padL - 15, Y(s * 30 + 15), Math.min(14, ih / 12 - 2), rgba(pal.brass, .85), style, null);
    }
    c.font = `10px ${this.font}`; c.textBaseline = 'top'; c.textAlign = 'center';
    const d0 = dateOfJd(t0);
    let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1;
    for (let i = 0; i < 30; i++) {
      if (mo > 11) { mo = 0; y++; }
      const tt = Date.UTC(y, mo, 1) / 86400000 + 2440587.5;
      if (tt > t1) break;
      const x = X(tt);
      c.strokeStyle = mo === 0 ? rgba(pal.brass, .3) : rgba(pal.muted, .12);
      c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + ih); c.stroke();
      if (mo % 2 === 0) { c.fillStyle = mo === 0 ? pal.brass : pal.muted; c.fillText(mo === 0 ? String(y) : MONTHS[mo]!, x, padT + ih + 5); }
      mo++;
    }
    const plot = (fn: (t: number) => number, color: string, retro: ((t: number) => boolean) | null, width: number, step = .5) => {
      let prev: { l: number; x: number; y: number } | null = null;
      const start = Math.floor(t0 / step) * step;
      // four styles (past/future × direct/retrograde), each stroked as one path
      const paths: Record<string, [number, number, number, number][]> = {};
      for (let tt = start; tt <= t1 + step; tt += step) {
        const l = fn(tt), x = X(tt), yy = Y(l);
        if (prev && Math.abs(l - prev.l) < 180) {
          const k = (tt > jd ? 'f' : 'p') + (retro?.(tt) ? 'r' : 'd');
          (paths[k] ??= []).push([prev.x, prev.y, x, yy]);
        }
        prev = { l, x, y: yy };
      }
      for (const [k, segs] of Object.entries(paths)) {
        const r = k[1] === 'r';
        c.strokeStyle = k[0] === 'f' ? rgba(r ? pal.retro : color, .35) : (r ? pal.retro : color);
        c.lineWidth = r ? width + 1.6 : width;
        c.beginPath();
        for (const [a, b2, x, y2] of segs) { c.moveTo(a, b2); c.lineTo(x, y2); }
        c.stroke();
      }
    };
    plot(t => m.sunLon(t), rgba(pal.brass, .7), null, 1);
    for (const b of PLANETS_IN_ORDER.filter(x => show[x])) {
      plot(t => m.geoLon(b, t), pal[b], t => m.rate(b, t) < 0, 1.3, isInner(b) ? .5 : b === 'mars' ? 1 : 2);
      for (const st of m.stations(b, jd)) {
        if (st.jdUt < t0 || st.jdUt > t1) continue;
        const x = X(st.jdUt), yy = Y(st.lon), col = st.kind === 'SR' ? pal.retro : pal.direct;
        c.globalAlpha = st.jdUt > jd ? .5 : 1;
        c.beginPath(); c.arc(x, yy, 3.2, 0, 7); c.fillStyle = pal.sky; c.fill(); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
        c.font = `600 11px ${this.font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col;
        c.fillText(st.kind === 'SR' ? '℞' : 'D', x, yy + (st.kind === 'SR' ? -11 : 11));
        c.globalAlpha = 1;
      }
      const x = X(jd), yy = Y(m.geoLon(b, jd));
      c.beginPath(); c.arc(x, yy, 4, 0, 7); c.fillStyle = pal[b]; c.fill();
    }
    c.strokeStyle = rgba(pal.ink, .5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(jd), padT); c.lineTo(X(jd), padT + ih); c.stroke();
    c.font = `10px ${this.font}`; c.fillStyle = pal.ink; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText('now', X(jd) + 4, padT + 2);
  }
}
