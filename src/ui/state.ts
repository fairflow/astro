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
  /** Aspect emphasis 0..1: raises line width, colour saturation and the
   *  minimum opacity of wide-orb aspects together. 0.5 = balanced default. */
  aspectEmphasis: number;
  /** Per-aspect colour overrides: CSS var name → hex. Applied inline over the
   *  palette (empty = palette defaults). Ignored while the B/W print skin is on. */
  aspectColors: Record<string, string>;
  /** Show the natal Moon-phase block in the reading panel. */
  showMoonPhase: boolean;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  glyphScale: 1.25, weight: 7, slant: 0, theme: 'dark', contrast: 'low',
  skin: 'auto', textScale: 1, aspectEmphasis: 0.5, aspectColors: {},
  showMoonPhase: true,
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
