<script lang="ts">
  import ExpandableWheel from './ExpandableWheel.svelte';
  import CrossAspectList from './CrossAspectList.svelte';
  import PartnerPick from './PartnerPick.svelte';
  import { computeChart, type Chart } from '../chart/chart';
  import { localToUt } from '../chart/civil';
  import {
    activatedContacts, crossAspects, sunMoonMidpointHits, transitAspects, type CrossAspect,
  } from '../chart/relate';
  import { contextReading, LANDMARKS } from '../interpret/contexts';
  import { transitSnapshot } from '../interpret/snapshot';
  import { registerCopy } from './copyctx.svelte';
  import AskClaude from './AskClaude.svelte';
  import { redact } from '../ai/anonymise';
  import { who } from '../ai/readingstore';
  import {
    COUPLE_TRANSITS_STARTERS, COUPLE_TRANSITS_SYSTEM, DEFAULT_COUPLE_TRANSITS_REQUEST,
    DEFAULT_TRANSITS_REQUEST, TRANSITS_STARTERS, TRANSITS_SYSTEM,
  } from '../interpret/prompts';
  import { BODY_NAME, fmtDegInSign, fmtOrb } from '../render/glyphs';
  import { degDiff, type BodyKey, type EphemerisProvider } from '../ephemeris/types';
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

  // Couple transits ("Us, now", astro-ghw): synastry plus transits. The two
  // natal charts and their synastry contacts, with the sky of the date on each
  // and on those contacts. Transits to the composite are the Composite tab's.
  const partnerChart = $derived(session.partner ? chartFromSaved(session.partner) : null);
  const crossesB = $derived(sky && partnerChart ? transitAspects(skyPts, pts(partnerChart), enabledNames) : []);
  /** Synastry contacts, strongest first (a: your body, b: the partner's), as on the Synastry tab. */
  const synastry = $derived(partnerChart
    ? crossAspects(pts(natal), pts(partnerChart), { defs: enabledAspectDefs() }) : []);
  const activated = $derived(activatedContacts(crosses, crossesB, synastry));
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
  /** Couple selection: a transit to you (A), to the partner (B), or an activated contact (X). */
  let coupleSel = $state<{ list: 'A' | 'B' | 'X'; i: number } | null>(null);
  /** Selected transiting (outer-ring) body — its transits stay lit. */
  let outerSel = $state<BodyKey | null>(null);

  /** House of a body within a given chart, for the aspect lists. */
  const houseIn = (c: Chart) => (b: BodyKey) =>
    c.positions.find(p => p.body === b)?.house;

  const natalSelAspect = $derived(wheelSel.kind === 'aspect'
    ? natal.aspects.find(a => `${a.a}|${a.def.name}|${a.b}` === wheelSel.key) ?? null
    : null);
  const crossAspect = $derived(crossSel !== null ? crosses[crossSel] ?? null : null);
  const outerBodies = $derived(sky
    ? sky.positions.map(p => ({ body: p.body, lon: p.lon, retro: p.speed < 0 }))
    : []);

  const partnerName = $derived(session.partner?.name ?? 'partner');
  const youName = $derived(meta.name || 'you');
  const coupleAspect = $derived.by<{ x: CrossAspect; chart: Chart; label: string; contacts: CrossAspect[] } | null>(() => {
    if (!coupleSel || !partnerChart) return null;
    const act = coupleSel.list === 'X' ? activated[coupleSel.i] : undefined;
    const whose = act ? act.whose : coupleSel.list;
    const x = act ? act.transit : (whose === 'A' ? crosses : crossesB)[coupleSel.i];
    if (!x) return null;
    return {
      x, chart: whose === 'A' ? natal : partnerChart,
      label: whose === 'A' ? youName : partnerName,
      contacts: act?.contacts
        ?? activated.find(a => a.transit === x)?.contacts ?? [],
    };
  });

  // Tri-wheel: you inside, the partner in the middle ring with the strongest
  // synastry lines, the sky outside with the strongest transits to each of you.
  const LINES = 15;
  const partnerBodies = $derived(partnerChart
    ? partnerChart.positions.map(p => ({ body: p.body, lon: p.lon, retro: p.speed < 0 })) : []);
  const synWheel = $derived(synastry.slice(0, 12).map(x => ({ ...x, a: x.b, b: x.a })));
  const offA = $derived(Math.min(LINES, crosses.length));
  const transitLines = $derived([
    ...crosses.slice(0, LINES),
    ...crossesB.slice(0, LINES).map(x => ({ ...x, toOuter: true })),
  ]);
  /** The selected transit's line on the wheel, if it is drawn. */
  const lineSel = $derived.by<number | null>(() => {
    if (!coupleSel) return null;
    const act = coupleSel.list === 'X' ? activated[coupleSel.i] : undefined;
    const whose = act ? act.whose : coupleSel.list;
    const i = act ? (whose === 'A' ? crosses : crossesB).indexOf(act.transit) : coupleSel.i;
    if (i < 0 || i >= LINES) return null;
    return whose === 'A' ? (i < offA ? i : null) : offA + i;
  });
  /** The strongest synastry contact the selected transit touches, if drawn. */
  const contactSel = $derived.by<number | null>(() => {
    const c = coupleAspect?.contacts[0];
    if (!c) return null;
    const i = synastry.indexOf(c);
    return i >= 0 && i < 12 ? i : null;
  });

  const captionYou = $derived([
    meta.name || meta.place.name,
    `born ${meta.date} ${meta.time} · ${meta.place.name}, ${meta.place.country}`,
    `sky of ${session.transitDate} ${session.transitTime}`,
  ]);
  const captionCouple = $derived(session.partner
    ? [
        `Synastry + transits: ${youName} + ${session.partner.name}`,
        `${youName} (inner) · ${session.partner.name} (middle ring)`,
        `sky of ${session.transitDate} ${session.transitTime} (outer ring)`,
      ]
    : []);

  function resetToNow() {
    const n = new Date();
    session.transitDate = n.toISOString().slice(0, 10);
    session.transitTime = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }

  /** Transit snapshot for Ask Claude, optionally with names/places redacted. */
  function trBuild(anon: boolean): string {
    if (!sky) return '';
    const when = `${session.transitDate} ${session.transitTime}`;
    const couple = session.transitTarget === 'couple' && partnerChart && session.partner
      ? {
          partner: partnerChart, partnerName: session.partner.name,
          synastry: synastry.slice(0, 20), toPartner: crossesB, activated,
          midpointHits: [
            ...smHitsA.map(h => ({ whose: 'A' as const, ...h })),
            ...smHitsB.map(h => ({ whose: 'B' as const, ...h })),
          ],
        }
      : null;
    const text = transitSnapshot({ natal, meta, sky, when, toNatal: crosses, couple });
    if (!anon) return text;
    const reds = [
      { find: meta.name, replace: 'the native' },
      { find: meta.place.name, replace: '[location withheld]' },
      { find: meta.place.country, replace: '[country withheld]' },
    ];
    if (couple && session.partner) {
      reds.push({ find: session.partner.name, replace: 'their partner' });
      reds.push({ find: session.partner.place.name, replace: '[location withheld]' });
      reds.push({ find: session.partner.place.country, replace: '[country withheld]' });
    }
    return redact(text, reds);
  }

  // Reading context: solo and couple transits are separate, keyed by date.
  const trCouple = $derived(session.transitTarget === 'couple' && !!session.partner);
  const trGroup = $derived(trCouple
    ? `couple-transits|${who(meta.name, meta.date)}|${who(session.partner!.name, session.partner!.date)}`
    : `transits|${who(meta.name, meta.date)}`);
  const trTitle = $derived(trCouple
    ? `Couple transits · ${meta.name || 'unnamed'} & ${session.partner!.name} · ${session.transitDate}`
    : `Transits · ${meta.name || 'unnamed'} · ${session.transitDate}`);

  // The header's Copy for AI button copies the full (named) transit snapshot.
  $effect(() => registerCopy(
    session.transitTarget === 'couple' ? 'couple transits' : 'transits',
    sky ? () => trBuild(false) : null));
