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
  /** Saved mid-stream and never finished: the page was closed or reloaded
   *  while Claude was still writing. Absent once a reading completes. */
  interrupted?: boolean;
  /** The reading's identity on the server (astro-cbi): a random UUID. Older
   *  readings get one when first loaded. */
  uid?: string;
  /** The account (email) this reading belongs to once uploaded; absent for a
   *  reading made without signing in, which goes to the next account signed in here. */
  account?: string;
  /** The server holds this version of the reading. */
  synced?: boolean;
  /** Why the server refused it (not retried; 'full' is retried). */
  refused?: string;
}

/** The fields a reading travels with to and from the server. */
export interface ServerReading {
  id: string; key: string; group: string; tab: ReadingTab; title: string; question: string;
  preset: string; anonymised: boolean; text: string; stopped: boolean; interrupted?: boolean;
  createdAt: number;
}
export type ServerRow = ServerReading | { id: string; deleted: true };

/** A random UUID (crypto.randomUUID where available). */
export function newUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Readings to upload for `account`: not yet on the server, not refused, not
 *  still streaming in this page, and either made here without an account or already this account's. */
export function toUpload(list: SavedReading[], account: string, streaming: Set<number>): SavedReading[] {
  return list.filter(r => !r.synced && !streaming.has(r.id) && r.uid && (r.refused === undefined || r.refused === 'full')
    && (r.account === undefined || r.account === account));
}

export const asServer = (r: SavedReading): ServerReading => ({
  id: r.uid!, key: r.key, group: r.group, tab: r.tab, title: r.title, question: r.question,
  preset: r.preset, anonymised: r.anonymised, text: r.text, stopped: r.stopped,
  ...(r.interrupted ? { interrupted: true } : {}), createdAt: r.createdAt,
});

/**
 * Fold rows pulled from `account`'s server copy into the local list (newest
 * first, at most `max`): new readings are added, changed ones replaced (keeping
 * the local id), deleted ones removed. Rows the browser is about to delete
 * (`deleting`) are skipped, and so are rows whose preset this app no longer knows.
 */
export function mergePulled(
  list: SavedReading[], rows: ServerRow[], account: string, deleting: Set<string>, max: number,
): SavedReading[] {
  const byUid = new Map(list.filter(r => r.uid).map(r => [r.uid!, r]));
  const ids = new Set(list.map(r => r.id));
  for (const row of rows) {
    if ('deleted' in row) { byUid.delete(row.id); continue; }
    if (deleting.has(row.id) || !isPreset(row.preset) || !TABS.includes(row.tab)) continue;
    const old = byUid.get(row.id);
    let id = old?.id ?? row.createdAt;
    if (!old) { while (ids.has(id)) id++; ids.add(id); }
    const r: SavedReading = {
      id, key: row.key, group: row.group, tab: row.tab, title: row.title, question: row.question,
      preset: row.preset, anonymised: row.anonymised, text: row.text, stopped: row.stopped,
      createdAt: row.createdAt, uid: row.id, account, synced: true,
      ...(row.interrupted ? { interrupted: true } : {}),
    };
    byUid.set(row.id, r);
  }
  const merged = [...list.filter(r => !r.uid), ...byUid.values()];
  return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
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
    && typeof r.stopped === 'boolean' && typeof r.createdAt === 'number'
    && (r.interrupted === undefined || typeof r.interrupted === 'boolean')
    && (r.uid === undefined || typeof r.uid === 'string')
    && (r.account === undefined || typeof r.account === 'string');
}

/** `r` first, replacing any reading with the same id; at most `max` kept. */
export function upsertReading(list: SavedReading[], r: SavedReading, max: number): SavedReading[] {
  return [r, ...list.filter(x => x.id !== r.id)].slice(0, max);
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
