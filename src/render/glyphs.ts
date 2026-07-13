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

/** cardinal, fixed, mutable repeating from Aries. */
export const SIGN_MODALITY = [
  'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable',
  'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable',
];

/** Modern sign rulers, Aries..Pisces. */
export const SIGN_RULER: BodyKey[] = [
  'mars', 'venus', 'mercury', 'moon', 'sun', 'mercury',
  'venus', 'pluto', 'jupiter', 'saturn', 'uranus', 'neptune',
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

/** Aspect colour families, in a sensible picker order (var + human label). */
export const ASPECT_FAMILIES: { var: string; label: string }[] = [
  { var: '--trine', label: 'Trine' },
  { var: '--sextile', label: 'Sextile' },
  { var: '--square', label: 'Square' },
  { var: '--opp', label: 'Opposition' },
  { var: '--conj', label: 'Conjunction' },
  { var: '--quincunx', label: 'Quincunx' },
];

export function signIndex(lon: number): number {
  return Math.floor(normDeg(lon) / 30);
}

/** "17°30′ ♓ Pisces" */
export function fmtDegInSign(lon: number): string {
  // round to whole arc-minutes first so 23°59.6′ carries to 24°00′ (never x°60′),
  // rolling into the next sign (or past 360°) when the boundary is crossed
  const totalMin = Math.round(normDeg(lon) * 60) % (360 * 60);
  const s = Math.floor(totalMin / (30 * 60));
  const within = totalMin - s * 30 * 60;
  const d = Math.floor(within / 60);
  const m = within % 60;
  return `${d}°${String(m).padStart(2, '0')}′ ${SIGN_GLYPHS[s]}${VS} ${SIGN_NAMES[s]}`;
}

/** "5°03′" */
export function fmtOrb(orb: number): string {
  const totalMin = Math.round(orb * 60);
  const d = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${d}°${String(m).padStart(2, '0')}′`;
}
