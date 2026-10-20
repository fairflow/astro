import Dexie, { type EntityTable } from 'dexie';
import { newUid } from '../ai/readingstore.js';

export interface SavedPlace {
  name: string;
  country: string;
  lat: number;
  lon: number;
  zone: string;
}

export type TimeAccuracy = 'exact' | '5min' | '30min' | '2h' | 'unknown';

/**
 * Birth data is the source of truth; positions are recomputed on load so
 * ephemeris improvements propagate to old charts.
 */
/** Charts with no explicit set fall in this family. */
export const DEFAULT_SET = 'Unfiled';

export interface SavedChart {
  id?: number;
  name: string;
  date: string;      // YYYY-MM-DD (local civil date)
  time: string;      // HH:MM (local civil time)
  accuracy: TimeAccuracy;
  place: SavedPlace;
  notes?: string;
  /** Family/set this person belongs to (SolarFire-style grouping). */
  set?: string;
  createdAt: number;
  /** Last edit (ms); the later edit wins when charts sync (astro-ag1). */
  updatedAt?: number;
  /** The chart's identity on the server: a random UUID (older charts get one when sync first runs). */
  uid?: string;
  /** The account (email) it belongs to once uploaded; absent for a chart saved without signing in. */
  account?: string;
  /** The server holds this version. */
  synced?: boolean;
  /** Why the server refused it ('older' and 'full' are retried after the next pull). */
  refused?: string;
}

/** The sync bookkeeping fields, which are not birth data. */
export type ChartSyncFields = 'uid' | 'account' | 'synced' | 'refused' | 'updatedAt';

const listeners = new Set<(local: boolean) => void>();
/** Call `f` when saved charts change: `local` true for a change made here, false when sync brought one in. */
export function onChartsChange(f: (local: boolean) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
export function chartsChanged(local: boolean): void { for (const f of listeners) f(local); }

const DELETED_KEY = 'astro-charts-deleted';
/** Server ids of deleted charts, by account, that the server has yet to hear of. */
export function chartDeletionsPending(): Record<string, string[]> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(DELETED_KEY) ?? '{}');
    return v && typeof v === 'object' ? v as Record<string, string[]> : {};
  } catch { return {}; }
}
export function setChartDeletionsPending(d: Record<string, string[]>): void {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(d)); } catch { /* kept for this session only */ }
}

export const db = new Dexie('astro') as Dexie & {
  charts: EntityTable<SavedChart, 'id'>;
};

db.version(1).stores({
  charts: '++id, name, createdAt',
});
// v2: group charts into named sets/families. Backfill existing charts.
db.version(2).stores({
  charts: '++id, name, createdAt, set',
}).upgrade(tx => tx.table('charts').toCollection().modify(c => {
  if (!c.set) c.set = DEFAULT_SET;
}));

export async function listCharts(): Promise<SavedChart[]> {
  return db.charts.orderBy('createdAt').reverse().toArray();
}

/** Distinct set/family names present, sorted (DEFAULT_SET last). */
export function setsOf(charts: SavedChart[]): string[] {
  const names = [...new Set(charts.map(c => c.set || DEFAULT_SET))];
  return names.sort((a, b) =>
    a === DEFAULT_SET ? 1 : b === DEFAULT_SET ? -1 : a.localeCompare(b));
}

export async function saveChart(c: Omit<SavedChart, 'id' | 'createdAt' | ChartSyncFields>) {
  const now = Date.now();
  const id = await db.charts.add({ ...c, createdAt: now, updatedAt: now, uid: newUid() });
  chartsChanged(true);
  return id;
}

export async function deleteChart(id: number): Promise<void> {
  const c = await db.charts.get(id);
  // on the server already: the deletion goes there too
  if (c?.uid && c.account) {
    const d = chartDeletionsPending();
    d[c.account] = [...new Set([...(d[c.account] ?? []), c.uid])];
    setChartDeletionsPending(d);
  }
  await db.charts.delete(id);
  chartsChanged(true);
}

/** Move a saved person into another family/set (leaves birth data untouched). */
export async function moveChart(id: number, set: string): Promise<void> {
  await db.charts.update(id, { set, updatedAt: Date.now(), synced: false, refused: undefined });
  chartsChanged(true);
}

/** Edit a saved person in place (user request 2026-07-06 #3). */
export async function updateChart(
  id: number, c: Omit<SavedChart, 'id' | 'createdAt' | ChartSyncFields>,
): Promise<void> {
  await db.charts.update(id, { ...c, updatedAt: Date.now(), synced: false, refused: undefined });
  chartsChanged(true);
}
