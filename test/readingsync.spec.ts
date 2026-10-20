// The pure parts of readings sync (astro-cbi): which readings go up, and how
// the server's rows fold into the local list.
import { describe, expect, it } from 'vitest';
import {
  asServer, mergePulled, newUid, parseSaved, toUpload, type SavedReading, type ServerRow,
} from '../src/ai/readingstore.js';

const ME = 'me@example.com';
const reading = (id: number, over: Partial<SavedReading> = {}): SavedReading => ({
  id, key: 'natal|A@1990-01-01', group: 'natal|A@1990-01-01', tab: 'natal', title: 'Natal · A',
  question: 'q', preset: 'sonnet-medium', anonymised: true, text: `reading ${id}`, stopped: false,
  createdAt: id, uid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, ...over,
});
const row = (r: SavedReading): ServerRow => asServer(r);

describe('newUid', () => {
  it('makes distinct version-4 UUIDs', () => {
    const a = newUid(); const b = newUid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('toUpload', () => {
  it('sends unsynced readings made here or already this account\'s, never another account\'s', () => {
    const list = [
      reading(1),                                        // made here, signed out
      reading(2, { account: ME }),                       // mine, changed since
      reading(3, { account: ME, synced: true }),         // mine, on the server
      reading(4, { account: 'other@example.com' }),      // someone else's
      reading(5, { refused: 'bad tab' }),                // refused: not retried
      reading(6, { refused: 'full' }),                   // account full: retried
      reading(7),                                        // still streaming
      reading(8, { uid: undefined }),                    // no identity yet
    ];
    expect(toUpload(list, ME, new Set([7])).map(r => r.id)).toEqual([1, 2, 6]);
  });

  it('carries the server fields only, interrupted only when set', () => {
    const r = reading(9, { account: ME, synced: false, interrupted: true });
    expect(asServer(r)).toEqual({
      id: r.uid, key: r.key, group: r.group, tab: 'natal', title: r.title, question: 'q',
      preset: 'sonnet-medium', anonymised: true, text: 'reading 9', stopped: false, interrupted: true, createdAt: 9,
    });
    expect('interrupted' in asServer(reading(10))).toBe(false);
  });
});

describe('mergePulled', () => {
  it('adds readings from other devices, newest first, marked as this account\'s and synced', () => {
    const local = [reading(5)];
    const out = mergePulled(local, [row(reading(9)), row(reading(1))], ME, new Set(), 300);
    expect(out.map(r => r.createdAt)).toEqual([9, 5, 1]);
    expect(out[0]).toMatchObject({ account: ME, synced: true });
    expect(out[1]).toEqual(local[0]); // untouched
  });

  it('replaces a reading it already has (keeping its local id) and removes deleted ones', () => {
    const mine = reading(5, { account: ME, synced: true, id: 42 });
    const gone = reading(6, { account: ME, synced: true });
    const out = mergePulled([mine, gone], [row({ ...mine, text: 'longer now' }), { id: gone.uid!, deleted: true }], ME, new Set(), 300);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 42, text: 'longer now', uid: mine.uid });
  });

  it('skips readings about to be deleted here, and presets or tabs this app does not know', () => {
    const a = reading(1); const b = reading(2); const c = reading(3);
    const rows = [row(a), { ...row(b), preset: 'gpt-9' } as ServerRow, { ...row(c), tab: 'weather' } as unknown as ServerRow];
    expect(mergePulled([], rows, ME, new Set([a.uid!]), 300)).toEqual([]);
  });

  it('gives a new local id when two readings were created in the same millisecond', () => {
    const here = reading(7);
    const there = reading(7, { uid: newUid(), text: 'from the phone' });
    const out = mergePulled([here], [row(there)], ME, new Set(), 300);
    expect(new Set(out.map(r => r.id)).size).toBe(2);
  });

  it('keeps the newest `max`', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(reading(i + 1)));
    expect(mergePulled([], rows, ME, new Set(), 4).map(r => r.createdAt)).toEqual([10, 9, 8, 7]);
  });
});

describe('stored readings with sync fields', () => {
  it('parse with their uid and account; a malformed uid is dropped like any malformed reading', () => {
    const raw = JSON.stringify([reading(1, { account: ME, synced: true }), { ...reading(2), uid: 5 }]);
    expect(parseSaved(raw)).toEqual([reading(1, { account: ME, synced: true })]);
  });
});
