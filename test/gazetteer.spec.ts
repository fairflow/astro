// The two-tier place index (astro-brv): data/gazetteer.json and data/places/.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fold, placeFromCoordinates, searchPlaces, shardKey, type Gazetteer, type PlaceRow,
} from '../src/store/gazetteer.js';

const root = resolve(__dirname, '..', 'data');
const g = JSON.parse(readFileSync(resolve(root, 'gazetteer.json'), 'utf8')) as Gazetteer;
const shard = (k: string): PlaceRow[] => {
  try { return (JSON.parse(readFileSync(resolve(root, 'places', `${k}.json`), 'utf8')) as { cities: PlaceRow[] }).cities; }
  catch { return []; }
};
/** What the app does: the larger places plus the query's file of smaller ones. */
const search = (q: string, limit = 8) => {
  const k = shardKey(fold(q.split(',')[0]!), g.split);
  return searchPlaces(g, q, limit, k ? shard(k) : []);
};

describe('fold', () => {
  it('drops accents, case and punctuation, and maps letters NFD keeps', () => {
    expect(fold('Zürich')).toBe('zurich');
    expect(fold('Málaga')).toBe('malaga');
    expect(fold('Łódź')).toBe('lodz');
    expect(fold('Tromsø')).toBe('tromso');
    expect(fold('Großenhain')).toBe('grossenhain');
    expect(fold('Saint-Jean-de-Luz')).toBe('saintjeandeluz');
    expect(fold("Bishop's Stortford")).toBe('bishopsstortford');
    expect(fold('İzmir')).toBe('izmir');
  });
});

describe('shardKey', () => {
  it('two letters, or three for split prefixes, and nothing until there are enough', () => {
    expect(shardKey('n', ['sa'])).toBeNull();
    expect(shardKey('newport', ['sa'])).toBe('ne');
    expect(shardKey('sa', ['sa'])).toBeNull();
    expect(shardKey('santiago', ['sa'])).toBe('san');
  });
});

describe('the place files', () => {
  it('every smaller place is filed under the first letters of its folded name or alt', () => {
    const files = readdirSync(resolve(root, 'places')).map(f => f.replace(/\.json$/, ''));
    expect(files.length).toBeGreaterThan(200);
    let rows = 0;
    const misfiled: string[] = [];
    for (const k of files) {
      for (const r of shard(k)) {
        rows++;
        const names = [r[0], ...(r[7] ? [r[7]] : [])].map(n => (fold(n) + '___').slice(0, k.length));
        if (!names.includes(k)) misfiled.push(`${r[0]} in ${k}.json`);
      }
    }
    expect(misfiled).toEqual([]);
    expect(rows).toBeGreaterThan(150_000);
  }, 60_000);   // 200,000 rows: a few seconds on a slow CI machine

  it('the larger places come first by population and carry a zone and region', () => {
    expect(g.cities.length).toBeGreaterThan(30_000);
    expect(g.regions[0]).toBe('');
    for (const r of g.cities.slice(0, 500)) {
      expect(g.zones[r[4]]).toMatch(/\//);
      expect(g.regions[r[5]]).toBeDefined();
    }
  });
});

describe('searchPlaces', () => {
  it('finds towns under 15,000 people from their file', () => {
    // Tenby, Wales (about 4,700 people): not in the larger places
    expect(g.cities.some(r => r[0] === 'Tenby')).toBe(false);
    expect(search('Tenby').some(p => p.name === 'Tenby' && p.country === 'GB')).toBe(true);
  });

  it('accent-free typing finds accented names', () => {
    expect(search('Zurich')[0]).toMatchObject({ name: 'Zürich', country: 'CH' });
    expect(search('Lodz').some(p => p.name === 'Łódź')).toBe(true);
  });

  it('a region (or country code) after a comma tells same-named places apart', () => {
    const wales = search('Newport, Wales');
    expect(wales.length).toBeGreaterThan(0);
    expect(wales.every(p => p.region === 'Wales')).toBe(true);
    expect(search('Newport, US').every(p => p.country === 'US')).toBe(true);
  });

  it('a county tells same-named places in one region apart (astro-brv)', () => {
    const wales = search('Newport, Wales', 20);
    expect(wales.map(p => p.county).sort()).toEqual(['', 'Pembrokeshire']);   // the city: county is its own name
    const pem = search('Newport, Pembrokeshire');
    expect(pem).toHaveLength(1);
    expect(pem[0]).toMatchObject({ county: 'Pembrokeshire', region: 'Wales', country: 'GB' });
    expect(search('Newport, Essex')[0]).toMatchObject({ county: 'Essex', region: 'England' });
  });

  it('larger places rank first, and each hit names its region', () => {
    const london = search('London');
    expect(london[0]).toMatchObject({ name: 'London', country: 'GB', zone: 'Europe/London' });
    expect(london[0]!.region).toBe('England');
  });
});

describe('placeFromCoordinates', () => {
  it('takes the time zone and country of the nearest listed place', () => {
    const p = placeFromCoordinates(g, '51.48, -3.18')!;
    expect(p).toMatchObject({ lat: 51.48, lon: -3.18, zone: 'Europe/London', country: 'GB' });
    expect(p.near).toBeTruthy();
    expect(placeFromCoordinates(g, '-33.87 151.21')).toMatchObject({ zone: 'Australia/Sydney', country: 'AU' });
  });

  it('is not fooled by names or impossible numbers', () => {
    expect(placeFromCoordinates(g, 'Newport')).toBeNull();
    expect(placeFromCoordinates(g, '95, 10')).toBeNull();
  });
});
