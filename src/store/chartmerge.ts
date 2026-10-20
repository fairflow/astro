import type { SavedChart, SavedPlace, TimeAccuracy } from './db.js';

/**
 * The pure parts of chart sync (astro-ag1): which charts go up, what they
 * carry, and how the server's rows fold into this browser's list. Charts can
 * be edited, so the later edit (updatedAt) wins.
 */

/** Birth data: what a chart is on the server. */
export interface ChartData {
  name: string; date: string; time: string; accuracy: TimeAccuracy; place: SavedPlace; notes?: string; set?: string;
}
export interface ServerChart { id: string; data: ChartData; createdAt: number; updatedAt: number }
export type ServerChartRow = ServerChart | { id: string; deleted: true };

const edited = (c: SavedChart): number => c.updatedAt ?? c.createdAt;

/** Charts to upload for `account`: changed here, made here without an account or already this account's. */
export function chartsToUpload(list: SavedChart[], account: string): SavedChart[] {
  return list.filter(c => !c.synced && c.uid
    && (c.refused === undefined || c.refused === 'full' || c.refused === 'older')
    && (c.account === undefined || c.account === account));
}

export function chartPayload(c: SavedChart): ServerChart {
  const p = c.place;
  return {
    id: c.uid!, createdAt: c.createdAt, updatedAt: edited(c),
    data: {
      name: c.name, date: c.date, time: c.time, accuracy: c.accuracy,
      place: { name: p.name, country: p.country, lat: p.lat, lon: p.lon, zone: p.zone },
      ...(c.notes !== undefined ? { notes: c.notes } : {}), ...(c.set !== undefined ? { set: c.set } : {}),
    },
  };
}

/**
 * What to change locally for rows pulled from `account`: charts to write
 * (keeping the local id of one already here) and local ids to remove. A local
 * edit newer than the server's is kept (it goes up next); charts being deleted
 * here are skipped.
 */
export function planPull(
  list: SavedChart[], rows: ServerChartRow[], account: string, deleting: Set<string>,
): { put: SavedChart[]; remove: number[] } {
  const byUid = new Map(list.filter(c => c.uid).map(c => [c.uid!, c]));
  const put: SavedChart[] = [];
  const remove: number[] = [];
  for (const row of rows) {
    const local = byUid.get(row.id);
    if ('deleted' in row) { if (local?.id !== undefined) remove.push(local.id); continue; }
    if (deleting.has(row.id)) continue;
    if (local && !local.synced && edited(local) > row.updatedAt) continue;
    put.push({
      ...(local?.id !== undefined ? { id: local.id } : {}),
      ...row.data, createdAt: row.createdAt, updatedAt: row.updatedAt, uid: row.id, account, synced: true,
    });
  }
  return { put, remove };
}
