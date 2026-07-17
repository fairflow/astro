<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Chart } from '../chart/chart';
  import { aspectKey } from '../render/wheel';
  import {
    BODY_NAME, SIGN_ELEMENT, SIGN_MODALITY, SIGN_NAMES, SIGN_RULER,
    fmtDegInSign, fmtOrb, signIndex,
  } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import { fmtOffset } from '../chart/civil';
  import {
    modifiersFor, modifierSentence, readingFor,
  } from '../interpret/composer';
  import { bodyIntro } from '../interpret/textstore';
  import { lunationPhase, lunationReading } from '../interpret/dossiers';
  import { markersFor } from '../interpret/markers';
  import { prefs } from './prefs.svelte';
  import {
    ELEMENT_TIP, HOUSE_ARENA, MODALITY_TIP, RULER_TIP, SIGN_TONE,
  } from '../interpret/vocab';
  import { STYLES, type StyleId } from '../interpret/types';
  import type { Selection } from './selection';
  import type { ChartMeta } from './state';

  let { chart, selection, meta, style, onselect }: {
    chart: Chart;
    selection: Selection;
    meta: ChartMeta;
    style: StyleId;
    onselect: (s: Selection) => void;
  } = $props();

  const WAX_TIP = 'The Moon always moves forward through the signs, faster than '
    + 'the Sun. Waxing = Moon 0–180° ahead of the Sun (New → Full, light growing); '
    + 'waning = 180–360° ahead (Full → New, light shrinking).';

  const styleLabel = $derived(STYLES.find(s => s.id === style)?.label ?? style);

  const selAspect = $derived(selection.kind === 'aspect'
    ? chart.aspects.find(a => aspectKey(a) === selection.key) ?? null
    : null);
  const selBody = $derived(selection.kind === 'body'
    ? chart.positions.find(p => p.body === selection.body) ?? null
    : null);
  const selSign = $derived(selection.kind === 'sign' ? selection.index : null);
  const selHouse = $derived(selection.kind === 'house' ? selection.num : null);
  const bodyAspects = $derived(selBody
    ? chart.aspects.filter(a => a.a === selBody.body || a.b === selBody.body)
    : []);
  const signTenants = $derived(selSign !== null
    ? chart.positions.filter(p => signIndex(p.lon) === selSign)
    : []);
  const houseTenants = $derived(selHouse !== null
    ? chart.positions.filter(p => p.house === selHouse)
    : []);
  const houseAspects = $derived(selHouse !== null
    ? chart.aspects.filter(a =>
        houseTenants.some(t => t.body === a.a || t.body === a.b))
    : []);

  function pos(body: string) {
    return chart.positions.find(p => p.body === body)!;
  }

  const GLOSS: Record<string, string> = {
    challenge: 'Squares and oppositions: friction between the two functions that forces growth.',
    flowing: 'Trines and sextiles: the two functions cooperate naturally.',
    neutral: 'Conjunction: the two functions fuse and act as one.',
    adjusting: 'Quincunx: no common ground — perpetual small recalibrations.',
    applying: 'Still closing in on exact — the aspect is building and felt more strongly.',
    separating: 'Past exact — the influence is fading or being digested.',
  };

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
      {selAspect.def.name} ({selAspect.def.angle}°) ·
      <span data-tip={GLOSS[selAspect.def.klass]}>{selAspect.def.klass}</span> ·
      <span data-tip={GLOSS[selAspect.applying ? 'applying' : 'separating']}>{selAspect.applying ? 'applying' : 'separating'}</span>
    </div>
    <div class="row"><Glyph body={selAspect.a} size={15} /> {fmtDegInSign(A.lon)} · H{A.house}</div>
    <div class="row"><Glyph body={selAspect.b} size={15} /> {fmtDegInSign(B.lon)} · H{B.house}</div>
    <div class="row"><span class="k">Orb</span> <b>{fmtOrb(selAspect.orb)}</b> of {selAspect.maxOrb}° allowed</div>
    <div class="orbbar"><i style={`width:${(1 - selAspect.orb / selAspect.maxOrb) * 100}%`}></i></div>
    {@const reading = readingFor(selAspect, style)}
    {@const mods = modifiersFor(chart, selAspect)}
    {@const mk = markersFor(selAspect)}
    {#key style + selection.key}
      <div class="reading" in:fade={{ duration: 200 }}>
        <div class="stylenote">{styleLabel} reading</div>
        {reading.text} <span class="src">{reading.source}</span>
      </div>
    {/key}
    <div class="markers">
      <span class="k">Markers</span>
      {#each mk.keywords as kw}<span class="chip">{kw}</span>{/each}
      <div class="q">Ask: {mk.question}</div>
    </div>
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
    {#key style + selBody.body}
      <div class="reading" in:fade={{ duration: 200 }} style="margin:4px 0 10px">
        <div class="stylenote">{styleLabel} introduction</div>
        {bodyIntro(selBody.body, style)}
      </div>
    {/key}
    <div class="row">{fmtDegInSign(selBody.lon)} · H{selBody.house}</div>
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
  {:else if selHouse !== null}
    <h2 class="serif">House {selHouse}</h2>
    <div class="sub">cusp {fmtDegInSign(chart.houses.cusps[selHouse - 1]!)}</div>
    <div class="reading" style="margin-top:6px">
      Arena: {HOUSE_ARENA[selHouse - 1]}. The house is the <i>where</i> of the
      chart — planets placed here bring their function to this area of life.
    </div>
    {#if houseTenants.length}
      <div class="sub" style="margin-top:10px">in this house</div>
      {#each houseTenants as t (t.body)}
        <button class="row" style="background:none;border:none;color:inherit;display:block;text-align:left;padding:0 0 2px"
          onclick={() => onselect({ kind: 'body', body: t.body })}>
          <Glyph body={t.body} size={14} /> {BODY_NAME[t.body]} · {fmtDegInSign(t.lon)}
        </button>
      {/each}
    {:else}
      <div class="hint" style="margin-top:8px">No bodies in this house in this chart.</div>
    {/if}
    {#if houseAspects.length}
      <div class="sub" style="margin-top:10px">aspects touching this house</div>
      {#each houseAspects as a (aspectKey(a))}
        <button class="row" style="background:none;border:none;color:inherit;display:block;text-align:left;padding:0 0 2px"
          onclick={() => onselect({ kind: 'aspect', key: aspectKey(a) })}>
          <Glyph body={a.a} size={14} /> <Glyph aspect={a.def.name} size={13} /> <Glyph body={a.b} size={14} />
          {BODY_NAME[a.a]}–{BODY_NAME[a.b]} · {fmtOrb(a.orb)}
        </button>
      {/each}
    {/if}
  {:else if selSign !== null}
    <h2 class="serif"><Glyph sign={selSign} size={18} /> {SIGN_NAMES[selSign]}</h2>
    <div class="sub">
      <span data-tip={ELEMENT_TIP[SIGN_ELEMENT[selSign]!]}>{SIGN_ELEMENT[selSign]}</span> ·
      <span data-tip={MODALITY_TIP[SIGN_MODALITY[selSign]!]}>{SIGN_MODALITY[selSign]}</span> ·
      <span data-tip={RULER_TIP}>ruled by {BODY_NAME[SIGN_RULER[selSign]!]}</span>
    </div>
    <div class="reading" style="margin-top:6px">
      Tone: {SIGN_TONE[selSign]}. Planets placed here take on this manner of
      expression — the sign is the <i>how</i>, the house the <i>where</i>.
    </div>
    {#if signTenants.length}
      <div class="sub" style="margin-top:10px">in this sign</div>
      {#each signTenants as t (t.body)}
        <button class="row" style="background:none;border:none;color:inherit;display:block;text-align:left;padding:0 0 2px"
          onclick={() => onselect({ kind: 'body', body: t.body })}>
          <Glyph body={t.body} size={14} /> {BODY_NAME[t.body]} · {fmtDegInSign(t.lon)} · H{t.house}
        </button>
      {/each}
    {:else}
      <div class="hint" style="margin-top:8px">No bodies in this sign in this chart.</div>
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
      Tap an aspect line, a planet, a sign glyph, a house number, or a row in the aspect list.
    </div>
  {/if}

  <!-- Moon phase: persistent (independent of selection), toggleable in Settings -->
  {#if prefs.showMoonPhase}
    {@const sunp = chart.positions.find(p => p.body === 'sun')}
    {@const moonp = chart.positions.find(p => p.body === 'moon')}
    {#if sunp && moonp}
      {@const ph = lunationPhase(sunp.lon, moonp.lon)}
      <div class="moonphase">
        <div class="mphead">
          <Glyph body="moon" size={15} />
          <b>{ph.name}</b>
          <span class="waxwane" data-tip={WAX_TIP}>{ph.waxing ? 'waxing' : 'waning'}</span>
          <span class="mpangle">· Sun–Moon {Math.round(ph.angle)}°</span>
        </div>
        {#key style + ph.index}
          <p class="mpread" in:fade={{ duration: 200 }}>{lunationReading(ph.index, style)}</p>
        {/key}
      </div>
    {/if}
  {/if}
</div>
