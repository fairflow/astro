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
  /** Contrast level — independent of theme; 'high' is as strong as
   *  possible while colours remain distinguishable. */
  contrast: 'low' | 'medium' | 'high';
  /** Skin override: 'auto' = theme system; 'bw' = black-on-white print. */
  skin: 'auto' | 'bw';
  /** Multiplies text sizes (wheel labels and reading panels). */
  textScale: number;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  glyphScale: 1.25, weight: 7, slant: 0, theme: 'dark', contrast: 'low',
  skin: 'auto', textScale: 1,
};

const DISPLAY_KEY = 'astro-display';

export function loadDisplay(): DisplaySettings {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY);
    if (raw) {
      // migration chain: contrast boolean (v1) -> theme 'hc' (v2)
      //   -> hc boolean (v3) -> contrast level string (v4, current)
      type Stored = Partial<Omit<DisplaySettings, 'theme' | 'contrast'>> & {
        contrast?: boolean | DisplaySettings['contrast'];
        theme?: 'dark' | 'hc' | 'light';
        hc?: boolean;
      };
      const { contrast: c, theme: t, hc, ...rest } = JSON.parse(raw) as Stored;
      const contrast: DisplaySettings['contrast'] =
        c === 'low' || c === 'medium' || c === 'high' ? c
          : (c === true || t === 'hc' || hc === true) ? 'medium' : 'low';
      const theme: DisplaySettings['theme'] = t === 'light' ? 'light' : 'dark';
      return { ...DEFAULT_DISPLAY, ...(rest as Partial<DisplaySettings>), theme, contrast };
    }
  } catch { /* fresh defaults */ }
  return { ...DEFAULT_DISPLAY };
}

export function storeDisplay(d: DisplaySettings): void {
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d));
  } catch { /* private mode etc. */ }
}
