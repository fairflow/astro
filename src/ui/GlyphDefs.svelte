<script lang="ts">
  import {
    ASPECT_GLYPHS_SVG, BODY_GLYPHS, SIGN_GLYPHS_SVG,
    aspectGlyphId, bodyGlyphId, signGlyphId, type GlyphStyle,
  } from '../render/glyphset';
  import type { GlyphDef } from '../render/glyphset';

  let { style }: { style: GlyphStyle } = $props();

  const entries = $derived.by(() => {
    const out: { id: string; def: GlyphDef }[] = [];
    for (const [body, def] of Object.entries(BODY_GLYPHS)) {
      out.push({ id: bodyGlyphId(body as never), def });
    }
    SIGN_GLYPHS_SVG.forEach((def, i) => out.push({ id: signGlyphId(i), def }));
    for (const [name, def] of Object.entries(ASPECT_GLYPHS_SVG)) {
      out.push({ id: aspectGlyphId(name as never), def });
    }
    return out;
  });

  const transform = $derived(style.slant
    ? `translate(50 50) skewX(${-style.slant}) translate(-50 -50)`
    : undefined);
</script>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    {#each entries as e (e.id)}
      <symbol id={e.id} viewBox="0 0 100 100" overflow="visible">
        <g {transform}>
          <path
            d={e.def.d}
            fill="none"
            stroke="currentColor"
            stroke-width={style.weight}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          {#if e.def.dots}
            {#each e.def.dots as [cx, cy, r]}
              <circle {cx} {cy} {r} fill="currentColor" />
            {/each}
          {/if}
        </g>
      </symbol>
    {/each}
  </defs>
</svg>
