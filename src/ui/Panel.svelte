<script lang="ts">
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import { fmtOffset } from '../chart/civil';
  import {
    modifiersFor, modifierSentence, readingFor,
  } from '../interpret/composer';
  import type { StyleId } from '../interpret/types';
  import type { Selection } from './selection';
  import type { ChartMeta } from './state';

  let { chart, selection, meta, style, onselect }: {
    chart: Chart;
    selection: Selection;
    meta: ChartMeta;
    style: StyleId;
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
      {BODY_NAME[selAspect.a]} <Glyph aspect={selAspect.def.name} size={16} /> {BODY_NAME[selAspect.b]}
    </h2>
    <div class="sub">
      {selAspect.def.name} ({selAspect.def.angle}°) · {selAspect.def.klass} ·
      {selAspect.applying ? 'applying' : 'separating'}
    </div>
    <div class="row"><Glyph body={selAspect.a} size={15} /> {fmtDegInSign(A.lon)} · house {A.house}</div>
    <div class="row"><Glyph body={selAspect.b} size={15} /> {fmtDegInSign(B.lon)} · house {B.house}</div>
    <div class="row"><span class="k">Orb</span> <b>{fmtOrb(selAspect.orb)}</b> of {selAspect.maxOrb}° allowed</div>
    <div class="orbbar"><i style={`width:${(1 - selAspect.orb / selAspect.maxOrb) * 100}%`}></i></div>
    {@const reading = readingFor(selAspect, style)}
    {@const mods = modifiersFor(chart, selAspect)}
    <div class="reading">{reading.text} <span class="src">{reading.source}</span></div>
    {#if mods.length}
      <div class="modhead">Modified by</div>
      {#each mods as m}
        <div class="mod">{modifierSentence(m, style)}</div>
      {/each}
    {/if}
  {:else if selBody}
    <h2 class="serif"><Glyph body={selBody.body} size={17} /> {BODY_NAME[selBody.body]}
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
          <Glyph body={a.a} size={14} /> <Glyph aspect={a.def.name} size={13} /> <Glyph body={a.b} size={14} />
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
