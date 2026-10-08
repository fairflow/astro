<script lang="ts">
  import GlyphDefs from './GlyphDefs.svelte';
  import RetrogradeView from './RetrogradeView.svelte';
  import { CoreProvider } from '../ephemeris/core';
  import { DEFAULT_DISPLAY } from './state';

  // Every planet and the Sun come from CoreProvider; no packs needed.
  const provider = new CoreProvider();
  const display = DEFAULT_DISPLAY;

  // The page owns its theme here (in the app the Retrograde tab follows the app's setting).
  // Remembered on this device; the app's light palette is the same `light` class on <html>.
  const KEY = 'retrograde-theme';
  let theme = $state<'dark' | 'light'>('dark');
  try { if (localStorage.getItem(KEY) === 'light') theme = 'light'; } catch { /* storage blocked */ }
  $effect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* storage blocked */ }
  });
</script>

<GlyphDefs style={{ weight: display.weight, slant: display.slant }} />

<header class="rhead">
  <h1>Planetary Retrogrades</h1>
  <p>The planets seen from Earth against the fixed stars, from the
    <a href="https://fairflow.github.io/writing/astro/" target="_blank" rel="noopener">Astrodynamics</a> ephemeris
    (v{__APP_VERSION__}).</p>
</header>
<RetrogradeView {provider} {display} standalone {theme} onthemechange={t => theme = t} />

<style>
  .rhead {
    max-width: 1220px; margin: 0 auto; padding: 18px 24px 4px;
    display: flex; flex-wrap: wrap; gap: 4px 20px; align-items: baseline; justify-content: space-between;
  }
  .rhead h1 { color: var(--gold); font-weight: 400; font-size: 26px; letter-spacing: .04em; }
  .rhead p { color: var(--dim); font-size: 13px; max-width: 60ch; }
  .rhead a { color: var(--gold); }
  @media (max-width: 920px) { .rhead { padding-inline: 16px; } }
</style>
