<script lang="ts">
  import { onMount } from 'svelte';
  import AuthoringView from './AuthoringView.svelte';
  import ChartForm from './ChartForm.svelte';
  import ExpandableWheel from './ExpandableWheel.svelte';
  import Panel from './Panel.svelte';
  import AspectList from './AspectList.svelte';
  import SavedCharts from './SavedCharts.svelte';
  import GlyphDefs from './GlyphDefs.svelte';
  import SettingsMenu from './SettingsMenu.svelte';
  import { enabledAspectDefs, enabledBodies } from './prefs.svelte';
  import Themes from './Themes.svelte';
  import TransitsView from './TransitsView.svelte';
  import OverlayInfo from './OverlayInfo.svelte';
  import Glossary from './Glossary.svelte';
  import { chartSnapshot } from '../interpret/snapshot';
  import { copyToClipboard } from './clipboard';
  import { loadTexts } from '../interpret/textstore';
  import SynastryView from './SynastryView.svelte';
  import { session, storeSession } from './session.svelte';
  import { applySkin, skinById } from './skins';
  import { ASPECT_FAMILIES } from '../render/glyphs';
  import CompositeView from './CompositeView.svelte';
  import { STYLES, type StyleId } from '../interpret/types';
  import { fetchPacks, PACK_BODIES } from '../ephemeris/packs';
  import { fetchGazetteer, type Gazetteer } from '../store/gazetteer';
  import { computeChart, defaultProvider } from '../chart/chart';
  import { fmtOffset, localToUt } from '../chart/civil';
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

  // Build-time version stamp (see vite.config.ts). First 5 hex of the commit
  // hash — matches git's front-truncation and sw.js's cache VERSION.
  const buildDate = __GIT_DATE__;
  const buildHash = __GIT_HASH__.slice(0, 5);

  async function copySnapshot() {
    if (!chart || !current) return;
    const ok = await copyToClipboard(chartSnapshot(chart, current.meta));
    if (!ok) { banner = 'Clipboard unavailable in this browser context.'; return; }
    copied = true;
    setTimeout(() => copied = false, 2200);
  }
  let form = $state<FormState>({
    name: '', date: '', time: '12:00', accuracy: 'exact', place: null,
  });
  let current = $state<{ jdUt: number; lat: number; lon: number; meta: ChartMeta } | null>(null);
  let selection = $state<Selection>({ kind: 'none' });
  /** id of the saved chart the form was loaded from (enables Update). */
  let loadedId = $state<number | null>(null);
  let display = $state(loadDisplay());
  let styleId = $state<StyleId>(loadStyle());
  let mode = $state<'natal' | 'transits' | 'synastry' | 'composite' | 'authoring'>('natal');
  const MODES = [
    ['natal', 'Natal'], ['transits', 'Transits'],
    ['synastry', 'Synastry'], ['composite', 'Composite'],
  ] as const;
  // The Authoring form is a plain tab — no ?author flag, no login. Home-screen
  // shortcuts on iOS/Android drop query strings, which made a flag-gated tab
  // unreachable from an installed icon. It only collects language feedback.

  function loadStyle(): StyleId {
    const s = localStorage.getItem('astro-style');
    return STYLES.some(x => x.id === s) ? s as StyleId : 'jungian';
  }
  $effect(() => localStorage.setItem('astro-style', styleId));

  $effect(() => storeDisplay($state.snapshot(display)));
  $effect(() => storeSession($state.snapshot(session)));
  $effect(() => {
    document.documentElement.classList.toggle('cmed', display.contrast === 'medium');
    document.documentElement.classList.toggle('chigh', display.contrast === 'high');
    document.documentElement.classList.toggle('light', display.theme === 'light');
    document.documentElement.style.setProperty('--ts', String(display.textScale));
    // aspect emphasis → colour saturation on aspect lines (0.7..1.6, 1.15 mid)
    document.documentElement.style.setProperty(
      '--aspect-sat', String(0.7 + 0.9 * display.aspectEmphasis));
    applySkin(skinById(display.skin));
    // per-aspect colour overrides — AFTER applySkin (which clears/sets the
    // same vars) and only when no print skin is active, so B/W stays single-ink.
    if (display.skin === 'auto') {
      for (const { var: v } of ASPECT_FAMILIES) {
        const hex = display.aspectColors[v];
        if (hex) document.documentElement.style.setProperty(v, hex);
        else document.documentElement.style.removeProperty(v);
      }
    }
  });

  // Working state survives refresh: remember the last-cast birth data.
  const FORM_KEY = 'astro-last-cast';
  $effect(() => {
    if (!current) return;
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify($state.snapshot(current.meta)));
    } catch { /* private mode */ }
  });

  function restoreLastCast() {
    try {
      const raw = localStorage.getItem(FORM_KEY);
      if (!raw) return;
      const m = JSON.parse(raw) as ChartMeta;
      if (!m.place || !m.date) return;
      form.name = m.name;
      form.date = m.date;
      form.time = m.time;
      form.accuracy = m.accuracy;
      form.place = m.place;
      cast();
    } catch { /* ignore corrupt state */ }
  }

  const provider = $derived(defaultProvider(packs));
  const chart = $derived(current
    ? computeChart(provider, {
        jdUt: current.jdUt, lat: current.lat, lon: current.lon,
        bodies: enabledBodies(),
        aspectOptions: { defs: enabledAspectDefs() },
      })
    : null);

  onMount(async () => {
    // ask the browser to exempt our IndexedDB/localStorage from eviction
    navigator.storage?.persist?.().catch(() => {});
    restoreLastCast();
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
    return computeChart(provider, {
      jdUt, lat: c.place.lat, lon: c.place.lon,
      bodies: enabledBodies(),
      aspectOptions: { defs: enabledAspectDefs() },
    });
  }

  function loadSaved(c: SavedChart) {
    loadedId = c.id ?? null;
    form.name = c.name;
    form.date = c.date;
    form.time = c.time;
    form.accuracy = c.accuracy;
    form.place = c.place;
    cast();
  }

  /** Expanded-wheel caption: who, birth data, place. */
  const caption = $derived(current
    ? [
        current.meta.name || current.meta.place.name,
        `born ${current.meta.date} ${current.meta.time} (${fmtOffset(current.meta.offsetMinutes)})`,
        `${current.meta.place.name}, ${current.meta.place.country}`,
      ]
    : []);

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

<GlyphDefs style={{ weight: display.weight, slant: display.slant }} />

<header class="app">
  <div class="brand">
    <h1>ASTRODYNAMICS</h1>
    {#if buildDate}
      <span class="build" title="Latest commit: {buildDate} · {buildHash}">{buildDate} · {buildHash}</span>
    {/if}
    <span class="tag">charts · offline ephemeris · interpretations</span>
    <span class="spacer"></span>
    {#if chart && mode === 'natal'}
      <button class="copyai" onclick={copySnapshot}
        title="Copy this natal chart (only the bodies enabled in Settings) as raw-factors markdown, ready to paste into an AI conversation. Transits, Synastry and Composite tabs each have their own Copy button.">
        {copied ? 'Copied ✓' : 'Copy for AI'}
      </button>
    {/if}
    <SettingsMenu bind:display />
    <SavedCharts {saveable} {loadedId} onload={loadSaved} onsaved={id => loadedId = id} />
  </div>
  {#if banner}<div class="banner">{banner}</div>{/if}
  <ChartForm bind:form {gaz} onsubmit={cast} />
</header>

<nav class="modetabs">
  {#each MODES as [id, label] (id)}
    <button class:on={mode === id} onclick={() => mode = id}>{label}</button>
  {/each}
  <button class:on={mode === 'authoring'} onclick={() => mode = 'authoring'}>Authoring</button>
  <span class="stylepick" role="radiogroup" aria-label="Interpretation style">
    <span>Style</span>
    {#each STYLES as s (s.id)}
      <button class:on={styleId === s.id} onclick={() => styleId = s.id}>{s.label}</button>
    {/each}
  </span>
</nav>

{#if mode === 'authoring'}
  <AuthoringView />
{:else if chart && current && mode === 'transits'}
  <TransitsView natal={chart} meta={current.meta} {provider} {display} style={styleId} {chartFromSaved} />
{:else if chart && current && mode === 'synastry'}
  <SynastryView natal={chart} meta={current.meta} {chartFromSaved} style={styleId} {display} />
{:else if chart && current && mode === 'composite'}
  <CompositeView natal={chart} meta={current.meta} {chartFromSaved} {display} style={styleId} />
{:else}
<main class="app">
  {#if chart}
    <div id="wheelwrap">
      <ExpandableWheel {chart} {selection} {display} {caption} onselect={s => selection = s}>
        {#snippet flyout()}
          {#if selection.kind !== 'none'}
            <div class="flyout">
              <OverlayInfo {chart} {selection} style={styleId} />
            </div>
          {/if}
        {/snippet}
      </ExpandableWheel>
    </div>
    <aside class="app">
      <Panel {chart} {selection} meta={current!.meta} style={styleId} onselect={s => selection = s} />
      <AspectList {chart} {selection} onselect={s => selection = s} />
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

<footer class="app">
  Positions: astronomy-engine (MIT) + Chebyshev packs fitted to JPL Horizons ·
  houses: Placidus (Porphyry above polar circles) · places: GeoNames (CC-BY 4.0)
  · charts are stored only in this browser.
</footer>
