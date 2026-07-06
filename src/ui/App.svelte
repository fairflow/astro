<script lang="ts">
  import { onMount } from 'svelte';
  import ChartForm from './ChartForm.svelte';
  import Wheel from './Wheel.svelte';
  import Panel from './Panel.svelte';
  import AspectList from './AspectList.svelte';
  import SavedCharts from './SavedCharts.svelte';
  import GlyphDefs from './GlyphDefs.svelte';
  import DisplayControls from './DisplayControls.svelte';
  import Themes from './Themes.svelte';
  import TransitsView from './TransitsView.svelte';
  import OverlayInfo from './OverlayInfo.svelte';
  import Glossary from './Glossary.svelte';
  import { chartSnapshot } from '../interpret/snapshot';
  import { loadTexts } from '../interpret/textstore';
  import SynastryView from './SynastryView.svelte';
  import CompositeView from './CompositeView.svelte';
  import { STYLES, type StyleId } from '../interpret/types';
  import { fetchPacks, PACK_BODIES } from '../ephemeris/packs';
  import { fetchGazetteer, type Gazetteer } from '../store/gazetteer';
  import { computeChart, defaultProvider } from '../chart/chart';
  import { localToUt } from '../chart/civil';
  import type { ChebPack } from '../ephemeris/chebyshev';
  import type { SavedChart } from '../store/db';
  import type { Selection } from './selection';
  import {
    loadDisplay, storeDisplay, type ChartMeta, type FormState,
  } from './state';

  let packs = $state<ChebPack[]>([]);
  let gaz = $state<Gazetteer | null>(null);
  let banner = $state('');
  let copied = $state(false);

  async function copySnapshot() {
    if (!chart || !current) return;
    const text = chartSnapshot(chart, current.meta);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback for contexts where the async clipboard API is blocked
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        banner = 'Clipboard unavailable in this browser context.';
        ta.remove();
        return;
      }
      ta.remove();
    }
    copied = true;
    setTimeout(() => copied = false, 2200);
  }
  let form = $state<FormState>({
    name: '', date: '', time: '12:00', accuracy: 'exact', place: null,
  });
  let current = $state<{ jdUt: number; lat: number; lon: number; meta: ChartMeta } | null>(null);
  let selection = $state<Selection>({ kind: 'none' });
  let display = $state(loadDisplay());
  let expanded = $state(false);
  let styleId = $state<StyleId>(loadStyle());
  let mode = $state<'natal' | 'transits' | 'synastry' | 'composite'>('natal');
  const MODES = [
    ['natal', 'Natal'], ['transits', 'Transits'],
    ['synastry', 'Synastry'], ['composite', 'Composite'],
  ] as const;

  function loadStyle(): StyleId {
    const s = localStorage.getItem('astro-style');
    return STYLES.some(x => x.id === s) ? s as StyleId : 'jungian';
  }
  $effect(() => localStorage.setItem('astro-style', styleId));

  $effect(() => storeDisplay($state.snapshot(display)));
  $effect(() => {
    document.documentElement.classList.toggle('hc', display.contrast);
    document.documentElement.style.setProperty('--ts', String(display.textScale));
  });

  const provider = $derived(defaultProvider(packs));
  const chart = $derived(current
    ? computeChart(provider, { jdUt: current.jdUt, lat: current.lat, lon: current.lon })
    : null);

  onMount(async () => {
    try {
      const [p, g] = await Promise.all([fetchPacks(), fetchGazetteer(), loadTexts()]);
      packs = p;
      gaz = g;
      if (p.length < PACK_BODIES.length) {
        banner = 'Some asteroid ephemeris packs failed to load — affected bodies are listed as missing.';
      }
    } catch (e) {
      banner = `Data failed to load: ${e instanceof Error ? e.message : e}`;
    }
  });

  function cast() {
    if (!form.place || !form.date) return;
    const [y, mo, d] = form.date.split('-').map(Number);
    const [h, mi] = (form.time || '12:00').split(':').map(Number);
    const { jdUt, offsetMinutes } = localToUt(y!, mo!, d!, h ?? 12, mi ?? 0, form.place.zone);
    current = {
      jdUt,
      lat: form.place.lat,
      lon: form.place.lon,
      meta: { ...form, place: form.place, offsetMinutes },
    };
    selection = { kind: 'none' };
  }

  function chartFromSaved(c: SavedChart) {
    const [y, mo, d] = c.date.split('-').map(Number);
    const [h, mi] = (c.time || '12:00').split(':').map(Number);
    const { jdUt } = localToUt(y!, mo!, d!, h ?? 12, mi ?? 0, c.place.zone);
    return computeChart(provider, { jdUt, lat: c.place.lat, lon: c.place.lon });
  }

  function loadSaved(c: SavedChart) {
    form.name = c.name;
    form.date = c.date;
    form.time = c.time;
    form.accuracy = c.accuracy;
    form.place = c.place;
    cast();
  }

  // $state.snapshot: IndexedDB structured clone rejects $state proxies.
  const saveable = $derived(current
    ? $state.snapshot({
        name: current.meta.name || current.meta.place.name,
        date: current.meta.date,
        time: current.meta.time,
        accuracy: current.meta.accuracy,
        place: current.meta.place,
      })
    : null);
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape') expanded = false; }} />
<GlyphDefs style={{ weight: display.weight, slant: display.slant }} />

