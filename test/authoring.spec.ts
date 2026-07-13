import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STYLES } from '../src/interpret/types';

/** The shipped batch JSON is a contract between authoring_sheet.py,
 *  authoring_ingest.py and AuthoringView — validate its shape here. */
const batch = JSON.parse(
  readFileSync(new URL('../data/authoring/batch-00.json', import.meta.url), 'utf8'),
) as {
  batch: number; wave: number; title: string;
  slots: {
    id: string; kind: string; label: string; kernel: string;
    texts: Record<string, string>; markers: string[]; ask: string;
  }[];
};

describe('authoring batch 00 (wave 0)', () => {
  it('covers the frame: 6 sign axes + 12 sign inflections', () => {
    expect(batch.slots.filter(s => s.kind === 'sign-axis')).toHaveLength(6);
    expect(batch.slots.filter(s => s.kind === 'sign-inflection')).toHaveLength(12);
  });

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

  it('every sign inflection names its opposite pole (polarity is structural)', () => {
    const signs = batch.slots.filter(s => s.kind === 'sign-inflection');
    for (const s of signs) {
      expect(s.label, s.id).toMatch(/pole of the .+–.+ axis/);
    }
  });

  it('revision provenance is well-formed where present', () => {
    for (const s of batch.slots as (typeof batch.slots[number] & {
      revision?: { note: string; basedOn?: string; prevKernel?: string;
        prevTexts?: Record<string, string> };
    })[]) {
      const rev = s.revision;
      if (!rev) continue;
      // must explain the change and carry the "before" for the diff view
      expect(rev.note?.length, s.id).toBeGreaterThan(10);
      expect(rev.prevKernel || rev.prevTexts, `${s.id} has a before`).toBeTruthy();
      if (rev.prevTexts) {
        for (const st of STYLES) {
          expect(rev.prevTexts[st.id]?.length, `${s.id}.prev.${st.id}`).toBeGreaterThan(10);
        }
      }
    }
  });
});
