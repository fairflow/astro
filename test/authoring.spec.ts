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

describe('authoring batch 00 (wave 0 — signs)', () => {
  it('covers the frame: 6 sign axes + 12 sign inflections', () => {
    expect(batch00.slots.filter(s => s.kind === 'sign-axis')).toHaveLength(6);
    expect(batch00.slots.filter(s => s.kind === 'sign-inflection')).toHaveLength(12);
  });
  checkCommonShape(batch00);
});

describe('authoring batch 01 (wave 1 — houses)', () => {
  it('covers the frame: 6 house axes + 12 house inflections', () => {
    expect(batch01.slots.filter(s => s.kind === 'house-axis')).toHaveLength(6);
    expect(batch01.slots.filter(s => s.kind === 'house-inflection')).toHaveLength(12);
  });
  it('is batch 1 with its own reaction namespace', () => {
    expect(batch01.batch).toBe(1);
  });
  checkCommonShape(batch01);
});

describe('authoring manifest', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../data/authoring/index.json', import.meta.url), 'utf8'),
  ) as { batches: { file: string; label: string }[] };

  it('lists both wave files with labels', () => {
    const files = manifest.batches.map(b => b.file);
    expect(files).toContain('batch-00.json');
    expect(files).toContain('batch-01.json');
    for (const b of manifest.batches) expect(b.label).toBeTruthy();
  });
});
