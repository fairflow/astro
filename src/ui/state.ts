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
  /** Colour theme. */
  theme: 'dark' | 'hc' | 'light';
  /** Multiplies text sizes (wheel labels and reading panels). */
  textScale: number;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  glyphScale: 1.25, weight: 7, slant: 0, theme: 'dark', textScale: 1,
};

const DISPLAY_KEY = 'astro-display';

export function loadDisplay(): DisplaySettings {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DisplaySettings> & { contrast?: boolean };
      // migrate the old boolean high-contrast flag to the theme field
      if (saved.theme === undefined && saved.contrast !== undefined) {
        saved.theme = saved.contrast ? 'hc' : 'dark';
      }
      delete saved.contrast;
      return { ...DEFAULT_DISPLAY, ...saved };
    }
  } catch { /* fresh defaults */ }
  return { ...DEFAULT_DISPLAY };
}

export function storeDisplay(d: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d));
  } catch { /* private mode etc. */ }
}
