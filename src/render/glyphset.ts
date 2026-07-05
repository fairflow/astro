import type { BodyKey } from '../ephemeris/types.js';
import type { AspectName } from '../chart/aspects.js';

/**
 * The app's own SVG glyph kit: every symbol drawn stroke-based on a
 * 100×100 grid so weight (stroke-width), slant (italic) and size are
 * runtime-tunable, and rendering is identical on every platform.
 * Shapes follow conventional astrological forms without copying any
 * font's outlines.
 */

export interface GlyphStyle {
  /** Stroke width on the 100-unit grid (5 = light, 7 = regular, 10 = bold). */
  weight: number;
  /** Skew angle in degrees for an italic feel (0 = upright). */
  slant: number;
}

export const DEFAULT_GLYPH_STYLE: GlyphStyle = { weight: 7, slant: 0 };

export interface GlyphDef {
  /** SVG path data (stroked, not filled). */
  d: string;
  /** Filled dots: [cx, cy, r]. */
  dots?: [number, number, number][];
}

export const BODY_GLYPHS: Record<BodyKey, GlyphDef> = {
  sun: { d: 'M50 18 A32 32 0 1 1 49.9 18 Z', dots: [[50, 50, 7]] },
  moon: { d: 'M58 10 A40 40 0 1 0 58 90 A29 29 0 1 1 58 10' },
  mercury: {
    d: 'M50 30 A21 21 0 1 1 49.9 30 Z M50 72 V94 M38 83 H62 M31 8 A19 19 0 0 0 69 8',
  },
  venus: { d: 'M50 12 A25 25 0 1 1 49.9 12 Z M50 62 V94 M36 78 H64' },
  mars: {
    d: 'M42 36 A23 23 0 1 1 41.9 36 Z M58 42 L82 18 M60 18 H82 V40',
  },
  // "2"-with-crossbar form (the previous crossbar-and-curve version
  // read as the digit 4 in user test 1)
  jupiter: {
    d: 'M22 32 C22 12 52 10 55 27 C57 41 42 52 28 64 L24 68 H80 M62 46 V90',
  },
  saturn: {
    d: 'M40 10 V60 M28 24 H52 M40 44 C46 34 66 34 66 52 C66 66 56 70 52 78 C50 84 54 90 62 87',
  },
  uranus: {
    d: 'M30 12 V52 M70 12 V52 M30 32 H70 M50 52 V62 M50 62 A14 14 0 1 1 49.9 62 Z',
    dots: [[50, 76, 4]],
  },
  neptune: {
    d: 'M28 18 C28 44 36 54 50 54 C64 54 72 44 72 18 M50 14 V88 M36 76 H64 M22 26 L28 14 L34 26 M44 22 L50 10 L56 22 M66 26 L72 14 L78 26',
  },
  pluto: {
    d: 'M50 24 A11 11 0 1 1 49.9 24 Z M28 32 A22 22 0 0 0 72 32 M50 54 V88 M36 72 H64',
  },
  chiron: {
    d: 'M50 56 A17 17 0 1 1 49.9 56 Z M42 8 V56 M64 12 L42 32 L64 52',
  },
  ceres: {
    d: 'M64 14 A22 22 0 1 0 64 50 M50 54 V90 M37 73 H63',
  },
  pallas: { d: 'M50 12 L68 32 L50 52 L32 32 Z M50 52 V90 M37 72 H63' },
  juno: {
    d: 'M50 8 V52 M31 19 L69 41 M69 19 L31 41 M50 52 V90 M37 72 H63',
  },
  vesta: {
    d: 'M34 12 C42 30 58 30 66 12 M50 26 V50 M28 50 H72 M38 50 V70 M62 50 V70',
  },
  eris: { d: 'M50 10 V90 M36 72 L50 90 L64 72 M36 34 H64' },
  meanNode: {
    d: 'M36 78 C20 62 26 26 50 26 C74 26 80 62 64 78 M30 84 A7 7 0 1 1 29.9 84 Z M70 84 A7 7 0 1 1 69.9 84 Z',
  },
  lilith: {
    d: 'M56 10 A28 28 0 1 0 56 62 A19 19 0 1 1 56 10 M50 62 V90 M37 76 H63',
  },
};

