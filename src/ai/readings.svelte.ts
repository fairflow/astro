import { askClaude } from './ask.js';
import type { AiPresetId } from './config.js';
import {
  parseSaved, writeWithPruning, type ReadingTab, type SavedReading,
} from './readingstore.js';

/**
 * The "Ask Claude" readings store. Readings live here, not in the panel, so
 * switching tabs never loses one: a reading still streaming keeps streaming
 * and is there when you come back. Every reading that produced text is saved
 * automatically to this browser's localStorage (nothing is uploaded), newest
 * first, capped at MAX.
 */

const KEY = 'astro-readings';
const MAX = 300;

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

  void (async () => {
    try {
      await askClaude({
        system: o.system, userContent: `${o.snapshot}\n\n---\n\nRequest: ${o.question}`,
        preset: o.preset, signal: c.signal, onDelta: t => { cur.text += t; },
      });
    } catch (e) {
      if (!c.signal.aborted) cur.err = e instanceof Error ? e.message : String(e);
    } finally {
      if (controllers.get(o.key) === c) controllers.delete(o.key);
      cur.busy = false;
      if (cur.text.trim()) {
        const saved: SavedReading = {
          id: cur.createdAt, key: o.key, group: o.group, tab: o.tab, title: o.title,
          question: o.question, preset: o.preset, anonymised: o.anonymised,
          text: cur.text, stopped: c.signal.aborted, createdAt: cur.createdAt,
        };
        readings.saved = [saved, ...readings.saved.filter(r => r.id !== saved.id)].slice(0, MAX);
        persist();
        cur.savedId = saved.id;
      }
    }
  })();
}

/** Stop the reading in progress for `key`, if any (what arrived is still saved). */
export function stopReading(key: string): void {
  controllers.get(key)?.abort();
}

export function deleteReading(id: number): void {
  readings.saved = readings.saved.filter(r => r.id !== id);
  persist();
  for (const [k, l] of Object.entries(readings.live)) {
    if (l.savedId === id) delete readings.live[k];
  }
}
