import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STYLES } from '../src/interpret/types';

/** The shipped batch JSON is a contract between authoring_sheet.py,
 *  authoring_ingest.py and AuthoringView — validate its shape here. */
interface Slot {
  id: string; kind: string; label: string; kernel: string;
  texts: Record<string, string>; markers: string[]; ask: string;
  revision?: { note: string; basedOn?: string; prevKernel?: string;
    prevTexts?: Record<string, string> };
}
interface Batch { batch: number; wave: number; title: string; slots: Slot[] }

function load(name: string): Batch {
  return JSON.parse(
    readFileSync(new URL(`../data/authoring/${name}`, import.meta.url), 'utf8'),
  ) as Batch;
}

const batch00 = load('batch-00.json');
const batch01 = load('batch-01.json');
const batch02 = load('batch-02.json');
const batch03 = load('batch-03.json');
const batch04 = load('batch-04.json');

/** Shape invariants every batch must satisfy. */
function checkCommonShape(batch: Batch): void {
  it('has unique slot ids', () => {
    const ids = batch.slots.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every slot carries all four register texts and the frame fields', () => {
    for (const s of batch.slots) {
      expect(s.kernel.length, s.id).toBeGreaterThan(10);
      expect(s.label, s.id).toBeTruthy();
      expect(Array.isArray(s.markers), s.id).toBe(true);
      expect(s.ask, s.id).toContain('?');
      for (const st of STYLES) {
        expect(s.texts[st.id]?.length, `${s.id}.${st.id}`).toBeGreaterThan(10);
      }
    }
  });

  it('every inflection names its opposite pole (polarity is structural)', () => {
    for (const s of batch.slots.filter(s => s.kind.endsWith('-inflection'))) {
      expect(s.label, s.id).toMatch(/pole of the .+–.+ axis/);
    }
  });

  it('revision provenance is well-formed where present', () => {
    for (const s of batch.slots) {
      const rev = s.revision;
      if (!rev) continue;
      expect(rev.note?.length, s.id).toBeGreaterThan(10);
      expect(rev.prevKernel || rev.prevTexts, `${s.id} has a before`).toBeTruthy();
      if (rev.prevTexts) {
        for (const st of STYLES) {
          expect(rev.prevTexts[st.id]?.length, `${s.id}.prev.${st.id}`).toBeGreaterThan(10);
        }
      }
    }
  });
}

describe('authoring batch 00 (wave 1 — signs)', () => {
  it('covers the frame: 6 sign axes + 12 sign inflections', () => {
    expect(batch00.slots.filter(s => s.kind === 'sign-axis')).toHaveLength(6);
    expect(batch00.slots.filter(s => s.kind === 'sign-inflection')).toHaveLength(12);
  });
  checkCommonShape(batch00);
});

describe('authoring batch 01 (wave 2 — houses)', () => {
  it('covers the frame: 6 house axes + 12 house inflections', () => {
    expect(batch01.slots.filter(s => s.kind === 'house-axis')).toHaveLength(6);
    expect(batch01.slots.filter(s => s.kind === 'house-inflection')).toHaveLength(12);
  });
  checkCommonShape(batch01);
});

describe('authoring batch 02 (wave 3 — planets & major asteroids)', () => {
  it('covers the 10 planets plus Chiron, Vesta, Pallas — and no minors', () => {
    expect(batch02.slots.filter(s => s.kind === 'body-intro')).toHaveLength(13);
    const ids = batch02.slots.map(s => s.id);
    for (const b of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter',
      'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'vesta', 'pallas']) {
      expect(ids, b).toContain(`body-${b}`);
    }
    for (const minor of ['ceres', 'juno', 'eris', 'meanNode', 'lilith']) {
      expect(ids, minor).not.toContain(`body-${minor}`);
    }
  });
  checkCommonShape(batch02);
});

describe('authoring batch 03 (wave 4 — aspects)', () => {
  it('covers 8 pairs × 3 classes = 24 readings', () => {
    expect(batch03.slots.filter(s => s.kind === 'aspect-pair')).toHaveLength(24);
    for (const klass of ['neutral', 'flowing', 'challenge']) {
      expect(batch03.slots.filter(s => s.id.endsWith(`-${klass}`)), klass)
        .toHaveLength(8);
    }
  });
  checkCommonShape(batch03);
});

describe('authoring batch 04 (wave 5 — synastry probe)', () => {
  it('is a 6-slot probe spanning all three classes', () => {
    expect(batch04.slots.filter(s => s.kind === 'synastry-pair')).toHaveLength(6);
    for (const klass of ['neutral', 'flowing', 'challenge']) {
      expect(batch04.slots.filter(s => s.id.endsWith(`-${klass}`)), klass)
        .toHaveLength(2);
    }
  });

  // The probe's whole point: a synastry contact is NOT symmetrical, so every
  // register that speaks about people must voice BOTH sides. 'energy' is
  // exempt — across every wave it speaks in currents, not persons.
  it('every people-facing register states both sides of the contact', () => {
    for (const s of batch04.slots) {
      for (const reg of ['jungian', 'mundane', 'minimal']) {
        const mentions = (s.texts[reg]!.match(/ person/g) ?? []).length;
        expect(mentions, `${s.id}.${reg} names both sides`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  checkCommonShape(batch04);
});

describe('wave numbering', () => {
  // `batch` is a stable, opaque storage id — reactions live under localStorage
  // astro-authoring-<batch>, so renumbering it would orphan B's saved work.
  // `wave` is the 1-based number shown to the reader; the two differ by one.
  it('waves are 1-based and sequential', () => {
    expect([batch00.wave, batch01.wave, batch02.wave, batch03.wave, batch04.wave])
      .toEqual([1, 2, 3, 4, 5]);
  });
  it('batch storage ids stay stable (0-based) so saved reactions survive', () => {
    expect([batch00.batch, batch01.batch, batch02.batch, batch03.batch, batch04.batch])
      .toEqual([0, 1, 2, 3, 4]);
  });
});

describe('authoring manifest', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../data/authoring/index.json', import.meta.url), 'utf8'),
  ) as { batches: { file: string; label: string }[] };

  it('lists every wave file with a 1-based label', () => {
    expect(manifest.batches.map(b => b.file)).toEqual([
      'batch-00.json', 'batch-01.json', 'batch-02.json', 'batch-03.json',
      'batch-04.json',
    ]);
    expect(manifest.batches.map(b => b.label)).toEqual([
      'Wave 1 · Signs', 'Wave 2 · Houses', 'Wave 3 · Planets', 'Wave 4 · Aspects',
      'Wave 5 · Synastry',
    ]);
  });
});
