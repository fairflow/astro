import { DEFAULT_PRESET, isPreset, type AiPresetId } from './config.js';

/**
 * Per-device "Ask Claude" preferences shared by every panel: the chosen
 * model preset, and whether the panel is open or minimised (so minimising it
 * on one tab keeps it out of the way on all of them). Remembered in
 * localStorage; a blocked or empty store just falls back to the defaults.
 */
const PRESET_KEY = 'astro-ai-preset';
const OPEN_KEY = 'astro-ai-open';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

const hasStorage = typeof localStorage !== 'undefined';
const storedPreset = hasStorage ? read(PRESET_KEY) : null;

export const aiPrefs = $state<{ preset: AiPresetId; open: boolean }>({
  preset: isPreset(storedPreset) ? storedPreset : DEFAULT_PRESET,
  // minimised by default: it is prominent enough as a one-line bar
  open: hasStorage ? read(OPEN_KEY) === '1' : false,
});

export function setPreset(p: AiPresetId): void {
  aiPrefs.preset = p;
  write(PRESET_KEY, p);
}

export function setOpen(open: boolean): void {
  aiPrefs.open = open;
  write(OPEN_KEY, open ? '1' : '0');
}
