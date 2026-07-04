<script lang="ts">
  import { onMount } from 'svelte';
  import ChartForm from './ChartForm.svelte';
  import Wheel from './Wheel.svelte';
  import Panel from './Panel.svelte';
  import AspectList from './AspectList.svelte';
  import SavedCharts from './SavedCharts.svelte';
  import { fetchPacks, PACK_BODIES } from '../ephemeris/packs';
  import { fetchGazetteer, type Gazetteer } from '../store/gazetteer';
  import { computeChart, defaultProvider } from '../chart/chart';
  import { localToUt } from '../chart/civil';
  import type { ChebPack } from '../ephemeris/chebyshev';
  import type { SavedChart } from '../store/db';
  import type { Selection } from './selection';
  import type { ChartMeta, FormState } from './state';

  let packs = $state<ChebPack[]>([]);
  let gaz = $state<Gazetteer | null>(null);
  let banner = $state('');
  let form = $state<FormState>({
    name: '', date: '', time: '12:00', accuracy: 'exact', place: null,
  });
  let current = $state<{ jdUt: number; lat: number; lon: number; meta: ChartMeta } | null>(null);
  let selection = $state<Selection>({ kind: 'none' });

  const provider = $derived(defaultProvider(packs));
  const chart = $derived(current
    ? computeChart(provider, { jdUt: current.jdUt, lat: current.lat, lon: current.lon })
    : null);

  onMount(async () => {
    try {
      const [p, g] = await Promise.all([fetchPacks(), fetchGazetteer()]);
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

<header class="app">
  <div class="brand">
    <h1>ASTRO</h1>
    <span class="tag">natal charts · offline ephemeris · M2 preview</span>
    <span class="spacer"></span>
    <SavedCharts {saveable} onload={loadSaved} />
  </div>
  {#if banner}<div class="banner">{banner}</div>{/if}
  <ChartForm bind:form {gaz} onsubmit={cast} />
</header>

<main class="app">
  {#if chart}
    <div id="wheelwrap">
      <Wheel {chart} {selection} onselect={s => selection = s} />
    </div>
    <aside class="app">
      <Panel {chart} {selection} meta={current!.meta} onselect={s => selection = s} />
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

<footer class="app">
  Positions: astronomy-engine (MIT) + Chebyshev packs fitted to JPL Horizons ·
  houses: Placidus (Porphyry above polar circles) · places: GeoNames (CC-BY 4.0)
  · charts are stored only in this browser.
</footer>
