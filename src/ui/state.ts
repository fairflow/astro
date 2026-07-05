import type { SavedPlace, TimeAccuracy } from '../store/db.js';

export interface FormState {
  name: string;
  date: string;
  time: string;
  accuracy: TimeAccuracy;
  place: SavedPlace | null;
}

export interface ChartMeta extends Omit<FormState, 'place'> {
  place: SavedPlace;
  offsetMinutes: number;
}

export interface DisplaySettings {
  /** Multiplies wheel glyph sizes. */
  glyphScale: number;
  /** Glyph stroke weight on the 100-unit grid. */
  weight: number;
  /** Glyph slant (italic) in degrees. */
  slant: number;
  /** High-contrast theme. */
  contrast: boolean;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  glyphScale: 1.25, weight: 7, slant: 0, contrast: false,
};

const DISPLAY_KEY = 'astro-display';

export function loadDisplay(): DisplaySettings {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY);
    if (raw) return { ...DEFAULT_DISPLAY, ...JSON.parse(raw) as Partial<DisplaySettings> };
  } catch { /* fresh defaults */ }
  return { ...DEFAULT_DISPLAY };
}

export function storeDisplay(d: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d));
  } catch { /* private mode etc. */ }
}
