<script lang="ts">
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import { readingFor } from '../interpret/composer';
  import type { StyleId } from '../interpret/types';
  import type { Selection } from './selection';

  let { chart, selection, style }: {
    chart: Chart;
    selection: Selection;
    style: StyleId;
  } = $props();

  const aspect = $derived(selection.kind === 'aspect'
    ? chart.aspects.find(a => aspectKey(a) === selection.key) ?? null
    : null);
  const body = $derived(selection.kind === 'body'
    ? chart.positions.find(p => p.body === selection.body) ?? null
    : null);
</script>

{#if aspect}
  {@const A = chart.positions.find(p => p.body === aspect.a)!}
  {@const B = chart.positions.find(p => p.body === aspect.b)!}
  <h3 class="serif">{BODY_NAME[aspect.a]} {aspect.def.name} {BODY_NAME[aspect.b]}</h3>
  <div class="facts">
    {fmtDegInSign(A.lon)} (house {A.house}) · {fmtDegInSign(B.lon)} (house {B.house})
    · orb {fmtOrb(aspect.orb)} · {aspect.applying ? 'applying' : 'separating'}
  </div>
  <p>{readingFor(aspect, style).text}</p>
{:else if body}
  <h3 class="serif">{BODY_NAME[body.body]}{body.speed < 0 ? ' ℞' : ''}</h3>
  <div class="facts">{fmtDegInSign(body.lon)} · house {body.house} · {body.speed.toFixed(2)}°/day</div>
  <p>{chart.aspects.filter(a => a.a === body.body || a.b === body.body).length}
    aspects in orb — highlighted on the wheel; tap one for its reading.</p>
{/if}

<style>
  h3 { color: var(--gold); font-size: 16px; margin-bottom: 3px; }
  .facts { color: var(--dim); font-size: 12.5px; margin-bottom: 7px; }
  p { font-size: 13.5px; line-height: 1.5; max-height: 9.5em; overflow-y: auto; }
</style>
