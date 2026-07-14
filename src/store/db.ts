import Dexie, { type EntityTable } from 'dexie';

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

export async function saveChart(c: Omit<SavedChart, 'id' | 'createdAt'>) {
  return db.charts.add({ ...c, createdAt: Date.now() });
}

export async function deleteChart(id: number): Promise<void> {
  return db.charts.delete(id);
}

/** Move a saved person into another family/set (leaves birth data untouched). */
export async function moveChart(id: number, set: string): Promise<void> {
  await db.charts.update(id, { set });
}

/** Edit a saved person in place (user request 2026-07-06 #3). */
export async function updateChart(
  id: number, c: Omit<SavedChart, 'id' | 'createdAt'>,
): Promise<void> {
  await db.charts.update(id, { ...c });
}
