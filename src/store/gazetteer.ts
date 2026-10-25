import type { SavedPlace } from './db.js';

/**
 * Offline place index built by tools/make_gazetteer.py from GeoNames cities500
 * (astro-brv). gazetteer.json holds the places of 15,000 people or more; every
 * smaller one is in places/<key>.json, fetched only when a search starts with
 * that key (its first two folded letters, or three for the prefixes in `split`).
 */
export type PlaceRow = [name: string, country: string, lat: number, lon: number,
  zone: number, region: number, county: string, alt?: string];

export interface Gazetteer {
  attribution: string;
  zones: string[];
  /** Region (GeoNames admin1) names; 0 is "". */
  regions: string[];
  /** Prefixes whose smaller places are filed by three letters, not two. */
  split: string[];
  /** Sorted by population, largest first. */
  cities: PlaceRow[];
}

/** A search result: a place to save, and its county and region to tell same-named places apart. */
export interface PlaceHit extends SavedPlace {
  region: string;
  /** GeoNames admin2 (a county, a département); "" when none or the place's own name. */
  county: string;
  /** Set for a place made from typed coordinates: the listed place its time zone came from. */
  near?: string;
}

export async function fetchGazetteer(url = 'gazetteer.json'): Promise<Gazetteer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gazetteer: HTTP ${res.status}`);
  const g = await res.json() as Partial<Gazetteer>;
  // an older file (cities15000) had no regions or split
  return { attribution: g.attribution ?? '', zones: g.zones ?? [], regions: g.regions ?? [''],
    split: g.split ?? [], cities: g.cities ?? [] };
}

// Letters NFD does not decompose (keep in step with FOLD in tools/make_gazetteer.py).
const FOLD: Record<string, string> = {
  'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'đ': 'd', 'ð': 'd',
  'þ': 'th', 'ı': 'i', 'ħ': 'h', 'ŀ': 'l', 'ŧ': 't',
};

/** A name as the index compares it: no accents or case, only a-z and 0-9 ("Zürich" → "zurich"). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[łøæœßđðþıħŀŧ]/g, c => FOLD[c]!).replace(/[^a-z0-9]/g, '');
}

/** The places/ file for a folded query, or null when it needs one more letter first. */
export function shardKey(q: string, split: readonly string[]): string | null {
  if (q.length < 2) return null;
  const k2 = q.slice(0, 2);
  if (!split.includes(k2)) return k2;
  return q.length >= 3 ? q.slice(0, 3) : null;
}

const shards = new Map<string, Promise<PlaceRow[]>>();

/** The smaller places filed under `key` (cached; [] when there are none). */
export function loadShard(key: string, base = 'places/'): Promise<PlaceRow[]> {
  let p = shards.get(key);
  if (!p) {
    p = fetch(`${base}${key}.json`)
      .then(r => (r.ok ? r.json() as Promise<{ cities: PlaceRow[] }> : { cities: [] }))
      .then(j => j.cities)
      .catch(() => { shards.delete(key); return []; });
    shards.set(key, p);
  }
  return p;
}

const folded = new WeakMap<PlaceRow[], string[][]>();
/** Folded name (and alt) per row, computed once per list. */
function foldedNames(rows: PlaceRow[]): string[][] {
  let f = folded.get(rows);
  if (!f) {
    f = rows.map(r => (r[7] ? [fold(r[0]), fold(r[7])] : [fold(r[0])]));
    folded.set(rows, f);
  }
  return f;
}

/**
 * Search the larger places and, if given, the smaller ones of the query's
 * file. "Newport, Wales" narrows by region, "Newport, Pembrokeshire" by county,
 * "Newport, GB" by country code.
 * Names starting with the query rank first, larger places first; then names
 * containing it.
 */
export function searchPlaces(g: Gazetteer, query: string, limit = 8, small: PlaceRow[] = []): PlaceHit[] {
  const [namePart, ...rest] = query.split(',');
  const q = fold(namePart ?? '');
  const where = fold(rest.join(','));
  if (!q) return [];
  const regionOk = (r: PlaceRow) => !where || fold(g.regions[r[5]] ?? '').startsWith(where)
    || (!!r[6] && fold(r[6]).startsWith(where)) || r[1].toLowerCase() === where;
  const hit = (r: PlaceRow): PlaceHit => ({
    name: r[0], country: r[1], lat: r[2], lon: r[3], zone: g.zones[r[4]]!,
    region: g.regions[r[5]] ?? '', county: r[6] ?? '',
  });
  const prefix: PlaceHit[][] = [[], []];
  const inner: PlaceHit[][] = [[], []];
  [g.cities, small].forEach((rows, tier) => {
    const names = foldedNames(rows);
    for (let i = 0; i < rows.length && prefix[tier]!.length < limit; i++) {
      const r = rows[i]!;
      const ns = names[i]!;
      if (ns.some(n => n.startsWith(q))) { if (regionOk(r)) prefix[tier]!.push(hit(r)); }
      else if (inner[tier]!.length < limit && ns.some(n => n.includes(q)) && regionOk(r)) inner[tier]!.push(hit(r));
    }
  });
  return [...prefix[0]!, ...prefix[1]!, ...inner[0]!, ...inner[1]!].slice(0, limit);
}

/**
 * Typed coordinates ("51.48, -3.18"): a place there, with the time zone and
 * country of the nearest listed place (named in `near`, so it can be checked).
 */
export function placeFromCoordinates(g: Gazetteer, query: string): PlaceHit | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(query);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || !g.cities.length) return null;
  const rad = Math.PI / 180;
  let best = g.cities[0]!, bestD = Infinity;
  for (const r of g.cities) {
    // equirectangular distance is enough to pick the nearest
    const dx = ((((r[3] - lon) % 360) + 540) % 360 - 180) * Math.cos(lat * rad), dy = r[2] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = r; }
  }
  return {
    name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, country: best[1], lat, lon,
    zone: g.zones[best[4]]!, region: g.regions[best[5]] ?? '', county: best[6] ?? '', near: best[0],
  };
}
