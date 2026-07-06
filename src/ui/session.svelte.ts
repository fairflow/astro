import type { SavedChart } from '../store/db.js';

/**
 * Cross-tab session state (user request 2026-07-06 #1): the partner
 * selection and transit date/target must survive switching between
 * Natal / Transits / Synastry / Composite, whose view components are
 * created and destroyed by the mode tabs. Persisted to localStorage
 * (via App's $effect) so a page refresh restores the working state too.
 */
interface Session {
  partner: SavedChart | null;
  transitDate: string;
  transitTime: string;
  transitTarget: 'you' | 'couple';
}

const DEFAULTS: Session = {
  partner: null, transitDate: '', transitTime: '', transitTarget: 'you',
};

const KEY = 'astro-session';

function load(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) as Partial<Session> };
  } catch { /* fresh defaults */ }
  return { ...DEFAULTS };
}

export const session = $state<Session>(
  typeof localStorage === 'undefined' ? { ...DEFAULTS } : load());

export function storeSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* private mode */ }
}
