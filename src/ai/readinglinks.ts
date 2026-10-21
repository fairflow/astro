import { who, type ReadingTab, type SavedReading } from './readingstore.js';

/**
 * Saved readings linked to saved charts (astro-32t), for the Readings view in
 * Saved charts. A reading names its people in its group, e.g.
 * "synastry|Matthew@1960-01-02|Benita@1962-03-04" (who() in readingstore.ts:
 * name plus birth date), so it belongs to every saved chart with that name and
 * date: a synastry or composite reading to both people. One whose people are
 * not all saved (or that has none, like the orrery's) is "not linked". Pure, so
 * it is unit-tested.
 */

interface Person { name: string; date: string }

/** The people a reading's group names, in order (none for the orrery). */
export function readingPeople(group: string): string[] {
  return group.split('|').slice(1);
}

/** The app tab a reading belongs to. */
export function readingMode(tab: ReadingTab): 'natal' | 'transits' | 'synastry' | 'composite' | 'retrograde' {
  return tab === 'couple-transits' ? 'transits' : tab === 'orrery' ? 'retrograde' : tab;
}

/** A transit reading's date (its key ends "|YYYY-MM-DD"); '' for the others. */
export function readingTransitDate(r: Pick<SavedReading, 'tab' | 'key'>): string {
  if (r.tab !== 'transits' && r.tab !== 'couple-transits') return '';
  const d = r.key.slice(r.key.lastIndexOf('|') + 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

export interface ReadingLinks<C> {
  /** Readings for each saved chart (keyed by the chart object given), newest first. */
  byChart: Map<C, SavedReading[]>;
  /** Readings with a person who is not saved here, or with nobody. */
  unlinked: SavedReading[];
  /** For a linked reading: its people's charts, in the reading's order. */
  charts: Map<number, C[]>;
}

/** Sort readings under the saved charts they are about. */
export function linkReadings<C extends Person>(readings: SavedReading[], charts: C[]): ReadingLinks<C> {
  const byWho = new Map<string, C>();
  for (const c of charts) if (!byWho.has(who(c.name, c.date))) byWho.set(who(c.name, c.date), c);
  const byChart = new Map<C, SavedReading[]>();
  const unlinked: SavedReading[] = [];
  const people = new Map<number, C[]>();
  for (const r of [...readings].sort((a, b) => b.createdAt - a.createdAt)) {
    const names = readingPeople(r.group);
    const found = names.map(n => byWho.get(n));
    if (!names.length || found.some(c => !c)) { unlinked.push(r); continue; }
    const cs = found as C[];
    people.set(r.id, cs);
    for (const c of new Set(cs)) byChart.set(c, [...byChart.get(c) ?? [], r]);
  }
  return { byChart, unlinked, charts: people };
}
