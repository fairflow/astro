import {
  DEFAULT_ASPECTS, type AspectDef, type AspectName,
} from '../chart/aspects.js';
import type { BodyKey } from '../ephemeris/types.js';

/**
 * Calculation settings (user request 2026-07-06 #2): which bodies and
 * which aspects participate in charts, wheels and interpretations.
 * Persisted in localStorage; Sun and Moon cannot be disabled (the
 * luminaries anchor houses, dossiers and the lunation phase).
 */

export const BODY_GROUPS: { label: string; bodies: BodyKey[] }[] = [
  { label: 'Luminaries & inner', bodies: ['sun', 'moon', 'mercury', 'venus', 'mars'] },
  { label: 'Outer', bodies: ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] },
  { label: 'Minors & points', bodies: ['chiron', 'ceres', 'pallas', 'juno', 'vesta', 'eris', 'meanNode', 'lilith'] },
];

export const LOCKED_BODIES: BodyKey[] = ['sun', 'moon'];

export interface CalcPrefs {
  bodies: Record<BodyKey, boolean>;
  aspects: Record<AspectName, boolean>;
  /** Show the natal Moon-phase block in the reading panel. This is about
   *  *what* the reading includes (like bodies/aspects), not how it is drawn. */
  showMoonPhase: boolean;
}

export function defaultPrefs(): CalcPrefs {
  const bodies = {} as Record<BodyKey, boolean>;
  for (const g of BODY_GROUPS) for (const b of g.bodies) bodies[b] = true;
  const aspects = {} as Record<AspectName, boolean>;
  for (const d of DEFAULT_ASPECTS) aspects[d.name] = true;
  return { bodies, aspects, showMoonPhase: true };
}

/** Pure helpers (unit-tested without the rune wrapper). */
export function filterBodies(p: CalcPrefs): BodyKey[] {
  const out: BodyKey[] = [];
  for (const g of BODY_GROUPS) {
    for (const b of g.bodies) {
      if (p.bodies[b] || LOCKED_BODIES.includes(b)) out.push(b);
    }
  }
  return out;
}

export function filterAspectDefs(p: CalcPrefs): AspectDef[] {
  return DEFAULT_ASPECTS.filter(d => p.aspects[d.name]);
}

const KEY = 'astro-calc-prefs';

function load(): CalcPrefs {
  const d = defaultPrefs();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<CalcPrefs>;
      return {
        bodies: { ...d.bodies, ...saved.bodies },
        aspects: { ...d.aspects, ...saved.aspects },
        showMoonPhase: saved.showMoonPhase ?? d.showMoonPhase,
      };
    }
  } catch { /* fresh defaults */ }
  return d;
}

export const prefs = $state<CalcPrefs>(
  typeof localStorage === 'undefined' ? defaultPrefs() : load());

export function storePrefs(p: CalcPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* private mode */ }
}

export const enabledBodies = (): BodyKey[] => filterBodies(prefs);
export const enabledAspectDefs = (): AspectDef[] => filterAspectDefs(prefs);
