<script lang="ts">
  import Wheel from './Wheel.svelte';
  import CrossAspectList from './CrossAspectList.svelte';
  import PartnerPick from './PartnerPick.svelte';
  import { computeChart, type Chart } from '../chart/chart';
  import { localToUt } from '../chart/civil';
  import {
    compositeChart, sunMoonMidpointHits, transitAspects, type CrossAspect,
  } from '../chart/relate';
  import { contextReading, LANDMARKS } from '../interpret/contexts';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import { degDiff, type EphemerisProvider } from '../ephemeris/types';
  import type { StyleId } from '../interpret/types';
  import type { SavedChart } from '../store/db';
  import type { Selection } from './selection';
  import type { ChartMeta, DisplaySettings } from './state';
  import { session } from './session.svelte';
  import { enabledAspectDefs, enabledBodies } from './prefs.svelte';

  let { natal, meta, provider, display, style, chartFromSaved }: {
    natal: Chart;
    meta: ChartMeta;
    provider: EphemerisProvider;
    display: DisplaySettings;
    style: StyleId;
    chartFromSaved: (c: SavedChart) => Chart;
  } = $props();

  // Cross-tab persistence (session survives the tabs destroying views).
  if (!session.transitDate) {
    const now = new Date();
    session.transitDate = now.toISOString().slice(0, 10);
    session.transitTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const sky = $derived.by<Chart | null>(() => {
    if (!session.transitDate) return null;
    const [y, mo, d] = session.transitDate.split('-').map(Number);
    const [h, mi] = (session.transitTime || '12:00').split(':').map(Number);
    try {
      const { jdUt } = localToUt(y!, mo!, d!, h ?? 12, mi ?? 0, meta.place.zone);
      return computeChart(provider, {
        jdUt, lat: meta.place.lat, lon: meta.place.lon,
        bodies: enabledBodies(),
        aspectOptions: { defs: enabledAspectDefs() },
      });
    } catch {
      return null;
    }
  });

  const pts = (c: Chart) => c.positions.map(p => ({ body: p.body, state: p }));
  const skyPts = $derived(sky ? pts(sky) : []);
  const enabledNames = $derived(new Set(enabledAspectDefs().map(d => d.name as string)));

  const crosses = $derived(sky ? transitAspects(skyPts, pts(natal), enabledNames) : []);

  const partnerChart = $derived(session.partner ? chartFromSaved(session.partner) : null);
  const comp = $derived(partnerChart ? compositeChart(natal, partnerChart, enabledAspectDefs()) : null);
  const crossesB = $derived(sky && partnerChart ? transitAspects(skyPts, pts(partnerChart), enabledNames) : []);
  const crossesC = $derived(sky && comp ? transitAspects(skyPts, pts(comp), enabledNames) : []);
  const smHitsA = $derived(sky ? sunMoonMidpointHits(skyPts, natal) : []);
  const smHitsB = $derived(sky && partnerChart ? sunMoonMidpointHits(skyPts, partnerChart) : []);

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
  let coupleSel = $state<{ list: 'A' | 'B' | 'C'; i: number } | null>(null);

  const natalSelAspect = $derived(wheelSel.kind === 'aspect'
    ? natal.aspects.find(a => `${a.a}|${a.def.name}|${a.b}` === wheelSel.key) ?? null
    : null);
  const crossAspect = $derived(crossSel !== null ? crosses[crossSel] ?? null : null);
  const outerBodies = $derived(sky
    ? sky.positions.map(p => ({ body: p.body, lon: p.lon, retro: p.speed < 0 }))
    : []);

  const coupleAspect = $derived.by<{ x: CrossAspect; chart: Chart; label: string } | null>(() => {
    if (!coupleSel) return null;
    const src = coupleSel.list === 'A' ? crosses : coupleSel.list === 'B' ? crossesB : crossesC;
    const x = src[coupleSel.i];
    if (!x) return null;
    const chart = coupleSel.list === 'A' ? natal
      : coupleSel.list === 'B' ? partnerChart! : comp!;
    const label = coupleSel.list === 'A' ? (meta.name || 'your chart')
      : coupleSel.list === 'B' ? (session.partner?.name ?? 'partner') : 'the composite (the relationship itself)';
    return { x, chart, label };
  });

  function resetToNow() {
    const n = new Date();
    session.transitDate = n.toISOString().slice(0, 10);
    session.transitTime = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }
</script>

<div class="tview">
  <div class="controls form">
    <label>Date<input type="date" bind:value={session.transitDate}></label>
    <label>Time<input type="time" bind:value={session.transitTime}></label>
    <button class="chip" onclick={resetToNow}>Now</button>
    <span class="target" role="radiogroup" aria-label="Transit target">
      <button class:on={session.transitTarget === 'you'} onclick={() => { session.transitTarget = 'you'; coupleSel = null; }}>Your chart</button>
      <button class:on={session.transitTarget === 'couple'} onclick={() => { session.transitTarget = 'couple'; crossSel = null; }}>The couple</button>
    </span>
    <span class="hint">Sky computed for {meta.place.name} ({meta.place.zone}). Tight transit orbs (≤3–4°).</span>
  </div>

  {#if session.transitTarget === 'you'}
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
          <Wheel chart={natal} selection={wheelSel} {display}
            outer={outerBodies} outerColor="var(--transit)"
            crossAspects={crosses.slice(0, 30)} crossSelected={crossSel}
            oncross={i => { crossSel = i; wheelSel = { kind: 'none' }; }}
            onselect={s => { wheelSel = s; crossSel = null; }} />
          <div class="hint" style="padding:2px 6px">Bi-wheel: your natal chart inside, the sky of {session.transitDate} outside (teal). Dashed lines are transits; solid hub lines are your natal aspects.</div>
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
          {:else if natalSelAspect}
            <div class="readingcard">
              <h2 class="serif">natal: {BODY_NAME[natalSelAspect.a]} {natalSelAspect.def.name} {BODY_NAME[natalSelAspect.b]}</h2>
              <div class="sub">orb {fmtOrb(natalSelAspect.orb)} · your own chart, shown in the hub</div>
              <p>Natal aspects are read in the Natal tab; here they show which standing patterns today's transits are landing on.</p>
            </div>
          {:else}
            <div class="readingcard hint">Tap a dashed line (a transit to your chart), a row in the list below, or a hub aspect of your natal chart.</div>
          {/if}

          <details open>
            <summary>Transits to your natal chart ({crosses.length})</summary>
            <CrossAspectList items={crosses} aLabel="t" bLabel="natal"
              selectedIndex={crossSel} onselect={i => { crossSel = i; wheelSel = { kind: 'none' }; }} />
          </details>
          <details>
            <summary>Current sky aspects — everyone ({sky.aspects.length})</summary>
            <div class="hint" style="padding:4px 8px">Collective weather (mundane astrology), not personal — listed for context.</div>
            {#each sky.aspects as a}
              <div class="skyrow">{BODY_NAME[a.a]} {a.def.name} {BODY_NAME[a.b]} · {fmtOrb(a.orb)}</div>
            {/each}
          </details>
        </div>
      </div>
    {/if}
  {:else}
    <PartnerPick excludeName={meta.name} selectedId={session.partner?.id ?? null}
      onpick={c => { session.partner = c; coupleSel = null; }} />
    {#if sky && partnerChart && comp && session.partner}
      <div class="split">
        <div class="wheelcol">
          <Wheel chart={comp} selection={{ kind: 'none' }} {display}
            outer={outerBodies} outerColor="var(--transit)"
            crossAspects={crossesC.slice(0, 30)}
            crossSelected={coupleSel?.list === 'C' ? coupleSel.i : null}
            oncross={i => coupleSel = { list: 'C', i }}
            onselect={() => {}} />
          <div class="hint" style="padding:2px 6px">Bi-wheel: the couple's midpoint composite inside, the sky of {session.transitDate} outside (teal). Dashed lines are transits to the relationship itself.</div>
        </div>
        <div class="listcol">
          {#if coupleAspect}
            {@const r = contextReading(coupleAspect.x, style, 'transit')}
            {@const t = sky.positions.find(p => p.body === coupleAspect.x.a)!}
            {@const n = coupleAspect.chart.positions.find(p => p.body === coupleAspect.x.b)!}
            <div class="readingcard">
              <h2 class="serif">transiting {BODY_NAME[coupleAspect.x.a]} {coupleAspect.x.def.name} {BODY_NAME[coupleAspect.x.b]}</h2>
              <div class="sub">to {coupleAspect.label} · {fmtDegInSign(t.lon)} → {fmtDegInSign(n.lon)} · orb {fmtOrb(coupleAspect.x.orb)} · {coupleAspect.x.applying ? 'applying' : 'separating'}</div>
              <p>{r.text} <span class="src">{r.source}</span>
                {#if coupleSel?.list === 'C'}<br><span class="hint">Composite transits are felt as "how we are together", not as either person's mood.</span>{/if}</p>
            </div>
          {:else}
            <div class="readingcard hint">Transits to each of you and to the relationship's composite chart, strongest first. Tap any row or dashed line.</div>
          {/if}

          {#if smHitsA.length || smHitsB.length}
            <div class="readingcard">
              <h2 class="serif">Sun/Moon midpoint hits (Ebertin dial)</h2>
              {#each smHitsA as h}
                <div class="skyrow">transiting {BODY_NAME[h.body]} on {meta.name || 'your'} Sun/Moon midpoint · orb {fmtOrb(h.orb)}</div>
              {/each}
              {#each smHitsB as h}
                <div class="skyrow">transiting {BODY_NAME[h.body]} on {session.partner.name}'s Sun/Moon midpoint · orb {fmtOrb(h.orb)}</div>
              {/each}
            </div>
          {/if}

          <details open>
            <summary>To the composite — the relationship itself ({crossesC.length})</summary>
            <CrossAspectList items={crossesC} aLabel="t" bLabel="comp"
              selectedIndex={coupleSel?.list === 'C' ? coupleSel.i : null}
              onselect={i => coupleSel = { list: 'C', i }} />
          </details>
          <details>
            <summary>To {meta.name || 'you'} ({crosses.length})</summary>
            <CrossAspectList items={crosses} aLabel="t" bLabel="natal"
              selectedIndex={coupleSel?.list === 'A' ? coupleSel.i : null}
              onselect={i => coupleSel = { list: 'A', i }} />
          </details>
          <details>
            <summary>To {session.partner.name} ({crossesB.length})</summary>
            <CrossAspectList items={crossesB} aLabel="t" bLabel="natal"
              selectedIndex={coupleSel?.list === 'B' ? coupleSel.i : null}
              onselect={i => coupleSel = { list: 'B', i }} />
          </details>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .tview { padding: 0 10px; }
  .skyrow { font-size: 12.5px; color: var(--dim); padding: 2px 8px; }
  .controls { align-items: center; }
  .chip {
    background: var(--bg2); color: var(--gold); border: 1px solid var(--gold-dim);
    border-radius: 14px; padding: 5px 14px; font-size: 12.5px; align-self: flex-end;
  }
  .target { display: flex; gap: 6px; align-self: flex-end; }
  .target button {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .target button.on { color: #12182b; background: var(--gold); border-color: var(--gold); font-weight: 600; }
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
