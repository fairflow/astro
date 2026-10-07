<script lang="ts">
  import GlyphDefs from './GlyphDefs.svelte';
  import RetrogradeView from './RetrogradeView.svelte';
  import { CoreProvider } from '../ephemeris/core';
  import { DEFAULT_DISPLAY } from './state';

  // Mercury, Venus and the Sun all come from CoreProvider; no packs needed.
  const provider = new CoreProvider();
  const display = DEFAULT_DISPLAY;
</script>

<GlyphDefs style={{ weight: display.weight, slant: display.slant }} />

<header class="rhead">
  <h1>Inner Planet Retrogrades</h1>
  <p>Mercury and Venus seen from Earth against the fixed stars, from the
    <a href="https://fairflow.github.io/astro/" target="_blank" rel="noopener">Astrodynamics</a> ephemeris.</p>
</header>
<RetrogradeView {provider} {display} />

<style>
  :global(:root) { color-scheme: dark; }
  .rhead {
    max-width: 1220px; margin: 0 auto; padding: 18px 24px 4px;
    display: flex; flex-wrap: wrap; gap: 4px 20px; align-items: baseline; justify-content: space-between;
  }
  .rhead h1 { color: var(--gold); font-weight: 400; font-size: 26px; letter-spacing: .04em; }
  .rhead p { color: var(--dim); font-size: 13px; max-width: 60ch; }
  .rhead a { color: var(--gold); }
  @media (max-width: 920px) { .rhead { padding-inline: 16px; } }
</style>