</script>

<div class="tview">
  <div class="controls form">
    <label>Date<input type="date" bind:value={session.transitDate}></label>
    <label>Time<input type="time" bind:value={session.transitTime}></label>
    <button class="chip" onclick={resetToNow}>Now</button>
    <span class="target" role="radiogroup" aria-label="Transit target">
      <button class:on={session.transitTarget === 'you'} onclick={() => { session.transitTarget = 'you'; coupleSel = null; }}>Your chart</button>
      <button class:on={session.transitTarget === 'couple'} onclick={() => { session.transitTarget = 'couple'; crossSel = null; }}>Us, now</button>
    </span>
    <span class="hint">Sky computed for {meta.place.name} ({meta.place.zone}). Tight transit orbs (≤3–4°).</span>
  </div>
  {#if session.transitTarget === 'couple'}
    <div class="hint usnote">This date's sky on both your charts and on the contacts between them. For the relationship's own chart, see Composite.</div>
  {/if}

  {#if sky}
    <AskClaude system={trCouple ? COUPLE_TRANSITS_SYSTEM : TRANSITS_SYSTEM}
      starters={trCouple ? COUPLE_TRANSITS_STARTERS : TRANSITS_STARTERS}
      defaultRequest={trCouple ? DEFAULT_COUPLE_TRANSITS_REQUEST : DEFAULT_TRANSITS_REQUEST}
      buildSnapshot={trBuild} accent="var(--transit)"
      tab={trCouple ? 'couple-transits' : 'transits'} readingGroup={trGroup}
      readingKey={`${trGroup}|${session.transitDate}`} readingTitle={trTitle} />
  {/if}

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
          <ExpandableWheel chart={natal} selection={wheelSel} {display} caption={captionYou}
            outer={outerBodies} outerColor="var(--transit)"
            crossAspects={crosses.slice(0, 30)} crossSelected={crossSel}
            oncross={i => { crossSel = i; wheelSel = { kind: 'none' }; outerSel = null; }}
            onselect={s => { wheelSel = s; crossSel = null; outerSel = null; }}
            outerSelected={outerSel}
            onouter={b => { outerSel = outerSel === b ? null : b; crossSel = null; wheelSel = { kind: 'none' }; }} />
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
            <CrossAspectList items={crosses} aLabel="t" bLabel="natal" bHouse={houseIn(natal)}
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
    {#if sky && partnerChart && session.partner}
      <div class="split">
        <div class="wheelcol">
          <ExpandableWheel chart={natal} selection={{ kind: 'none' }} {display} caption={captionCouple}
            outer={partnerBodies} outerColor="var(--syn)"
            crossAspects={synWheel} crossSelected={contactSel}
            oncross={() => {}} onselect={() => {}}
            outer2={outerBodies} outer2Color="var(--transit)"
            crossAspects2={transitLines} cross2Selected={lineSel}
            oncross2={j => { coupleSel = j < offA ? { list: 'A', i: j } : { list: 'B', i: j - offA }; }} />
          <div class="hint" style="padding:2px 6px">Three rings: {youName} inside, {session.partner.name} in the middle ring (dashed lines are your synastry contacts), the sky of {session.transitDate} outside (teal; dotted lines are its transits to each of you).</div>
        </div>
        <div class="listcol">
          {#if coupleAspect}
            {@const r = contextReading(coupleAspect.x, style, 'transit')}
            {@const t = sky.positions.find(p => p.body === coupleAspect.x.a)!}
            {@const n = coupleAspect.chart.positions.find(p => p.body === coupleAspect.x.b)!}
            <div class="readingcard">
              <h2 class="serif">transiting {BODY_NAME[coupleAspect.x.a]} {coupleAspect.x.def.name} {BODY_NAME[coupleAspect.x.b]}</h2>
              <div class="sub">to {coupleAspect.label} · {fmtDegInSign(t.lon)} → {fmtDegInSign(n.lon)} · orb {fmtOrb(coupleAspect.x.orb)} · {coupleAspect.x.applying ? 'applying' : 'separating'}</div>
              <p>{r.text} <span class="src">{r.source}</span></p>
              {#if coupleAspect.contacts.length}
                <p class="hint">This touches {coupleAspect.label}'s {BODY_NAME[coupleAspect.x.b]}, part of
                  {coupleAspect.contacts.length === 1 ? 'the synastry contact' : 'the synastry contacts'}
                  {coupleAspect.contacts.map(c => `${youName}'s ${BODY_NAME[c.a]} ${c.def.name} ${session.partner!.name}'s ${BODY_NAME[c.b]} (orb ${fmtOrb(c.orb)})`).join('; ')}:
                  the period sets {coupleAspect.contacts.length === 1 ? 'that contact' : 'those contacts'} going between you.</p>
              {/if}
            </div>
          {:else}
            <div class="readingcard hint">Transits to each of you, and those that set your synastry contacts going, strongest first. Tap a row or a dotted line.</div>
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
            <summary>Activating your contacts ({activated.length})</summary>
            {#if !activated.length}<div class="hint" style="padding:4px 8px">No transit touches a point of your strongest synastry contacts on this date.</div>{/if}
            {#each activated as a, i}
              <button type="button" class="actrow" class:on={coupleSel?.list === 'X' && coupleSel.i === i}
                onclick={() => coupleSel = { list: 'X', i }}>
                <span>transiting {BODY_NAME[a.transit.a]} {a.transit.def.name} {a.whose === 'A' ? youName : session.partner.name}'s {BODY_NAME[a.transit.b]} · {fmtOrb(a.transit.orb)}</span>
                {#each a.contacts as c}
                  <span class="via">in {youName}'s {BODY_NAME[c.a]} {c.def.name} {session.partner.name}'s {BODY_NAME[c.b]}</span>
                {/each}
              </button>
            {/each}
          </details>
          <details>
            <summary>To {meta.name || 'you'} ({crosses.length})</summary>
            <CrossAspectList items={crosses} aLabel="t" bLabel="natal" bHouse={houseIn(natal)}
              selectedIndex={coupleSel?.list === 'A' ? coupleSel.i : null}
              onselect={i => coupleSel = { list: 'A', i }} />
          </details>
          <details>
            <summary>To {session.partner.name} ({crossesB.length})</summary>
            <CrossAspectList items={crossesB} aLabel="t" bLabel="natal" bHouse={houseIn(partnerChart)}
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
  .target button.on { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .hint { color: var(--dim); font-size: 12.5px; }
  .usnote { margin: -4px 0 8px; }
  .actrow {
    display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%;
    background: none; border: none; border-radius: 6px; color: var(--ink); text-align: left;
    padding: 4px 8px; font-size: 12.5px; cursor: pointer;
  }
  .actrow:hover, .actrow.on { background: var(--bg2); }
  .actrow.on { outline: 1px solid var(--gold-dim); }
  .actrow .via { color: var(--dim); font-size: 11.5px; }
  .landmarks { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 8px; }
  .badge {
    background: var(--badgebg); color: var(--quincunx); border: 1px solid var(--quincunx);
    border-radius: 12px; padding: 3px 10px; font-size: 12px;
  }
  .split { display: flex; gap: 12px; align-items: flex-start; }
  .wheelcol { flex: 1 1 var(--wheel-size, 680px); min-width: min(380px, 100%); }
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
