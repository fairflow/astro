<script lang="ts">
  import PartnerPick from './PartnerPick.svelte';
  import CrossAspectList from './CrossAspectList.svelte';
  import ExpandableWheel from './ExpandableWheel.svelte';
  import { crossAspects, houseOverlay, midpointContacts } from '../chart/relate';
  import { synastrySnapshot } from '../interpret/snapshot';
  import { registerCopy } from './copyctx.svelte';
  import { contextReading } from '../interpret/contexts';
  import { relationshipsDossier } from '../interpret/dossiers-life';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import { HOUSE_ARENA } from '../interpret/vocab';
  import type { Chart } from '../chart/chart';
  import type { SavedChart } from '../store/db';
  import type { StyleId } from '../interpret/types';
  import type { ChartMeta } from './state';
  import { session } from './session.svelte';
  import { enabledAspectDefs } from './prefs.svelte';
  import AskClaude from './AskClaude.svelte';
  import { redact } from '../ai/anonymise';
  import { SYNASTRY_SYSTEM, SYNASTRY_STARTERS, DEFAULT_SYNASTRY_REQUEST } from '../interpret/prompts';

  let { natal, meta, chartFromSaved, style, display }: {
    natal: Chart;
    meta: ChartMeta;
    chartFromSaved: (c: SavedChart) => Chart;
    style: StyleId;
    display: import('./state').DisplaySettings;
  } = $props();

    let sel = $state<number | null>(null);

  const partnerChart = $derived(session.partner ? chartFromSaved(session.partner) : null);

  const cross = $derived(partnerChart
    ? crossAspects(
        natal.positions.map(p => ({ body: p.body, state: p })),
        partnerChart.positions.map(p => ({ body: p.body, state: p })),
        { defs: enabledAspectDefs() },
      )
    : []);

  const overlays = $derived(partnerChart
    ? houseOverlay(partnerChart.positions, natal.houses.cusps)
    : []);
  const mids = $derived(partnerChart ? midpointContacts(natal, partnerChart) : []);
  const midsRev = $derived(partnerChart ? midpointContacts(partnerChart, natal) : []);


  /** Build the synastry snapshot, optionally with names/places redacted. */
  function buildSnapshot(anon: boolean): string {
    if (!partnerChart || !session.partner) return '';
    const aName = meta.name || 'Person A';
    const bName = session.partner.name;
    const text = synastrySnapshot(
      natal, meta, partnerChart, bName, cross, overlays, mids, midsRev);
    if (!anon) return text;
    return redact(text, [
      { find: aName, replace: 'Person A' },
      { find: bName, replace: 'Person B' },
      { find: meta.place.name, replace: '[location withheld]' },
      { find: meta.place.country, replace: '[country withheld]' },
      { find: session.partner.place.name, replace: '[location withheld]' },
      { find: session.partner.place.country, replace: '[country withheld]' },
    ]);
  }
  // The header's Copy for AI button copies the full (named) synastry.
  $effect(() => registerCopy('synastry',
    partnerChart && session.partner ? () => buildSnapshot(false) : null));

  const dossier = $derived(partnerChart && session.partner
    ? relationshipsDossier(natal, style, {
        otherName: session.partner.name, cross, overlays, midpoints: mids,
      })
    : null);

  const selAspect = $derived(sel !== null ? cross[sel] ?? null : null);
  // Bi-wheel cross lines want outer(a)=partner, inner(b)=natal — the
  // cross list is computed natal(a)×partner(b), so swap for display.
  const crossForWheel = $derived(cross.map(x => ({ ...x, a: x.b, b: x.a })));
  const outerBodies = $derived(partnerChart
    ? partnerChart.positions.map(p => ({ body: p.body, lon: p.lon, retro: p.speed < 0 }))
    : []);
  let wheelSel = $state<import('./selection').Selection>({ kind: 'none' });
  /** Selected outer-ring (partner) body — its inter-aspects stay lit. */
  let outerSel = $state<import('../ephemeris/types').BodyKey | null>(null);

  const houseIn = (c: Chart) => (b: import('../ephemeris/types').BodyKey) =>
    c.positions.find(p => p.body === b)?.house;

  const caption = $derived(session.partner
    ? [
        `Synastry: ${meta.name || meta.place.name} + ${session.partner.name}`,
        `${meta.name || 'you'} (inner): born ${meta.date} ${meta.time} · ${meta.place.name}`,
        `${session.partner.name} (outer): born ${session.partner.date} ${session.partner.time} · ${session.partner.place.name}`,
      ]
    : []);
</script>

