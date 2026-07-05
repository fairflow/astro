<script lang="ts">
  import Wheel from './Wheel.svelte';
  import CrossAspectList from './CrossAspectList.svelte';
  import { computeChart, type Chart } from '../chart/chart';
  import { localToUt } from '../chart/civil';
  import { transitAspects } from '../chart/relate';
  import { contextReading, LANDMARKS } from '../interpret/contexts';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import { degDiff, type EphemerisProvider } from '../ephemeris/types';
  import type { StyleId } from '../interpret/types';
  import type { Selection } from './selection';
  import type { ChartMeta, DisplaySettings } from './state';

  let { natal, meta, provider, display, style }: {
    natal: Chart;
    meta: ChartMeta;
    provider: EphemerisProvider;
    display: DisplaySettings;
    style: StyleId;
  } = $props();

  const now = new Date();
  let dateStr = $state(now.toISOString().slice(0, 10));
  let timeStr = $state(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

  const sky = $derived.by<Chart | null>(() => {
    if (!dateStr) return null;
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = (timeStr || '12:00').split(':').map(Number);
    try {
      const { jdUt } = localToUt(y!, mo!, d!, h ?? 12, mi ?? 0, meta.place.zone);
      return computeChart(provider, { jdUt, lat: meta.place.lat, lon: meta.place.lon });
    } catch {
      return null;
    }
  });

  const crosses = $derived(sky
    ? transitAspects(
        sky.positions.map(p => ({ body: p.body, state: p })),
        natal.positions.map(p => ({ body: p.body, state: p })),
      )
    : []);

  const landmarks = $derived.by(() => {
    if (!sky) return [];
    const out: { name: string; ages: string; orb: number }[] = [];
    for (const L of LANDMARKS) {
      const t = sky.positions.find(p => p.body === L.t);
      const n = natal.positions.find(p => p.body === L.n);
      if (!t || !n) continue;
      const orb = Math.abs(Math.abs(degDiff(t.lon, n.lon)) - L.angle);
      if (orb <= 3) out.push({ name: L.name, ages: L.ages, orb });
    }
    return out;
  });

  let wheelSel = $state<Selection>({ kind: 'none' });
  let crossSel = $state<number | null>(null);

  const skySelAspect = $derived(wheelSel.kind === 'aspect' && sky
    ? sky.aspects.find(a => `${a.a}|${a.def.name}|${a.b}` === wheelSel.key) ?? null
    : null);
  const crossAspect = $derived(crossSel !== null ? crosses[crossSel] ?? null : null);

  function resetToNow() {
    const n = new Date();
    dateStr = n.toISOString().slice(0, 10);
    timeStr = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }
</script>

<div class="tview">
  <div class="controls form">
    <label>Date<input type="date" bind:value={dateStr}></label>
    <label>Time<input type="time" bind:value={timeStr}></label>
    <button class="chip" onclick={resetToNow}>Now</button>
    <span class="hint">Sky computed for {meta.place.name} ({meta.place.zone}). Transit wheel uses tight orbs (≤3–4°).</span>
  </div>

  {#if landmarks.length}
    <div class="landmarks">
      {#each landmarks as L}
        <span class="badge" title={`typical ages ${L.ages}`}>{L.name} · orb {fmtOrb(L.orb)}</span>
      {/each}
    </div>
  {/if}

  {#if sky}
    <div class="split">
      <div class="wheelcol">
        <Wheel chart={sky} selection={wheelSel} {display} onselect={s => { wheelSel = s; crossSel = null; }} />
      </div>
      <div class="listcol">
        {#if crossAspect}
          {@const r = contextReading(crossAspect, style, 'transit')}
          {@const t = sky.positions.find(p => p.body === crossAspect.a)!}
          {@const n = natal.positions.find(p => p.body === crossAspect.b)!}
          <div class="readingcard">
            <h2 class="serif">transiting {BODY_NAME[crossAspect.a]} {crossAspect.def.name} natal {BODY_NAME[crossAspect.b]}</h2>
            <div class="sub">{fmtDegInSign(t.lon)} → {fmtDegInSign(n.lon)} · orb {fmtOrb(crossAspect.orb)} · {crossAspect.applying ? 'applying (building)' : 'separating (resolving)'}</div>
            <p>{r.text} <span class="src">{r.source}</span></p>
          </div>
        {:else if skySelAspect}
          <div class="readingcard">
            <h2 class="serif">{BODY_NAME[skySelAspect.a]} {skySelAspect.def.name} {BODY_NAME[skySelAspect.b]} (in the sky)</h2>
            <div class="sub">orb {fmtOrb(skySelAspect.orb)}</div>
            <p>A sky-to-sky aspect is collective weather — mundane astrology reads it for everyone at once, not as personal fate. It becomes personal only where it touches your own chart (see the transits list).</p>
          </div>
        {:else}
          <div class="readingcard hint">Pick a transit from the list below — or an aspect on the wheel, which shows the sky everyone shares right now.</div>
        {/if}

        <details open>
          <summary>Transits to your natal chart ({crosses.length})</summary>
          <CrossAspectList items={crosses} aLabel="t" bLabel="natal"
            selectedIndex={crossSel} onselect={i => { crossSel = i; wheelSel = { kind: 'none' }; }} />
        </details>
        <details>
          <summary>Current sky aspects — everyone ({sky.aspects.length})</summary>
          <div class="hint" style="padding:4px 8px">Collective, not personal (mundane astrology). Click lines on the wheel to inspect.</div>
        </details>
      </div>
    </div>
  {/if}
</div>

<style>
  .tview { padding: 0 10px; }
  .controls { align-items: center; }
  .chip {
    background: var(--bg2); color: var(--gold); border: 1px solid var(--gold-dim);
    border-radius: 14px; padding: 5px 14px; font-size: 12.5px; align-self: flex-end;
  }
  .hint { color: var(--dim); font-size: 12.5px; }
  .landmarks { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 8px; }
  .badge {
    background: #2a2440; color: var(--quincunx); border: 1px solid var(--quincunx);
    border-radius: 12px; padding: 3px 10px; font-size: 12px;
  }
  .split { display: flex; gap: 12px; align-items: flex-start; }
  .wheelcol { flex: 1 1 560px; min-width: 380px; }
  .listcol { flex: 0 0 380px; }
  details {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 8px 12px; margin-bottom: 8px;
  }
  summary { cursor: pointer; color: var(--gold); font-size: 14px; }
  .readingcard {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; margin-bottom: 10px; font-size: 14px;
  }
  .readingcard h2 { font-size: 15.5px; color: var(--gold); }
  .readingcard .sub { color: var(--dim); font-size: 12px; margin: 2px 0 8px; }
  .readingcard p { line-height: 1.55; }
  .src {
    color: var(--dim); font-size: 10px; text-transform: uppercase;
    letter-spacing: .06em; border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 4px;
  }
  @media (max-width: 900px) { .split { flex-direction: column; } .listcol { flex: auto; width: 100%; } }
</style>
