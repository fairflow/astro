import type { SavedPlace } from './db.js';

/** Compact offline place index built by tools/make_gazetteer.py. */
export interface Gazetteer {
  attribution: string;
  zones: string[];
  /** [name, country, lat, lon, zoneIndex], sorted by population desc. */
  cities: [string, string, number, number, number][];
}

export async function fetchGazetteer(url = '/gazetteer.json'): Promise<Gazetteer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gazetteer: HTTP ${res.status}`);
  return await res.json() as Gazetteer;
}

/**
 * Case-insensitive search; prefix matches rank before substring matches,
 * population order (the file order) breaks ties.
 */
export function searchPlaces(g: Gazetteer, query: string, limit = 8): SavedPlace[] {
  const q = query.toLowerCase();
  const prefix: SavedPlace[] = [];
  const inner: SavedPlace[] = [];
  for (const [name, country, lat, lon, zi] of g.cities) {
    const n = name.toLowerCase();
    const hit = n.startsWith(q) ? prefix : n.includes(q) ? inner : null;
    if (hit) {
      hit.push({ name, country, lat, lon, zone: g.zones[zi]! });
      if (prefix.length >= limit) break;
    }
  }
  return [...prefix, ...inner].slice(0, limit);
}
