// The pure parts of chart sync (astro-ag1).
import { describe, expect, it } from 'vitest';
import { chartPayload, chartsToUpload, planPull, type ServerChartRow } from '../src/store/chartmerge.js';
import type { SavedChart } from '../src/store/db.js';

const ME = 'me@example.com';
const place = { name: 'London', country: 'GB', lat: 51.5, lon: -0.13, zone: 'Europe/London' };
const chart = (id: number, over: Partial<SavedChart> = {}): SavedChart => ({
  id, name: `P${id}`, date: '1990-01-01', time: '08:30', accuracy: 'exact', place, set: 'Unfiled',
  createdAt: 1000 * id, updatedAt: 1000 * id, uid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, ...over,
});
const row = (c: SavedChart): ServerChartRow => chartPayload(c);

describe('chartsToUpload', () => {
  it('sends changed charts made here or this account\'s; retries "older" and "full"; never another account\'s', () => {
    const list = [
      chart(1), chart(2, { account: ME }), chart(3, { account: ME, synced: true }),
      chart(4, { account: 'other@example.com' }), chart(5, { refused: 'bad place' }),
      chart(6, { refused: 'older' }), chart(7, { refused: 'full' }), chart(8, { uid: undefined }),
    ];
    expect(chartsToUpload(list, ME).map(c => c.id)).toEqual([1, 2, 6, 7]);
  });

  it('sends birth data only, with the edit time (creation time for charts never edited)', () => {
    const c = chart(9, { account: ME, synced: false, notes: 'twin', updatedAt: undefined });
    expect(chartPayload(c)).toEqual({
      id: c.uid, createdAt: 9000, updatedAt: 9000,
      data: { name: 'P9', date: '1990-01-01', time: '08:30', accuracy: 'exact', place, notes: 'twin', set: 'Unfiled' },
    });
  });
});

describe('planPull', () => {
  it('adds charts from other devices and replaces older local copies, keeping their local id', () => {
    const mine = chart(1, { account: ME, synced: true });
    const edited = { ...chartPayload(mine), data: { ...chartPayload(mine).data, name: 'Renamed' }, updatedAt: 5000 };
    const fresh = chart(2, { id: undefined });
    const plan = planPull([mine], [edited, row(fresh)], ME, new Set());
    expect(plan.remove).toEqual([]);
    expect(plan.put).toEqual([
      expect.objectContaining({ id: 1, name: 'Renamed', updatedAt: 5000, account: ME, synced: true }),
      expect.objectContaining({ name: 'P2', uid: fresh.uid, account: ME, synced: true }),
    ]);
    expect('id' in plan.put[1]!).toBe(false);
  });

  it('keeps a newer local edit (it goes up next), and removes charts deleted elsewhere', () => {
    const newer = chart(1, { account: ME, synced: false, updatedAt: 9999 });
    const gone = chart(2, { account: ME, synced: true });
    const plan = planPull([newer, gone], [row({ ...newer, updatedAt: 5000 }), { id: gone.uid!, deleted: true }], ME, new Set());
    expect(plan).toEqual({ put: [], remove: [2] });
  });

  it('a local edit refused as older takes the server copy', () => {
    const stale = chart(1, { account: ME, synced: false, refused: 'older', updatedAt: 3000 });
    const plan = planPull([stale], [row({ ...stale, name: 'Server', updatedAt: 4000 })], ME, new Set());
    expect(plan.put[0]).toMatchObject({ id: 1, name: 'Server', synced: true });
    expect('refused' in plan.put[0]!).toBe(false);
  });

  it('skips charts about to be deleted here', () => {
    const c = chart(1);
    expect(planPull([], [row(c)], ME, new Set([c.uid!]))).toEqual({ put: [], remove: [] });
  });
});
