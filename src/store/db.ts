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
export interface SavedChart {
  id?: number;
  name: string;
  date: string;      // YYYY-MM-DD (local civil date)
  time: string;      // HH:MM (local civil time)
  accuracy: TimeAccuracy;
  place: SavedPlace;
  notes?: string;
  createdAt: number;
}

export const db = new Dexie('astro') as Dexie & {
  charts: EntityTable<SavedChart, 'id'>;
};

db.version(1).stores({
  charts: '++id, name, createdAt',
});

export async function listCharts(): Promise<SavedChart[]> {
  return db.charts.orderBy('createdAt').reverse().toArray();
}

export async function saveChart(c: Omit<SavedChart, 'id' | 'createdAt'>) {
  return db.charts.add({ ...c, createdAt: Date.now() });
}

export async function deleteChart(id: number): Promise<void> {
  return db.charts.delete(id);
}
