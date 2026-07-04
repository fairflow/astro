<script lang="ts">
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import {
    ASPECT_GLYPH, BODY_GLYPH, BODY_NAME, VS, fmtDegInSign, fmtOrb,
  } from '../render/glyphs';
  import { fmtOffset } from '../chart/civil';
  import type { Selection } from './selection';
  import type { ChartMeta } from './state';

  let { chart, selection, meta, onselect }: {
    chart: Chart;
    selection: Selection;
    meta: ChartMeta;
    onselect: (s: Selection) => void;
  } = $props();

  const selAspect = $derived(selection.kind === 'aspect'
    ? chart.aspects.find(a => aspectKey(a) === selection.key) ?? null
    : null);
  const selBody = $derived(selection.kind === 'body'
    ? chart.positions.find(p => p.body === selection.body) ?? null
    : null);
  const bodyAspects = $derived(selBody
    ? chart.aspects.filter(a => a.a === selBody.body || a.b === selBody.body)
    : []);

  function pos(body: string) {
    return chart.positions.find(p => p.body === body)!;
  }

  const ACCURACY_NOTE: Record<string, string> = {
    exact: '',
    '5min': 'Birth time ±5 min: house cusps uncertain by roughly ±1°.',
    '30min': 'Birth time ±30 min: Ascendant/MC uncertain by several degrees; cusp-edge placements are provisional.',
    '2h': 'Birth time ±2 h: houses and angles are unreliable; sign positions remain valid.',
    unknown: 'Birth time unknown (noon used): ignore houses, angles and exact Moon degree.',
  };
</script>

<div class="panel">
  {#if selAspect}
    {@const A = pos(selAspect.a)}
    {@const B = pos(selAspect.b)}
    <h2 class="serif">
      {BODY_NAME[selAspect.a]} {ASPECT_GLYPH[selAspect.def.name]} {BODY_NAME[selAspect.b]}
    </h2>
    <div class="sub">
      {selAspect.def.name} ({selAspect.def.angle}°) · {selAspect.def.klass} ·
      {selAspect.applying ? 'applying' : 'separating'}
    </div>
    <div class="row">{BODY_GLYPH[selAspect.a]}{VS} {fmtDegInSign(A.lon)} · house {A.house}</div>
    <div class="row">{BODY_GLYPH[selAspect.b]}{VS} {fmtDegInSign(B.lon)} · house {B.house}</div>
    <div class="row"><span class="k">Orb</span> <b>{fmtOrb(selAspect.orb)}</b> of {selAspect.maxOrb}° allowed</div>
    <div class="orbbar"><i style={`width:${(1 - selAspect.orb / selAspect.maxOrb) * 100}%`}></i></div>
    <div class="hint">Interpretations arrive with M3 — this panel will show the reading here, in your chosen style.</div>
  {:else if selBody}
    <h2 class="serif">{BODY_GLYPH[selBody.body]}{VS} {BODY_NAME[selBody.body]}
      {#if selBody.speed < 0}<span class="retro">℞</span>{/if}
    </h2>
    <div class="sub">natal position</div>
    <div class="row">{fmtDegInSign(selBody.lon)} · house {selBody.house}</div>
    <div class="row"><span class="k">Speed</span> {selBody.speed.toFixed(3)}°/day
      {selBody.speed < 0 ? '(retrograde)' : ''}</div>
    <div class="row"><span class="k">Latitude</span> {selBody.lat.toFixed(2)}°</div>
    {#if bodyAspects.length}
      <div class="sub" style="margin-top:10px">aspects</div>
      {#each bodyAspects as a (aspectKey(a))}
        <button class="row" style="background:none;border:none;color:inherit;display:block;text-align:left;padding:0 0 2px"
          onclick={() => onselect({ kind: 'aspect', key: aspectKey(a) })}>
          {BODY_GLYPH[a.a]}{VS} {ASPECT_GLYPH[a.def.name]} {BODY_GLYPH[a.b]}{VS}
          {BODY_NAME[a.a]}–{BODY_NAME[a.b]} · {fmtOrb(a.orb)}
        </button>
      {/each}
    {/if}
  {:else}
    <h2 class="serif">{meta.name || meta.place.name}</h2>
    <div class="sub">
      {meta.date} {meta.time} ({fmtOffset(meta.offsetMinutes)}) ·
      {meta.place.name}, {meta.place.country}
    </div>
    <div class="row"><span class="k">ASC</span> {fmtDegInSign(chart.houses.asc)}</div>
    <div class="row"><span class="k">MC</span> {fmtDegInSign(chart.houses.mc)}</div>
    <div class="row"><span class="k">Houses</span> {chart.houses.system}{chart.houses.polarFallback ? ' (Placidus undefined at this latitude)' : ''}</div>
    <div class="cusps">
      {#each chart.houses.cusps as c, i}
        <div><span class="h">{i + 1}</span>{fmtDegInSign(c)}</div>
      {/each}
    </div>
    {#if ACCURACY_NOTE[meta.accuracy]}
      <div class="warn">⚠ {ACCURACY_NOTE[meta.accuracy]}</div>
    {/if}
    {#if chart.missing.length}
      <div class="warn">Not covered at this date: {chart.missing.map(b => BODY_NAME[b]).join(', ')}.</div>
    {/if}
    <div class="hint" style="margin-top:10px">
      Tap an aspect line, a planet, or a row in the aspect list.
    </div>
  {/if}
</div>
