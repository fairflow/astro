// Saved readings linked to saved charts (astro-32t).
import { describe, expect, it } from 'vitest';
import { linkReadings, readingMode, readingPeople, readingTransitDate } from '../src/ai/readinglinks.js';
import type { SavedReading } from '../src/ai/readingstore.js';

const reading = (id: number, group: string, over: Partial<SavedReading> = {}): SavedReading => ({
  id, key: group, group, tab: group.split('|')[0] as SavedReading['tab'], title: `t${id}`, question: 'q',
  preset: 'sonnet-medium', anonymised: true, text: `reading ${id}`, stopped: false, createdAt: id, ...over,
});
const A = { name: 'Ann', date: '1990-01-01', set: 'Family' };
const B = { name: 'Bob', date: '1991-02-02', set: 'Family' };
const C = { name: 'Cy', date: '1992-03-03', set: 'Friends' };

describe('readingPeople, readingMode, readingTransitDate', () => {
  it('reads the people, tab and transit date a reading was made for', () => {
    expect(readingPeople('synastry|Ann@1990-01-01|Bob@1991-02-02')).toEqual(['Ann@1990-01-01', 'Bob@1991-02-02']);
    expect(readingPeople('orrery')).toEqual([]);
    expect(readingMode('couple-transits')).toBe('transits');
    expect(readingMode('orrery')).toBe('retrograde');
    expect(readingMode('synastry')).toBe('synastry');
    expect(readingTransitDate({ tab: 'transits', key: 'transits|Ann@1990-01-01|2026-10-21' })).toBe('2026-10-21');
    expect(readingTransitDate({ tab: 'natal', key: 'natal|Ann@1990-01-01' })).toBe('');
  });
});

describe('linkReadings', () => {
  it('files each reading under its people: a pair reading under both, newest first', () => {
    const rs = [
      reading(1, 'natal|Ann@1990-01-01'),
      reading(3, 'synastry|Ann@1990-01-01|Bob@1991-02-02'),
      reading(2, 'transits|Bob@1991-02-02', { key: 'transits|Bob@1991-02-02|2026-10-21' }),
    ];
    const l = linkReadings(rs, [A, B, C]);
    expect(l.byChart.get(A)!.map(r => r.id)).toEqual([3, 1]);
    expect(l.byChart.get(B)!.map(r => r.id)).toEqual([3, 2]);
    expect(l.byChart.has(C)).toBe(false);
    expect(l.charts.get(3)).toEqual([A, B]);
    expect(l.unlinked).toEqual([]);
  });

  it('a reading whose people are not all saved, or that has nobody, is not linked', () => {
    const rs = [
      reading(1, 'synastry|Ann@1990-01-01|Zed@2000-01-01'),
      reading(2, 'orrery'),
      reading(3, 'natal|Ann@1999-09-09'),    // same name, another birth date: another person
    ];
    const l = linkReadings(rs, [A, B]);
    expect(l.unlinked.map(r => r.id)).toEqual([3, 2, 1]);
    expect(l.byChart.size).toBe(0);
    expect(l.charts.size).toBe(0);
  });

  it('two saved charts for one person: the reading goes to the first', () => {
    const A2 = { ...A, set: 'Unfiled' };
    const l = linkReadings([reading(1, 'natal|Ann@1990-01-01')], [A, A2]);
    expect(l.byChart.get(A)!.map(r => r.id)).toEqual([1]);
    expect(l.byChart.has(A2)).toBe(false);
  });
});