<header class="app">
  <div class="brand">
    <h1>ASTRODYNAMICS</h1>
    <span class="tag">charts · offline ephemeris · interpretations</span>
    <span class="spacer"></span>
    {#if chart}
      <button class="copyai" onclick={copySnapshot}
        title="Copy a raw-factors markdown snapshot of this chart, ready to paste into an AI conversation (e.g. for an IFS-style profile)">
        {copied ? 'Copied ✓' : 'Copy for AI'}
      </button>
    {/if}
    <DisplayControls bind:display />
    <SavedCharts {saveable} onload={loadSaved} />
  </div>
  {#if banner}<div class="banner">{banner}</div>{/if}
  <ChartForm bind:form {gaz} onsubmit={cast} />
</header>

{#if chart}
  <nav class="modetabs">
    {#each MODES as [id, label] (id)}
      <button class:on={mode === id} onclick={() => mode = id}>{label}</button>
    {/each}
    <span class="stylepick" role="radiogroup" aria-label="Interpretation style">
      <span>Style</span>
      {#each STYLES as s (s.id)}
        <button class:on={styleId === s.id} onclick={() => styleId = s.id}>{s.label}</button>
      {/each}
    </span>
  </nav>
{/if}

{#if chart && current && mode === 'transits'}
  <TransitsView natal={chart} meta={current.meta} {provider} {display} style={styleId} {chartFromSaved} />
{:else if chart && current && mode === 'synastry'}
  <SynastryView natal={chart} meta={current.meta} {chartFromSaved} style={styleId} {display} />
{:else if chart && current && mode === 'composite'}
  <CompositeView natal={chart} meta={current.meta} {chartFromSaved} {display} style={styleId} />
{:else}
<main class="app">
  {#if chart}
    <div id="wheelwrap">
      <button class="expand" title="Expand chart" onclick={() => expanded = true}>⤢ Expand</button>
      <Wheel {chart} {selection} {display} onselect={s => selection = s} />
    </div>
    <aside class="app">
      <Panel {chart} {selection} meta={current!.meta} style={styleId} onselect={s => selection = s} />
      <AspectList {chart} {selection} onselect={s => selection = s} />
      <div class="legend"><span>tight orb</span><span class="ramp"></span><span>edge of orb</span></div>
    </aside>
  {:else}
    <div class="empty">
      {#if !gaz}
        Loading place index & ephemeris packs…
      {:else}
        Enter birth details above and press <b>Cast chart</b>.<br>
        Everything is computed locally — no data leaves this device.
      {/if}
    </div>
  {/if}
</main>
{#if chart && current}
  <section class="widepanels">
    <Themes {chart} style={styleId} {provider} jdBirth={current.jdUt} />
    <Glossary />
  </section>
{/if}
{/if}

{#if expanded && chart}
  <div class="overlay" role="dialog" aria-label="Expanded chart">
    <button class="close" onclick={() => expanded = false}>✕ Close</button>
    <div class="bigwheel">
      <Wheel {chart} {selection} {display} onselect={s => selection = s} />
    </div>
    {#if selection.kind !== 'none'}
      <div class="flyout">
        <OverlayInfo {chart} {selection} style={styleId} />
      </div>
    {/if}
  </div>
{/if}

<footer class="app">
  Positions: astronomy-engine (MIT) + Chebyshev packs fitted to JPL Horizons ·
  houses: Placidus (Porphyry above polar circles) · places: GeoNames (CC-BY 4.0)
  · charts are stored only in this browser.
</footer>
