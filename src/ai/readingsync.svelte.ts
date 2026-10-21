import { account, refreshAccount } from '../api/account.svelte';
import {
  deletionsPending, onReadingsChange, readings, replaceSaved, setDeletionsPending, streamingIds,
} from './readings.svelte.js';
import { asServer, mergePulled, toUpload, type SavedReading, type ServerRow } from './readingstore.js';

/**
 * Keeps this browser's saved readings in step with the signed-in account's
 * copy on the server (api/readings.php, astro-cbi; docs/DESIGN.md §5a).
 *
 * Push first: deletions the server has not heard of, then readings it does not
 * hold yet (finished ones; one still streaming waits until it ends). Readings
 * made here without signing in go to the first account signed in here; a
 * reading uploaded to one account is never sent to another. Then pull: what
 * changed on the server since the last cursor, so readings from other devices
 * appear and deletions made elsewhere take effect. Runs on sign-in, when a
 * reading finishes or is deleted, and when the page comes back into view.
 * Failures leave everything queued for the next run; nothing local is lost.
 */

const API = 'api/readings.php';
const CURSOR_KEY = 'astro-readings-cursor';
const MAX = 300;                // as readings.svelte.ts: this browser keeps the newest 300
const BATCH_BYTES = 1_000_000;  // per upload request (the server takes up to 2 MB)

export const sync = $state<{
  state: 'off' | 'syncing' | 'idle' | 'paused' | 'error'; last: number; error: string; count: number; waiting: number;
}>({ state: 'off', last: 0, error: '', count: 0, waiting: 0 });

function cursors(): Record<string, number> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CURSOR_KEY) ?? '{}');
    return v && typeof v === 'object' ? v as Record<string, number> : {};
  } catch { return {}; }
}
function setCursor(email: string, c: number): void {
  try { localStorage.setItem(CURSOR_KEY, JSON.stringify({ ...cursors(), [email]: c })); } catch { /* next pull starts earlier */ }
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

/** Update readings by server id, then store the list. */
function patch(f: (r: SavedReading) => SavedReading | null): void {
  const next: SavedReading[] = [];
  for (const r of readings.saved) { const x = f(r); if (x) next.push(x); }
  replaceSaved(next);
}

function counts(email: string): void {
  sync.count = readings.saved.filter(r => r.account === email && r.synced).length;
  sync.waiting = toUpload(readings.saved, email, streamingIds()).length;
}

async function push(email: string): Promise<boolean> {
  const pendingDel = deletionsPending()[email] ?? [];
  const up = sync.state === 'paused' ? [] : toUpload($state.snapshot(readings.saved) as SavedReading[], email, streamingIds());
  // batches of whole readings, the deletions in the first
  const batches: SavedReading[][] = [[]];
  let size = 0;
  for (const r of up) {
    const n = r.text.length * 1.1 + 1000;
    if (size + n > BATCH_BYTES && batches.at(-1)!.length) { batches.push([]); size = 0; }
    batches.at(-1)!.push(r); size += n;
  }
  if (!up.length && !pendingDel.length) return true;
  for (const [i, batch] of batches.entries()) {
    const deleted = i === 0 ? pendingDel : [];
    if (!batch.length && !deleted.length) continue;
    const res = await post({ readings: batch.map(asServer), deleted });
    if (res.status === 403) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      if (j.error === 'paused') {
        // paused: deletions still go, uploads wait
        sync.state = 'paused';
        if (deleted.length) await post({ readings: [], deleted });
        if (deleted.length) dropDeletions(email, deleted);
        return true;
      }
    }
    if (!res.ok) failed(res, 'upload');
    const j = await res.json() as { saved: string[]; refused: { id: string; reason: string }[] };
    if (deleted.length) dropDeletions(email, deleted);
    const sent = new Map(batch.map(r => [r.uid!, r.text]));
    const saved = new Set(j.saved);
    const refused = new Map(j.refused.map(x => [x.id, x.reason]));
    const seen = new Set<string>();
    patch(r => {
      if (!r.uid) return r;
      if (saved.has(r.uid)) {
        seen.add(r.uid);
        // only what was sent counts as synced: a reading changed since goes up again
        return r.text === sent.get(r.uid) ? { ...r, account: email, synced: true, refused: undefined } : { ...r, account: email };
      }
      const why = refused.get(r.uid);
      if (why === 'deleted') return null;     // deleted on another device
      if (why) return { ...r, refused: why };
      return r;
    });
    // deleted here while it was being uploaded: delete it there too
    for (const uid of saved) if (!seen.has(uid)) queueAgain(email, uid);
  }
  return true;
}

function dropDeletions(email: string, sent: string[]): void {
  const d = deletionsPending();
  d[email] = (d[email] ?? []).filter(u => !sent.includes(u));
  if (!d[email]!.length) delete d[email];
  setDeletionsPending(d);
}
function queueAgain(email: string, uid: string): void {
  const d = deletionsPending();
  d[email] = [...new Set([...(d[email] ?? []), uid])];
  setDeletionsPending(d);
  again = true;
}

async function pull(email: string): Promise<void> {
  let since = cursors()[email] ?? 0;
  for (;;) {
    const res = await fetch(`${API}?since=${since}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) failed(res, 'download');
    const j = await res.json() as { readings: ServerRow[]; cursor: number; more: boolean };
    const deleting = new Set(deletionsPending()[email] ?? []);
    replaceSaved(mergePulled($state.snapshot(readings.saved) as SavedReading[], j.readings, email, deleting, MAX));
    since = j.cursor;
    setCursor(email, since);
    if (!j.more) break;
  }
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Sync now (or once more after the run in progress). */
export function syncNow(): Promise<void> {
  if (account.status !== 'signedIn' || !account.email) { sync.state = 'off'; return Promise.resolve(); }
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        const email = account.email;
        // a paused account uploads nothing (push() also learns it from the server)
        sync.state = account.state === 'paused' ? 'paused' : 'syncing';
        sync.error = '';
        try {
          await push(email);
          await pull(email);
          if (sync.state === 'syncing') sync.state = 'idle';
          sync.last = Date.now();
        } catch (e) {
          sync.state = 'error';
          sync.error = e instanceof Error ? e.message : String(e);
        }
        counts(email);
      } while (again && account.status === 'signedIn');
    } finally {
      running = null;
    }
  })();
  return running;
}

export function scheduleSync(ms = 400): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

if (typeof window !== 'undefined') {
  onReadingsChange(() => scheduleSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(1500); });
  // signing in (or the page loading signed in) starts a sync; signing out stops it
  $effect.root(() => {
    $effect(() => {
      if (account.status === 'signedIn' && account.email) scheduleSync(0);
      else if (account.status === 'signedOut') sync.state = 'off';
    });
  });
}