export const SIGN_GLYPHS_SVG: GlyphDef[] = [
  // aries
  { d: 'M50 90 V40 C50 18 32 12 26 26 C21 38 30 48 38 52 M50 40 C50 18 68 12 74 26 C79 38 70 48 62 52' },
  // taurus
  { d: 'M50 34 A24 24 0 1 1 49.9 34 Z M24 12 C28 30 38 38 50 38 C62 38 72 30 76 12' },
  // gemini
  { d: 'M36 22 V78 M64 22 V78 M22 14 C36 26 64 26 78 14 M22 86 C36 74 64 74 78 86' },
  // cancer
  { d: 'M34 28 A12 12 0 1 1 33.9 28 Z M66 60 A12 12 0 1 1 65.9 60 Z M20 42 C18 24 42 12 70 18 M80 58 C82 76 58 88 30 82' },
  // leo
  { d: 'M32 62 A11 11 0 1 1 31.9 62 Z M40 66 C34 44 44 22 58 24 C70 26 66 42 62 54 C58 68 62 78 70 76 C76 74 78 68 78 64' },
  // virgo
  { d: 'M20 32 C24 24 32 26 32 36 V68 M32 40 C34 28 46 28 46 38 V68 M46 40 C48 28 60 28 60 38 V56 M60 42 C70 40 78 50 74 62 C70 76 58 82 50 84 M60 56 C60 72 66 78 74 74' },
  // libra
  { d: 'M22 80 H78 M22 62 H36 C32 46 40 32 50 32 C60 32 68 46 64 62 H78' },
  // scorpio
  { d: 'M18 32 C22 24 30 26 30 36 V64 M30 40 C32 28 44 28 44 38 V64 M44 40 C46 28 58 28 58 38 V60 C58 74 64 80 74 76 M74 76 L66 68 M74 76 L70 86' },
  // sagittarius
  { d: 'M24 76 L74 26 M52 24 H76 V48 M34 52 L48 66' },
  // capricorn
  { d: 'M18 30 L32 62 L46 28 C50 44 54 52 60 50 C54 58 52 66 58 72 C66 80 78 74 76 62 C74 52 62 52 58 60' },
  // aquarius
  { d: 'M20 42 L32 30 L44 42 L56 30 L68 42 L80 30 M20 68 L32 56 L44 68 L56 56 L68 68 L80 56' },
  // pisces
  { d: 'M32 16 C48 32 48 68 32 84 M68 16 C52 32 52 68 68 84 M30 50 H70' },
];

export const ASPECT_GLYPHS_SVG: Record<AspectName, GlyphDef> = {
  conjunction: { d: 'M40 60 A20 20 0 1 1 39.9 60 Z M54 46 L80 20' },
  sextile: { d: 'M50 14 V86 M19 32 L81 68 M81 32 L19 68' },
  square: { d: 'M24 24 H76 V76 H24 Z' },
  trine: { d: 'M50 18 L80 76 H20 Z' },
  quincunx: { d: 'M24 32 H76 M24 32 L50 76 L76 32' },
  opposition: {
    d: 'M32 44 A13 13 0 1 1 31.9 44 Z M68 30 A13 13 0 1 1 67.9 30 Z M42 48 L58 34',
  },
};

/** Symbol id used in <use href="#..."> references. */
export function bodyGlyphId(body: BodyKey): string { return `g-b-${body}`; }
export function signGlyphId(i: number): string { return `g-s-${i}`; }
export function aspectGlyphId(name: AspectName): string { return `g-a-${name}`; }
