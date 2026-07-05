<script lang="ts">
  import GlyphDefs from './GlyphDefs.svelte';
  import { BODY_GLYPHS, bodyGlyphId, signGlyphId, aspectGlyphId } from '../render/glyphset';
  import { BODY_NAME, SIGN_NAMES } from '../render/glyphs';
  import { DEFAULT_ASPECTS } from '../chart/aspects';
  import type { BodyKey } from '../ephemeris/types';

  // Dev review page: /?glyphs — every glyph at a tunable weight/slant.
  let weight = $state(7);
  let slant = $state(0);
  const bodies = Object.keys(BODY_GLYPHS) as BodyKey[];
</script>

<GlyphDefs style={{ weight, slant }} />

<section>
  <h2>Glyph kit</h2>
  <div class="controls">
    <label>weight {weight}<input type="range" min="4" max="12" step="0.5" bind:value={weight}></label>
    <label>slant {slant}°<input type="range" min="0" max="14" step="1" bind:value={slant}></label>
  </div>
  <div class="sheet">
    {#each bodies as b}
      <figure><svg viewBox="0 0 100 100" class="cell">
        <use href={`#${bodyGlyphId(b)}`} />
      </svg><figcaption>{BODY_NAME[b]}</figcaption></figure>
    {/each}
    {#each SIGN_NAMES as n, i}
      <figure><svg viewBox="0 0 100 100" class="cell sign">
        <use href={`#${signGlyphId(i)}`} />
      </svg><figcaption>{n}</figcaption></figure>
    {/each}
    {#each DEFAULT_ASPECTS as a}
      <figure><svg viewBox="0 0 100 100" class="cell asp">
        <use href={`#${aspectGlyphId(a.name)}`} />
      </svg><figcaption>{a.name}</figcaption></figure>
    {/each}
  </div>
</section>

<style>
  section { padding: 14px 22px; }
  h2 { color: var(--gold); margin: 8px 0; }
  .controls { display: flex; gap: 24px; margin: 10px 0 16px; color: var(--dim); font-size: 13px; }
  .controls label { display: flex; gap: 10px; align-items: center; }
  .sheet { display: flex; flex-wrap: wrap; gap: 10px; }
  figure { width: 76px; text-align: center; margin: 0; }
  .cell {
    width: 62px; height: 62px; color: var(--ink);
    background: var(--bg2); border: 1px solid var(--line); border-radius: 8px;
    padding: 9px;
  }
  .cell.sign { color: var(--gold); }
  .cell.asp { color: var(--trine); }
  figcaption { font-size: 9.5px; color: var(--dim); margin-top: 2px; }
</style>
