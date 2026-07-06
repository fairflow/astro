import type { SavedChart } from '../store/db.js';

/**
 * Cross-tab session state (user request 2026-07-06 #1): the partner
 * selection and transit date/target must survive switching between
 * Natal / Transits / Synastry / Composite, whose view components are
 * created and destroyed by the mode tabs.
 */
export const session = $state({
  partner: null as SavedChart | null,
  transitDate: '',
  transitTime: '',
  transitTarget: 'you' as 'you' | 'couple',
});
