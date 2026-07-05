<script lang="ts">
  import PartnerPick from './PartnerPick.svelte';
  import Wheel from './Wheel.svelte';
  import { compositeChart } from '../chart/relate';
  import { contextReading } from '../interpret/contexts';
  import { aspectKey } from '../render/wheel';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import type { Chart } from '../chart/chart';
  import type { SavedChart } from '../store/db';
  import type { StyleId } from '../interpret/types';
  import type { Selection } from './selection';
  import type { ChartMeta, DisplaySettings } from './state';

  let { natal, meta, chartFromSaved, display, style }: {
    natal: Chart;
    meta: ChartMeta;
    chartFromSaved: (c: SavedChart) => Chart;
    display: DisplaySettings;
    style: StyleId;
  } = $props();

  let partner = $state<SavedChart | null>(null);
  let sel = $state<Selection>({ kind: 'none' });

  const comp = $derived(partner ? compositeChart(natal, chartFromSaved(partner)) : null);
  const selAspect = $derived(sel.kind === 'aspect' && comp
    ? comp.aspects.find(a => aspectKey(a) === sel.key) ?? null
    : null);
  const compSun = $derived(comp?.positions.find(p => p.body === 'sun'));
  const compMoon = $derived(comp?.positions.find(p => p.body === 'moon'));
</script>

<div class="cview">
  <PartnerPick excludeName={meta.name} onpick={c => { partner = c; sel = { kind: 'none' }; }} />

  {#if comp && partner}
    <div class="split">
      <div class="wheelcol">
        <Wheel chart={comp} selection={sel} {display} onselect={s => sel = s} />
      </div>
      <div class="listcol">
        <details open>
          <summary>How to read a composite (midpoint) chart</summary>
          <div class="help">
            <p>This is the chart of the <b>relationship itself</b> — a third entity,
            computed as the midpoint of each pair of like planets ({meta.name || 'you'} + {partner.name}).
            It describes what the <i>couple</i> does, not what either person feels about the other
            (that is the Synastry tab).</p>
            <p><b>Composite Sun</b> ({compSun ? fmtDegInSign(compSun.lon) : '—'}): the relationship's purpose, what it is <i>for</i>.
            <b>Composite Moon</b> ({compMoon ? fmtDegInSign(compMoon.lon) : '—'}): its emotional climate and needs.
            The angles show the couple's public image and direction.</p>
            <p class="fine">Method: "composite — midpoints" (every point, including house cusps, is a
            shorter-arc midpoint; one of the two standard methods, per astro.com/Solar Fire).
            Caveats practitioners flag: the composite is a construction, not a sky that ever
            existed; houses and angles are weaker evidence than planets and aspects; and for
            near-opposite pairs the midpoint is genuinely ambiguous. Composite Mercury/Venus can
            sit impossibly far from the composite Sun — read them symbolically, not
            astronomically.</p>
          </div>
        </details>
        {#if selAspect}
          {@const r = contextReading(selAspect, style, 'composite')}
          <div class="readingcard">
            <h2 class="serif">{BODY_NAME[selAspect.a]} {selAspect.def.name} {BODY_NAME[selAspect.b]}</h2>
            <div class="sub">composite · orb {fmtOrb(selAspect.orb)}</div>
            <p>{r.text} <span class="src">{r.source}</span></p>
          </div>
        {:else}
          <div class="readingcard hint">Tap an aspect on the composite wheel for its reading — phrased for the relationship as a unit, not for either person.</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .cview { padding: 0 12px; }
  .split { display: flex; gap: 12px; align-items: flex-start; }
  .wheelcol { flex: 1 1 560px; min-width: 380px; }
  .listcol { flex: 0 0 400px; }
  details {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 8px 12px; margin-bottom: 8px;
  }
  summary { cursor: pointer; color: var(--gold); font-size: 14px; }
  .help { font-size: 13.5px; }
  .help p { margin: 8px 0; line-height: 1.5; }
  .help .fine { color: var(--dim); font-size: 12.5px; }
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
  .hint { color: var(--dim); }
  @media (max-width: 900px) { .split { flex-direction: column; } .listcol { flex: auto; width: 100%; } }
</style>
