/**
 * Skins (issue #2): a skin is a named set of CSS custom-property
 * overrides applied inline on <html>. Inline style wins over every
 * theme/contrast class, so a skin overrides theme × contrast wholesale.
 * 'auto' (no skin) leaves the theme system in charge. The same var-map
 * mechanism is the foundation for the skin builder (issue #3) — a
 * user-defined skin is just another Skin object.
 */
export interface Skin {
  id: string;
  label: string;
  vars: Record<string, string>;
}

/** Black-on-white print skin (issues #2/#4): single-ink, paper-safe. */
export const BW_SKIN: Skin = {
  id: 'bw',
  label: 'Black on white (print)',
  vars: {
    '--bg': '#ffffff', '--bg2': '#ffffff', '--panel': '#ffffff',
    '--line': '#3d3d3d', '--ink': '#000000', '--dim': '#333333',
    '--gold': '#000000', '--gold-dim': '#555555',
    '--trine': '#1a1a1a', '--sextile': '#1a1a1a', '--square': '#000000',
    '--opp': '#000000', '--conj': '#000000', '--quincunx': '#3d3d3d',
    '--transit': '#2a2a2a', '--syn': '#2a2a2a',
    '--fire': '#000000', '--earth': '#000000', '--air': '#000000', '--water': '#000000',
    '--hub': '#ffffff', '--houseband': 'rgba(0, 0, 0, 0.06)',
    '--on-gold': '#ffffff',
    '--rowhover': '#eeeeee', '--rowsel': '#e2e2e2', '--badgebg': '#eeeeee',
    '--header-top': '#ffffff',
  },
};

export const SKINS: Skin[] = [BW_SKIN];

export type SkinId = 'auto' | 'bw';

export function skinById(id: SkinId): Skin | null {
  return SKINS.find(s => s.id === id) ?? null;
}

/** Apply a skin's overrides (null = back to the theme system). */
export function applySkin(skin: Skin | null): void {
  const st = document.documentElement.style;
  for (const s of SKINS) {
    for (const k of Object.keys(s.vars)) st.removeProperty(k);
  }
  if (skin) {
    for (const [k, v] of Object.entries(skin.vars)) st.setProperty(k, v);
  }
}
