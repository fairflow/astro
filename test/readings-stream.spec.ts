import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseSaved, upsertReading, type SavedReading } from '../src/ai/readingstore.js';

// A controllable stand-in for the network: each call hands back its onDelta
// and a finish() that ends the stream.
type Call = { onDelta: (t: string) => void; finish: () => void; signal: AbortSignal };
const calls: Call[] = [];
vi.mock('../src/ai/ask.js', () => ({
  askClaude: (o: { onDelta: (t: string) => void; signal: AbortSignal }) => new Promise<void>((resolve, reject) => {
    calls.push({ onDelta: o.onDelta, finish: resolve, signal: o.signal });
    o.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }),
}));

const store = new Map<string, string>();
const stored = () => parseSaved(store.get('astro-readings') ?? null);
const flush = () => new Promise(r => setTimeout(r, 0));

let mod: typeof import('../src/ai/readings.svelte.js');
beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  mod = await import('../src/ai/readings.svelte.js');
});
afterAll(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const start = (key: string) => mod.startReading({
  key, group: key, tab: 'orrery', title: `Orrery · ${key}`, system: 's', snapshot: 'snap',
  question: 'why retrograde?', preset: 'sonnet-medium', anonymised: true,
});

describe('readings are saved while they stream', () => {
  it('a partial reading is in storage, marked interrupted, before the stream ends', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    start('a');
    const call = calls.at(-1)!;
    call.onDelta('First part. ');            // the first text is saved at once
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ text: 'First part. ', interrupted: true, stopped: true });

    vi.setSystemTime(1_000_500);
    call.onDelta('More. ');                  // within 2 s: not saved yet
    expect(stored()[0]!.text).toBe('First part. ');
    vi.setSystemTime(1_003_000);
    call.onDelta('Later. ');                 // 2 s on: saved again, same record
    expect(stored()).toHaveLength(1);
    expect(stored()[0]!.text).toBe('First part. More. Later. ');

    call.finish(); await flush();            // finished: no longer interrupted
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ text: 'First part. More. Later. ', stopped: false });
    expect(stored()[0]!.interrupted).toBeUndefined();
  });

  it('stopping keeps what arrived as a stopped (not interrupted) reading', async () => {
    vi.setSystemTime(2_000_000);
    start('b');
    calls.at(-1)!.onDelta('Partial.');
    mod.stopReading('b'); await flush();
    const r = stored().find(x => x.key === 'b')!;
    expect(r).toMatchObject({ text: 'Partial.', stopped: true });
    expect(r.interrupted).toBeUndefined();
  });

  it('deleting a reading while it streams stops it, and it is not saved again', async () => {
    vi.setSystemTime(3_000_000);
    start('c');
    const call = calls.at(-1)!;
    call.onDelta('Doomed.');
    const id = stored().find(x => x.key === 'c')!.id;
    mod.deleteReading(id); await flush();
    expect(call.signal.aborted).toBe(true);
    expect(stored().find(x => x.key === 'c')).toBeUndefined();
  });
});

describe('stored readings: interrupted flag and upsert', () => {
  const r = (id: number, over: Partial<SavedReading> = {}): SavedReading => ({
    id, key: 'k', group: 'k', tab: 'natal', title: 't', question: 'q', preset: 'sonnet-medium',
    anonymised: true, text: `x${id}`, stopped: false, createdAt: id, ...over,
  });
  it('parse keeps a reading with interrupted: true and drops one with a bad flag', () => {
    const raw = JSON.stringify([r(1, { interrupted: true }), { ...r(2), interrupted: 'yes' }]);
    expect(parseSaved(raw).map(x => x.id)).toEqual([1]);
  });
  it('upsert replaces by id, puts the reading first and caps the list', () => {
    const list = [r(3), r(2), r(1)];
    expect(upsertReading(list, r(2, { text: 'new' }), 10).map(x => [x.id, x.text]))
      .toEqual([[2, 'new'], [3, 'x3'], [1, 'x1']]);
    expect(upsertReading(list, r(4), 2).map(x => x.id)).toEqual([4, 3]);
  });
});
