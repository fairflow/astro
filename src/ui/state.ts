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
  theme: 'dark' | 'light';
  /** High contrast — an independent axis, applies to either theme. */
  hc: boolean;
  /** Multiplies text sizes (wheel labels and reading panels). */
  textScale: number;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  glyphScale: 1.25, weight: 7, slant: 0, theme: 'dark', hc: false, textScale: 1,
};

const DISPLAY_KEY = 'astro-display';

export function loadDisplay(): DisplaySettings {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY);
    if (raw) {
      type Stored = Partial<Omit<DisplaySettings, 'theme'>>
        & { contrast?: boolean; theme?: 'dark' | 'hc' | 'light' };
      const saved = JSON.parse(raw) as Stored;
      // migrate the old boolean high-contrast flag, then the interim 'hc' theme
      if (saved.theme === undefined && saved.contrast !== undefined) {
        saved.theme = saved.contrast ? 'hc' : 'dark';
      }
      delete saved.contrast;
      if (saved.theme === 'hc') {
        saved.theme = 'dark';
        saved.hc = true;
      }
      return { ...DEFAULT_DISPLAY, ...(saved as Partial<DisplaySettings>) };
    }
  } catch { /* fresh defaults */ }
  return { ...DEFAULT_DISPLAY };
}

export function storeDisplay(d: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d));
  } catch { /* private mode etc. */ }
}
