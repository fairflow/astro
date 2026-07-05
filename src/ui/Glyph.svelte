<script lang="ts">
  import { aspectGlyphId, bodyGlyphId, signGlyphId } from '../render/glyphset';
  import type { BodyKey } from '../ephemeris/types';
  import type { AspectName } from '../chart/aspects';

  let { body, sign, aspect, size = 16, color }: {
    body?: BodyKey;
    sign?: number;
    aspect?: AspectName;
    size?: number;
    color?: string;
  } = $props();

  const href = $derived(body !== undefined ? `#${bodyGlyphId(body)}`
    : sign !== undefined ? `#${signGlyphId(sign)}`
    : aspect !== undefined ? `#${aspectGlyphId(aspect)}`
    : '');
</script>

<svg
  class="iglyph"
  viewBox="0 0 100 100"
  width={size}
  height={size}
  style={color ? `color:${color}` : undefined}
  aria-hidden="true"
><use {href} /></svg>

<style>
  .iglyph { vertical-align: -0.16em; overflow: visible; }
</style>
