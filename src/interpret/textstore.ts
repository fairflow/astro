import type { AspectClass } from '../chart/aspects.js';
import type { BodyKey } from '../ephemeris/types.js';
import { BODY_NAME } from '../render/glyphs.js';
import { PLANET_PROFILE } from './vocab.js';
import { cap } from './templates.js';
import type { StyleId, StyleTexts } from './types.js';

/**
 * Interpretation texts live in fetched JSON packs (data/texts/), not in
 * the JS bundle — so the authored library can grow (phase B), texts can
 * be updated without rebuilds, and translations become possible.
 * See docs/reports/2026-07-05-implementation-and-deployment.md §6.
 *
 * This module is the runtime registry. The app calls loadTexts() at
 * startup; tests call setTexts() with the same JSON read from disk.
 * Until texts arrive, every consumer degrades to template output.
 */

export type PairEntry = Partial<Record<AspectClass, StyleTexts>>;
export type PairLibrary = Record<string, PairEntry>;
export interface GlossaryEntry { term: string; text: string }

export interface TextPacks {
  natal: PairLibrary;
  transit: PairLibrary;
  bodyIntro: Partial<Record<BodyKey, StyleTexts>>;
  glossary: GlossaryEntry[];
}

const store: TextPacks = { natal: {}, transit: {}, bodyIntro: {}, glossary: [] };

export function setTexts(packs: Partial<TextPacks>): void {
  if (packs.natal) store.natal = packs.natal;
  if (packs.transit) store.transit = packs.transit;
  if (packs.bodyIntro) store.bodyIntro = packs.bodyIntro;
  if (packs.glossary) store.glossary = packs.glossary;
}

export const getNatalLibrary = (): PairLibrary => store.natal;
export const getTransitLibrary = (): PairLibrary => store.transit;
export const getGlossary = (): GlossaryEntry[] => store.glossary;
export const getBodyIntros = (): Partial<Record<BodyKey, StyleTexts>> => store.bodyIntro;

/** Body introduction with a template fallback until texts load. */
export function bodyIntro(body: BodyKey, style: StyleId): string {
  const authored = store.bodyIntro[body]?.[style];
  if (authored) return authored;
  const P = PLANET_PROFILE[body];
  return style === 'minimal'
    ? `${BODY_NAME[body]}: ${P.drive}.`
    : `${cap(P.noun)} — the part of the chart concerned with ${P.drive}.`;
}

let loading: Promise<void> | null = null;

/** Fetch the text packs once (browser). Failures leave template fallbacks. */
export function loadTexts(base = '/texts/'): Promise<void> {
  loading ??= (async () => {
    const get = async (name: string) => {
      const res = await fetch(`${base}${name}.json`);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return res.json();
    };
    const [natal, transit, intro, glossary] = await Promise.allSettled([
      get('library.natal'), get('library.transit'),
      get('bodyintro'), get('glossary'),
    ]);
    setTexts({
      natal: natal.status === 'fulfilled' ? natal.value : undefined,
      transit: transit.status === 'fulfilled' ? transit.value : undefined,
      bodyIntro: intro.status === 'fulfilled' ? intro.value : undefined,
      glossary: glossary.status === 'fulfilled' ? glossary.value : undefined,
    });
  })();
  return loading;
}
