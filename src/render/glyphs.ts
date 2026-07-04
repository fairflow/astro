import { BodyKey, normDeg } from '../ephemeris/types.js';
import type { AspectName } from '../chart/aspects.js';

/** U+FE0E forces text presentation (no emoji) for sign/planet glyphs. */
export const VS = '︎';

export const BODY_GLYPH: Record<BodyKey, string> = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃',
  saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
  chiron: '⚷', ceres: '⚳', pallas: '⚴', juno: '⚵', vesta: '⚶', eris: '⯰',
  meanNode: '☊', lilith: '⚸',
};

export const BODY_NAME: Record<BodyKey, string> = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  pluto: 'Pluto', chiron: 'Chiron', ceres: 'Ceres', pallas: 'Pallas',
  juno: 'Juno', vesta: 'Vesta', eris: 'Eris', meanNode: 'N Node',
  lilith: 'Lilith',
};

export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
/** fire, earth, air, water repeating from Aries. */
export const SIGN_ELEMENT = [
  'fire', 'earth', 'air', 'water', 'fire', 'earth',
  'air', 'water', 'fire', 'earth', 'air', 'water',
];

export const ASPECT_GLYPH: Record<AspectName, string> = {
  conjunction: '☌', sextile: '⚹', square: '□', trine: '△',
  quincunx: '⚻', opposition: '☍',
};

/** CSS custom property (without var()) used for each aspect's colour. */
export const ASPECT_COLOR: Record<AspectName, string> = {
  conjunction: '--conj', sextile: '--sextile', square: '--square',
  trine: '--trine', quincunx: '--quincunx', opposition: '--opp',
};

export function signIndex(lon: number): number {
  return Math.floor(normDeg(lon) / 30);
}

/** "17°30′ ♓ Pisces" */
export function fmtDegInSign(lon: number): string {
  const l = normDeg(lon);
  const s = signIndex(l);
  const within = l - s * 30;
  const d = Math.floor(within);
  const m = Math.round((within - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′ ${SIGN_GLYPHS[s]}${VS} ${SIGN_NAMES[s]}`;
}

/** "5°03′" */
export function fmtOrb(orb: number): string {
  const d = Math.floor(orb);
  const m = Math.round((orb - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′`;
}
