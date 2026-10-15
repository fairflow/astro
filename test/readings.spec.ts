import { describe, expect, it } from 'vitest';
import { parseSaved, who, writeWithPruning, type SavedReading } from '../src/ai/readingstore.js';

const reading = (id: number, over: Partial<SavedReading> = {}): SavedReading => ({
  id, key: 'synastry|A@1990-01-01|B@1991-02-02', group: 'synastry|A@1990-01-01|B@1991-02-02',
  tab: 'synastry', title: 'Synastry · A × B', question: 'q', preset: 'sonnet-medium',
  anonymised: true, text: `reading ${id}`, stopped: false, createdAt: id, ...over,
});

const quota = () => new DOMException('full', 'QuotaExceededError');

describe('who', () => {
  it('identifies a person by name and birth date, with a fallback for no name', () => {
    expect(who('Benita', '1960-12-01')).toBe('Benita@1960-12-01');
    expect(who('  ', '1960-12-01')).toBe('unnamed@1960-12-01');
  });
});

describe('parseSaved', () => {
  it('returns readings newest first and drops malformed entries without throwing', () => {
    const raw = JSON.stringify([reading(1), { id: 'x' }, reading(3), null, reading(2, { preset: 'gpt' as never })]);
    expect(parseSaved(raw).map(r => r.id)).toEqual([3, 1]);
  });

  it('treats missing, corrupt or non-array storage as empty', () => {
    expect(parseSaved(null)).toEqual([]);
    expect(parseSaved('{not json')).toEqual([]);
    expect(parseSaved('{"a":1}')).toEqual([]);
  });
});

describe('writeWithPruning', () => {
  it('stores the list unchanged when it fits', () => {
    let stored = '';
    const list = [reading(2), reading(1)];
    expect(writeWithPruning(list, v => { stored = v; })).toBe(list);
    expect(parseSaved(stored).map(r => r.id)).toEqual([2, 1]);
  });

  it('drops the oldest readings on a quota error until the list fits', () => {
    const list = Array.from({ length: 10 }, (_, i) => reading(10 - i)); // newest first
    let stored = '';
    const out = writeWithPruning(list, v => {
      if (JSON.parse(v).length > 6) throw quota();
      stored = v;
    });
    expect(out.length).toBeLessThanOrEqual(6);
    expect(out[0]!.id).toBe(10); // the newest survive
    expect(parseSaved(stored).length).toBe(out.length);
  });

  it('keeps everything in memory when storage is blocked for another reason', () => {
    const list = [reading(2), reading(1)];
    const out = writeWithPruning(list, () => { throw new DOMException('no', 'SecurityError'); });
    expect(out).toBe(list);
  });
});
