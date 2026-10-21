import { account, refreshAccount } from '../api/account.svelte';
import { newUid } from '../ai/readingstore.js';
import { chartPayload, chartsToUpload, planPull, type ServerChartRow } from './chartmerge.js';
import {
  chartDeletionsPending, chartsChanged, db, onChartsChange, setChartDeletionsPending, type SavedChart,
} from './db.js';

/**
 * Keeps this browser's saved charts (IndexedDB) in step with the signed-in
 * account's copy on the server (api/charts.php, astro-ag1), as
 * readingsync.svelte.ts does for readings: push deletions and changed charts,
 * then pull what changed since the cursor. The later edit wins. Charts saved
 * here without signing in go to the first account signed in here; a chart
 * uploaded to one account is never sent to another.
 */

const API = 'api/charts.php';
const CURSOR_KEY = 'astro-charts-cursor';

export const chartSync = $state<{ state: 'off' | 'syncing' | 'idle' | 'paused' | 'error'; error: string; count: number; waiting: number }>(
  { state: 'off', error: '', count: 0, waiting: 0 });

function cursor(email: string): number {
  try { return (JSON.parse(localStorage.getItem(CURSOR_KEY) ?? '{}') as Record<string, number>)[email] ?? 0; } catch { return 0; }
}
function setCursor(email: string, c: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(CURSOR_KEY) ?? '{}') as Record<string, number>;
    localStorage.setItem(CURSOR_KEY, JSON.stringify({ ...all, [email]: c }));
  } catch { /* next pull starts earlier */ }
}


/**
 * A sync request was refused. 401 means the server no longer has this browser
 * signed in (or never received its cookie): check again, so the page shows the
 * truth (signed out, with the sign-in form) instead of looking signed in.
 */
function failed(res: Response, what: string): never {
  if (res.status === 401) {
    void refreshAccount();
    throw new Error('the server does not have you signed in; sign in again');
  }
  throw new Error(`${what} failed (HTTP ${res.status})`);
}

const post = (body: unknown) => fetch(API, {
  method: 'POST', credentials: 'same-origin', cache: 'no-store',
  headers: { 'content-type': 'application/json', 'x-astro': '1' }, body: JSON.stringify(body),
});

/** Charts saved before sync existed get their server identity. */
async function giveIds(): Promise<void> {
  const missing = (await db.charts.toArray()).filter(c => !c.uid);
  for (const c of missing) await db.charts.update(c.id!, { uid: newUid(), updatedAt: c.updatedAt ?? c.createdAt });
}

async function push(email: string): Promise<void> {
  const del = chartDeletionsPending()[email] ?? [];
  const up = chartSync.state === 'paused' ? [] : chartsToUpload(await db.charts.toArray(), email);
  if (!up.length && !del.length) return;
  const res = await post({ charts: up.map(chartPayload), deleted: del });
  if (res.status === 403 && del.length) {
    // paused: deletions still go, uploads wait
    chartSync.state = 'paused';
    const r2 = await post({ charts: [], deleted: del });
    if (r2.ok) dropDeletions(email, del);
    return;
  }
  if (res.status === 403) { chartSync.state = 'paused'; return; }
  if (!res.ok) failed(res, 'upload');
  const j = await res.json() as { saved: string[]; refused: { id: string; reason: string }[] };
  if (del.length) dropDeletions(email, del);
  const sent = new Map(up.map(c => [c.uid!, chartPayload(c).updatedAt]));
  const refused = new Map(j.refused.map(x => [x.id, x.reason]));
  const saved = new Set(j.saved);
  await db.transaction('rw', db.charts, async () => {
    for (const c of await db.charts.toArray()) {
      if (!c.uid || c.id === undefined) continue;
      if (saved.has(c.uid)) {
        // only the version sent counts as synced: one edited since goes up again
        await db.charts.update(c.id, (c.updatedAt ?? c.createdAt) === sent.get(c.uid)
          ? { account: email, synced: true, refused: undefined } : { account: email });
      } else if (refused.get(c.uid) === 'deleted') {
        await db.charts.delete(c.id);          // deleted on another device
      } else if (refused.has(c.uid)) {
        await db.charts.update(c.id, { refused: refused.get(c.uid), account: email });
      }
    }
  });
}

function dropDeletions(email: string, sent: string[]): void {
  const d = chartDeletionsPending();
  d[email] = (d[email] ?? []).filter(u => !sent.includes(u));
  if (!d[email]!.length) delete d[email];
  setChartDeletionsPending(d);
}

/** Pull; returns whether anything changed here. */
async function pull(email: string): Promise<boolean> {
  let since = cursor(email);
  let changed = false;
  for (;;) {
    const res = await fetch(`${API}?since=${since}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) failed(res, 'download');
    const j = await res.json() as { charts: ServerChartRow[]; cursor: number; more: boolean };
    const plan = planPull(await db.charts.toArray(), j.charts, email, new Set(chartDeletionsPending()[email] ?? []));
    if (plan.put.length || plan.remove.length) {
      await db.transaction('rw', db.charts, async () => {
        await db.charts.bulkDelete(plan.remove);
        await db.charts.bulkPut(plan.put);
      });
      changed = true;
    }
    since = j.cursor;
    setCursor(email, since);
    if (!j.more) break;
  }
  return changed;
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function syncCharts(): Promise<void> {
  if (account.status !== 'signedIn' || !account.email) { chartSync.state = 'off'; return Promise.resolve(); }
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        const email = account.email;
        chartSync.state = account.state === 'paused' ? 'paused' : 'syncing';
        chartSync.error = '';
        try {
          await giveIds();
          await push(email);
          if (await pull(email)) chartsChanged(false);
          if (chartSync.state === 'syncing') chartSync.state = 'idle';
        } catch (e) {
          chartSync.state = 'error';
          chartSync.error = e instanceof Error ? e.message : String(e);
        }
        const all: SavedChart[] = await db.charts.toArray();
        chartSync.count = all.filter(c => c.account === email && c.synced).length;
        chartSync.waiting = chartsToUpload(all, email).length;
      } while (again && account.status === 'signedIn');
    } finally {
      running = null;
    }
  })();
  return running;
}

function schedule(ms = 400): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncCharts(), ms);
}

if (typeof window !== 'undefined') {
  onChartsChange(local => { if (local) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(1500); });
  $effect.root(() => {
    $effect(() => {
      if (account.status === 'signedIn' && account.email) schedule(0);
      else if (account.status === 'signedOut') chartSync.state = 'off';
    });
  });
}
