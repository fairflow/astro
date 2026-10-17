import { askClaude } from './ask.js';
import type { AiPresetId } from './config.js';
import {
  parseSaved, upsertReading, writeWithPruning, type ReadingTab, type SavedReading,
} from './readingstore.js';

/**
 * The "Ask Claude" readings store. Readings live here, not in the panel, so
 * switching tabs never loses one: a reading still streaming keeps streaming
 * and is there when you come back. Every reading that produced text is saved
 * automatically to this browser's localStorage (nothing is uploaded), newest
 * first, capped at MAX. A reading is also saved while it streams (every
 * CHECKPOINT_MS, and when the page is hidden or closed), marked `interrupted`
 * until it finishes, so a reload keeps what had arrived.
 */

const KEY = 'astro-readings';
const MAX = 300;
const CHECKPOINT_MS = 2000;

/** A reading in progress (or finished) during this page session. */
export interface LiveReading {
  text: string;
  busy: boolean;
  err: string;
  question: string;
  preset: AiPresetId;
  createdAt: number;
  /** Set once the finished reading has been saved. */
  savedId: number | null;
}

const storage = typeof localStorage === 'undefined' ? null : localStorage;
function readRaw(): string | null {
  try { return storage?.getItem(KEY) ?? null; } catch { return null; }
}

export const readings = $state<{ saved: SavedReading[]; live: Record<string, LiveReading> }>({
  saved: parseSaved(readRaw()),
  live: {},
});

const controllers = new Map<string, AbortController>();
/** Save-now functions of the readings streaming in this page, by reading id. */
const checkpoints = new Map<number, () => void>();
/** Readings deleted while still streaming: never saved again. */
const discarded = new Set<number>();

// the page may be about to go (reload, tab closed, phone app switched away):
// save every reading still streaming
if (typeof window !== 'undefined') {
  const saveAll = () => { for (const f of checkpoints.values()) f(); };
  window.addEventListener('pagehide', saveAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveAll(); });
}

function persist(): void {
  if (!storage) return;
  const stored = writeWithPruning($state.snapshot(readings.saved), v => storage.setItem(KEY, v));
  if (stored.length < readings.saved.length) readings.saved = stored;
}

export function startReading(o: {
  key: string; group: string; tab: ReadingTab; title: string;
  system: string; snapshot: string; question: string;
  preset: AiPresetId; anonymised: boolean;
}): void {
  stopReading(o.key);
  const c = new AbortController();
  controllers.set(o.key, c);
  readings.live[o.key] = {
    text: '', busy: true, err: '', question: o.question, preset: o.preset,
    createdAt: Date.now(), savedId: null,
  };
  const cur = readings.live[o.key]!;
  const id = cur.createdAt;
  let lastSave = 0;

  /** Save what has arrived; `done` marks the reading finished (not interrupted). */
  const save = (done: boolean) => {
    if (!cur.text.trim() || discarded.has(id)) return;
    const r: SavedReading = {
      id, key: o.key, group: o.group, tab: o.tab, title: o.title,
      question: o.question, preset: o.preset, anonymised: o.anonymised,
      text: cur.text, stopped: done ? c.signal.aborted : true, createdAt: id,
      ...(done ? {} : { interrupted: true }),
    };
    readings.saved = upsertReading(readings.saved, r, MAX);
    persist();
    cur.savedId = id;
    lastSave = Date.now();
  };
  checkpoints.set(id, () => save(false));

  void (async () => {
    try {
      await askClaude({
        system: o.system, userContent: `${o.snapshot}\n\n---\n\nRequest: ${o.question}`,
        preset: o.preset, signal: c.signal,
        onDelta: t => { cur.text += t; if (Date.now() - lastSave >= CHECKPOINT_MS) save(false); },
      });
    } catch (e) {
      if (!c.signal.aborted) cur.err = e instanceof Error ? e.message : String(e);
    } finally {
      if (controllers.get(o.key) === c) controllers.delete(o.key);
      checkpoints.delete(id);
      cur.busy = false;
      save(true);
    }
  })();
}

/** Stop the reading in progress for `key`, if any (what arrived is still saved). */
export function stopReading(key: string): void {
  controllers.get(key)?.abort();
}

export function deleteReading(id: number): void {
  if (checkpoints.has(id)) {
    // deleting a reading that is still streaming stops it, and it stays deleted
    discarded.add(id);
    for (const [k, l] of Object.entries(readings.live)) if (l.savedId === id) stopReading(k);
  }
  readings.saved = readings.saved.filter(r => r.id !== id);
  persist();
  for (const [k, l] of Object.entries(readings.live)) {
    if (l.savedId === id) delete readings.live[k];
  }
}
