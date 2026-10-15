import { isPreset, type AiPresetId } from './config.js';

/**
 * Pure helpers for saved "Ask Claude" readings (kept in this browser's
 * localStorage; see readings.svelte.ts for the reactive store). No DOM or
 * Svelte here, so the parsing and quota handling are unit-testable.
 */

export type ReadingTab =
  'natal' | 'transits' | 'couple-transits' | 'synastry' | 'composite' | 'orrery';

export interface SavedReading {
  id: number;
  /** Exact context (tab + people [+ transit date]); its latest reading is restored. */
  key: string;
  /** Wider context (tab + people) for the panel's "Saved readings" list. */
  group: string;
  tab: ReadingTab;
  /** Human label, e.g. "Synastry · Matthew × Benita". */
  title: string;
  question: string;
  preset: AiPresetId;
  /** Whether names and places were hidden in what was sent. */
  anonymised: boolean;
  text: string;
  /** True if stopped before the end (a partial reading). */
  stopped: boolean;
  createdAt: number;
}

/** Stable identity for a person in reading keys: name plus birth date. */
export const who = (name: string, date: string): string =>
  `${name.trim() || 'unnamed'}@${date}`;

const TABS: ReadingTab[] = ['natal', 'transits', 'couple-transits', 'synastry', 'composite', 'orrery'];

function isSavedReading(v: unknown): v is SavedReading {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'number' && typeof r.key === 'string' && typeof r.group === 'string'
    && TABS.includes(r.tab as ReadingTab) && typeof r.title === 'string'
    && typeof r.question === 'string' && isPreset(r.preset)
    && typeof r.anonymised === 'boolean' && typeof r.text === 'string'
    && typeof r.stopped === 'boolean' && typeof r.createdAt === 'number';
}

/** Parse the stored list, newest first; anything malformed is dropped, never thrown. */
export function parseSaved(raw: string | null): SavedReading[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter(isSavedReading).sort((a, b) => b.createdAt - a.createdAt)
      : [];
  } catch {
    return [];
  }
}

const isQuota = (e: unknown): boolean =>
  typeof DOMException !== 'undefined' && e instanceof DOMException
  && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/**
 * Store `list` (newest first) with `setItem`. On a quota error, drop the
 * oldest fifth and retry until it fits. Any other failure (storage blocked,
 * private mode) leaves the list untouched: the readings still show for this
 * session. Returns the list as it should now stand in memory.
 */
export function writeWithPruning(
  list: SavedReading[], setItem: (value: string) => void,
): SavedReading[] {
  let cur = list;
  for (;;) {
    try {
      setItem(JSON.stringify(cur));
      return cur;
    } catch (e) {
      if (!isQuota(e) || cur.length <= 1) return cur;
      cur = cur.slice(0, Math.max(1, Math.floor(cur.length * 0.8)));
    }
  }
}
