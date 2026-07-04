<script lang="ts">
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import {
    ASPECT_COLOR, ASPECT_GLYPH, BODY_GLYPH, BODY_NAME, VS, fmtOrb,
  } from '../render/glyphs';
  import type { Selection } from './selection';

  let { chart, selection, onselect }: {
    chart: Chart;
    selection: Selection;
    onselect: (s: Selection) => void;
  } = $props();
</script>

<div class="aspectlist">
  <h3>Aspects · strongest first</h3>
  {#each chart.aspects as a (aspectKey(a))}
    <button
      class="row"
      class:sel={selection.kind === 'aspect' && selection.key === aspectKey(a)}
      onclick={() => onselect({ kind: 'aspect', key: aspectKey(a) })}
    >
      <span class="g">{BODY_GLYPH[a.a]}{VS}</span>
      <span class="a" style={`color:var(${ASPECT_COLOR[a.def.name]})`}>{ASPECT_GLYPH[a.def.name]}</span>
      <span class="g">{BODY_GLYPH[a.b]}{VS}</span>
      <span>{BODY_NAME[a.a]} – {BODY_NAME[a.b]}</span>
      <span class="as">{a.applying ? 'a' : 's'}</span>
      <span class="orb">{fmtOrb(a.orb)}</span>
    </button>
  {/each}
</div>
