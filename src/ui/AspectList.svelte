<script lang="ts">
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import { ASPECT_COLOR, BODY_NAME, fmtOrb } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import type { Selection } from './selection';

  let { chart, selection, onselect }: {
    chart: Chart;
    selection: Selection;
    onselect: (s: Selection) => void;
  } = $props();

  function house(body: string): number {
    return chart.positions.find(p => p.body === body)?.house ?? 0;
  }
</script>

<div class="aspectlist">
  <h3>Aspects · strongest first</h3>
  {#each chart.aspects as a (aspectKey(a))}
    <button
      class="row"
      class:sel={selection.kind === 'aspect' && selection.key === aspectKey(a)}
      onclick={() => onselect({ kind: 'aspect', key: aspectKey(a) })}
    >
      <span class="g"><Glyph body={a.a} size={17} /></span>
      <span class="a"><Glyph aspect={a.def.name} size={15} color={`var(${ASPECT_COLOR[a.def.name]})`} /></span>
      <span class="g"><Glyph body={a.b} size={17} /></span>
      <span>{BODY_NAME[a.a]} <i class="hn">H{house(a.a)}</i> – {BODY_NAME[a.b]} <i class="hn">H{house(a.b)}</i></span>
      <span class="as">{a.applying ? 'a' : 's'}</span>
      <span class="orb">{fmtOrb(a.orb)}</span>
    </button>
  {/each}
</div>