<div class="sview">
  <div class="pickrow">
    <PartnerPick excludeName={meta.name} selectedId={session.partner?.id ?? null}
      onpick={c => { session.partner = c; sel = null; }} />
  </div>

  {#if partnerChart && session.partner}
    <AskClaude system={SYNASTRY_SYSTEM} starters={SYNASTRY_STARTERS}
      defaultRequest={DEFAULT_SYNASTRY_REQUEST} {buildSnapshot} accent="var(--syn)" />

    <div class="wheelrow">
      <ExpandableWheel chart={natal} selection={wheelSel} {display} {caption}
        outer={outerBodies} outerColor="var(--syn)"
        crossAspects={crossForWheel.slice(0, 30)} crossSelected={sel}
        oncross={i => { sel = i; wheelSel = { kind: 'none' }; outerSel = null; }}
        onselect={s => { wheelSel = s; sel = null; outerSel = null; }}
        outerSelected={outerSel}
        onouter={b => { outerSel = outerSel === b ? null : b; sel = null; wheelSel = { kind: 'none' }; }} />
      <div class="hint">Bi-wheel: your chart inside, {session.partner.name}'s bodies outside (violet). Dashed lines are inter-aspects — tap one for its reading.</div>
    </div>
    <div class="cols">
      <div>
        {#if selAspect}
          {@const r = contextReading(selAspect, style, 'synastry')}
          {@const A = natal.positions.find(p => p.body === selAspect.a)!}
          {@const B = partnerChart.positions.find(p => p.body === selAspect.b)!}
          <div class="readingcard">
            <h2 class="serif">your {BODY_NAME[selAspect.a]} {selAspect.def.name} their {BODY_NAME[selAspect.b]}</h2>
            <div class="sub">{fmtDegInSign(A.lon)} ↔ {fmtDegInSign(B.lon)} · orb {fmtOrb(selAspect.orb)} (synastry orbs run ~25% tighter than natal)</div>
            <p>{r.text} <span class="src">{r.source}</span></p>
          </div>
        {:else}
          <div class="readingcard hint">Inter-aspects between your chart and {session.partner.name}'s, strongest first. Tap one for its reading.</div>
        {/if}
        <details open>
          <summary>Inter-aspects ({cross.length})</summary>
          <CrossAspectList items={cross} aLabel="your" bLabel="their"
            aHouse={houseIn(natal)} bHouse={partnerChart ? houseIn(partnerChart) : undefined}
            selectedIndex={sel} onselect={i => { sel = i; outerSel = null; }} />
        </details>
        <details>
          <summary>House overlays — where their planets land in your houses</summary>
          {#each overlays.filter(o => ['sun', 'moon', 'venus', 'mars', 'saturn', 'juno'].includes(o.body)) as o}
            <div class="ovl">Their <b>{BODY_NAME[o.body]}</b> falls in your <b>house {o.house}</b> — {HOUSE_ARENA[o.house - 1]}.</div>
          {/each}
        </details>
        <details>
          <summary>Midpoint contacts (Ebertin, 90° dial, orb ≤1.5°)</summary>
          {#if mids.length === 0}<div class="ovl">None within orb.</div>{/if}
          {#each mids as m}
            <div class="ovl">Their <b>{BODY_NAME[m.body]}</b> on your <b>{BODY_NAME[m.pair[0]]}/{BODY_NAME[m.pair[1]]}</b> midpoint
              (orb {fmtOrb(m.orb)}){m.pair.includes('sun') && m.pair.includes('moon') ? ' — the classic Sun/Moon “inner marriage” point' : ''}.</div>
          {/each}
        </details>
      </div>
      <div>
        {#if dossier}
          <div class="readingcard">
            <h2 class="serif">{dossier.title}</h2>
            <div class="sub">Factors: {dossier.factors}</div>
            {#each dossier.sections as s}
              <div class="sec"><b>{s.heading}</b><p>{s.text} <span class="src">{s.source}</span></p></div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .sview { padding: 0 12px; }
  .pickrow { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .wheelrow { max-width: 720px; margin: 0 auto 10px; }
  .wheelrow .hint { text-align: center; }
  .cols { display: flex; gap: 14px; align-items: flex-start; }
  .cols > div { flex: 1 1 420px; min-width: 340px; }
  details {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 8px 12px; margin-bottom: 8px;
  }
  summary { cursor: pointer; color: var(--gold); font-size: 14px; }
  .ovl { font-size: 13.5px; margin: 7px 0; line-height: 1.45; }
  .readingcard {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; margin-bottom: 10px; font-size: 14px;
  }
  .readingcard h2 { font-size: 15.5px; color: var(--gold); }
  .readingcard .sub { color: var(--dim); font-size: 12px; margin: 2px 0 8px; }
  .readingcard p { line-height: 1.55; }
  .sec { margin: 9px 0; }
  .sec b { display: block; font-size: 12.5px; }
  .src {
    color: var(--dim); font-size: 10px; text-transform: uppercase;
    letter-spacing: .06em; border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 4px;
  }
  .hint { color: var(--dim); }
  @media (max-width: 900px) { .cols { flex-direction: column; } }
</style>
