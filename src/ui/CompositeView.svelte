<script lang="ts">
  import PartnerPick from './PartnerPick.svelte';
  import ExpandableWheel from './ExpandableWheel.svelte';
  import { compositeChart } from '../chart/relate';
  import { contextReading } from '../interpret/contexts';
  import { compositeSnapshot } from '../interpret/snapshot';
  import { copyToClipboard } from './clipboard';
  import { aspectKey } from '../render/wheel';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import type { Chart } from '../chart/chart';
  import type { SavedChart } from '../store/db';
  import type { StyleId } from '../interpret/types';
  import type { Selection } from './selection';
  import type { ChartMeta, DisplaySettings } from './state';
  import { session } from './session.svelte';
  import { enabledAspectDefs } from './prefs.svelte';

  let { natal, meta, chartFromSaved, display, style }: {
    natal: Chart;
    meta: ChartMeta;
    chartFromSaved: (c: SavedChart) => Chart;
    display: DisplaySettings;
    style: StyleId;
  } = $props();

    let sel = $state<Selection>({ kind: 'none' });

  const comp = $derived(session.partner
    ? compositeChart(natal, chartFromSaved(session.partner), enabledAspectDefs())
    : null);
  const selAspect = $derived(sel.kind === 'aspect' && comp
    ? comp.aspects.find(a => aspectKey(a) === sel.key) ?? null
    : null);
  const compSun = $derived(comp?.positions.find(p => p.body === 'sun'));
  const compMoon = $derived(comp?.positions.find(p => p.body === 'moon'));

  let copied = $state(false);
  async function copyComposite() {
    if (!comp || !session.partner) return;
    const partner = chartFromSaved(session.partner);
    const text = compositeSnapshot(comp, meta.name || 'you', natal, partner, session.partner.name);
    const ok = await copyToClipboard(text);
    if (!ok) return;
    copied = true;
    setTimeout(() => copied = false, 2200);
  }

  const caption = $derived(session.partner
    ? [
        `Composite: ${meta.name || meta.place.name} + ${session.partner.name}`,
        'midpoint chart of the relationship itself',
        `${meta.name || 'you'}: born ${meta.date} ${meta.time} · ${meta.place.name}`,
        `${session.partner.name}: born ${session.partner.date} ${session.partner.time} · ${session.partner.place.name}`,
      ]
    : []);
</script>

<div class="cview">
  <div class="pickrow">
    <PartnerPick excludeName={meta.name} selectedId={session.partner?.id ?? null}
      onpick={c => { session.partner = c; sel = { kind: 'none' }; }} />
    {#if comp && session.partner}
      <button class="copyai" onclick={copyComposite}
        title="Copy the composite (midpoint) chart plus both natals as markdown for an AI conversation">
        {copied ? 'Copied ✓' : 'Copy for AI (composite)'}
      </button>
    {/if}
  </div>

  {#if comp && session.partner}
    <div class="split">
      <div class="wheelcol">
        <ExpandableWheel chart={comp} selection={sel} {display} {caption} onselect={s => sel = s} />
      </div>
      <div class="listcol">
        <details open>
          <summary>How to read a composite (midpoint) chart</summary>
          <div class="help">
            <p>This is the chart of the <b>relationship itself</b> — a third entity,
            computed as the midpoint of each pair of like planets ({meta.name || 'you'} + {session.partner.name}).
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
  .pickrow { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .copyai {
    background: var(--bg2); color: var(--syn); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .copyai:hover { border-color: var(--syn); }
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
