<script module lang="ts">
  // Survives tab switches (the view is destroyed when another tab is shown).
  const kept = { jd: NaN, jdStart: NaN, model: 'ephemeris' as 'ephemeris' | 'circular' };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Glyph from './Glyph.svelte';
  import {
    INNER, OrreryPlate, StripChart, circularModel, dateOfJd, ephemerisModel, nearestPeriod,
    PALETTE, type OrreryModel, type PlateState,
  } from '../render/orrery';
  import { SIDEREAL_DAYS, retroArc, synodicDays, type InnerPlanet } from '../chart/retrograde';
  import { jdUtFromDate } from '../chart/time';
  import { BODY_NAME, fmtDegInSign } from '../render/glyphs';
  import { J2000_JD, degDiff, normDeg, type EphemerisProvider } from '../ephemeris/types';
  import type { DisplaySettings } from './state';

  let { provider, display, chartJd = null, chartLabel = '' }: {
    provider: EphemerisProvider;
    display: DisplaySettings;
    /** The cast chart's moment, if any: offered as a starting point. */
    chartJd?: number | null;
    chartLabel?: string;
  } = $props();

  const FONT = getComputedStyle(document.documentElement).fontFamily || 'system-ui, sans-serif';
  const models = { ephemeris: ephemerisModel(provider), circular: circularModel() };
  let modelId = $state<'ephemeris' | 'circular'>(kept.model);
  const model = $derived<OrreryModel>(models[modelId]);

  const nowJd = () => jdUtFromDate(new Date());
  // the ephemeris covers 1700–2200 (CoreProvider); keep a margin for the station search
  const JD_MIN = J2000_JD - 299 * 365.25, JD_MAX = J2000_JD + 199 * 365.25;
  let playing = $state(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  let dir = $state(1);
  let slider = $state(560);
  const speed = $derived(0.25 * Math.pow(1600, slider / 1000));
  let show = $state<Record<InnerPlanet, boolean>>({ mercury: true, venus: true });
  let sight = $state(true);
  let conj = $state(true);

  const plate: PlateState = {
    jd: Number.isFinite(kept.jd) ? kept.jd : nowJd(),
    jdStart: Number.isFinite(kept.jdStart) ? kept.jdStart : nowJd(),
    show: { mercury: true, venus: true }, sight: true, conj: true, pulses: [],
    glyphStyle: { weight: 7, slant: 0 }, markJd: null,
  };

  // Panel read-outs, refreshed ~10× a second from the animation loop.
  interface Readout {
    lon: number; speed: number; elong: number; sid: number; synPhase: number; syn: number;
    next: { sr: { jdUt: number; lon: number }; sd: { jdUt: number; lon: number }; inRetro: boolean; arc: number } | null;
  }
  let jdShown = $state(plate.jd);
  let ro = $state<Record<InnerPlanet, Readout | null>>({ mercury: null, venus: null });
  let log = $state<{ jd: number; text: string; glyph: InnerPlanet; tone: '' | 'rc' | 'dc' }[]>([]);

  let skyEl: HTMLCanvasElement, stripEl: HTMLCanvasElement, plateBox: HTMLDivElement;

  function fmtDate(jd: number, withTime = false) {
    const d = dateOfJd(jd);
    const s = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return withTime ? `${s} ${d.toISOString().slice(11, 16)} UT` : s;
  }

  function readout(b: InnerPlanet, jd: number): Readout {
    // reported values: the app's apparent ephemeris (or the idealised model)
    const eph = modelId === 'ephemeris';
    const st = eph ? provider.state(b, jd) : { lon: model.geoLon(b, jd), speed: model.rate(b, jd) };
    const sun = eph ? provider.state('sun', jd).lon : model.sunLon(jd);
    const p = model.pos(b, jd), e = model.pos('earth', jd);
    const hd = normDeg(Math.atan2(p[1], p[0]) * 180 / Math.PI - Math.atan2(e[1], e[0]) * 180 / Math.PI);
    const el = jd - plate.jdStart;
    const next = (() => {
      const L = model.stations(b, jd);
      for (let i = 0; i + 1 < L.length; i++) {
        const sr = L[i]!, sd = L[i + 1]!;
        if (sr.kind === 'SR' && sd.kind === 'SD' && sd.jdUt >= jd) {
          return { sr, sd, inRetro: sr.jdUt <= jd, arc: retroArc({ sr, sd }) };
        }
      }
      return null;
    })();
    return {
      lon: st.lon, speed: st.speed, elong: degDiff(st.lon, sun),
      sid: el / SIDEREAL_DAYS[b], syn: el / synodicDays(b), synPhase: hd / 360, next,
    };
  }

  function addLog(jd: number, glyph: InnerPlanet, text: string, tone: '' | 'rc' | 'dc' = '') {
    log = [{ jd, glyph, text, tone }, ...log].slice(0, 40);
  }

  /** Sidereal laps, inferior conjunctions and stations crossed between two frames. */
  function events(j0: number, j1: number, now: number) {
    if (j0 === j1) return;
    const lo = Math.min(j0, j1), hi = Math.max(j0, j1);
    const evs: [number, () => void][] = [];
    for (const b of INNER.filter(x => show[x])) {
      const P = SIDEREAL_DAYS[b];
      for (let k = Math.ceil((lo - plate.jdStart) / P); plate.jdStart + k * P <= hi; k++) {
        const t = plate.jdStart + k * P;
        if (k === 0 || t <= lo) continue;
        evs.push([t, () => {
          addLog(t, b, `sidereal orbit ${k} complete (${P.toFixed(1)} d): back among the same stars`);
          plate.pulses.push({ at: now, xy: model.pos(b, t), color: PALETTE[b], label: 'sidereal' });
        }]);
      }
      for (const t of model.conjunctions(b, hi)) {
        if (t <= lo || t > hi) continue;
        evs.push([t, () => {
          addLog(t, b, `inferior conjunction at ${fmtDegInSign(model.geoLon(b, t))}: synodic cycle ends`);
          plate.pulses.push({ at: now, xy: model.pos(b, t), earth: model.pos('earth', t), color: PALETTE.brass, label: 'synodic' });
        }]);
      }
      for (const st of model.stations(b, hi)) {
        if (st.jdUt <= lo || st.jdUt > hi) continue;
        const sr = st.kind === 'SR';
        evs.push([st.jdUt, () => {
          addLog(st.jdUt, b, `stations ${sr ? 'retrograde ℞' : 'direct'} at ${fmtDegInSign(st.lon)}`, sr ? 'rc' : 'dc');
          plate.pulses.push({ at: now, xy: model.pos(b, st.jdUt), color: sr ? PALETTE.retro : PALETTE.direct, label: sr ? '℞ station' : 'D station' });
        }]);
      }
    }
    evs.sort((a, b) => j1 > j0 ? a[0] - b[0] : b[0] - a[0]).slice(-12).forEach(e => e[1]());
  }

  function jump(jd: number) { plate.jd = jd; kept.jd = jd; }
  function nextStation() {
    let best: number | null = null;
    for (const b of INNER.filter(x => show[x])) for (const st of model.stations(b, plate.jd)) {
      const d = (st.jdUt - plate.jd) * dir;
      if (d > 1e-4 && (best === null || d < (best - plate.jd) * dir)) best = st.jdUt;
    }
    if (best !== null) { events(plate.jd, best, performance.now()); jump(best); playing = false; }
  }
  function resetCounters() { plate.jdStart = plate.jd; kept.jdStart = plate.jd; log = []; }

  $effect(() => { kept.model = modelId; });
  $effect(() => {
    plate.show = { ...show }; plate.sight = sight; plate.conj = conj;
    plate.glyphStyle = { weight: display.weight, slant: display.slant };
    plate.markJd = chartJd;
  });

  onMount(() => {
    const p = new OrreryPlate(skyEl, FONT), s = new StripChart(stripEl, FONT);
    const fit = () => { p.resize(plateBox.clientWidth, devicePixelRatio); s.resize(stripEl.clientWidth, devicePixelRatio); };
    fit();
    const obs = new ResizeObserver(fit); obs.observe(plateBox); obs.observe(stripEl);
    let last = performance.now(), lastPanel = 0, raf = 0, styleKey = '';
    const frame = (now: number) => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (playing) {
        const j0 = plate.jd, j1 = j0 + dir * speed * dt;
        if (j1 > JD_MAX || j1 < JD_MIN) playing = false;
        else { plate.jd = j1; kept.jd = j1; events(j0, j1, now); }
      }
      const key = `${plate.glyphStyle.weight}/${plate.glyphStyle.slant}`;
      if (key !== styleKey) { styleKey = key; p.resize(plateBox.clientWidth, devicePixelRatio); }
      p.draw(model, plate, now);
      s.draw(model, plate.jd, plate.show, plate.glyphStyle);
      if (now - lastPanel > 100) {
        lastPanel = now; jdShown = plate.jd;
        ro = { mercury: show.mercury ? readout('mercury', plate.jd) : null, venus: show.venus ? readout('venus', plate.jd) : null };
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); obs.disconnect(); };
  });

  const elapsed = $derived(jdShown - plate.jdStart);
  const fmtSpeed = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} days / s`;
</script>

<div class="rview">
  <div class="stage">
    <div class="plate" bind:this={plateBox}>
      <canvas bind:this={skyEl} aria-label="Heliocentric view of Mercury, Venus and Earth inside the zodiac, with each planet's apparent track among the stars"></canvas>
    </div>

    <div class="controlbar" role="group" aria-label="Animation controls">
      <button onclick={() => playing = !playing}>{playing ? 'Pause' : 'Play'}</button>
      <span class="seg" role="group" aria-label="Direction of time">
        <button class:on={dir < 0} onclick={() => { dir = -1; playing = true; }}>◀ Back</button>
        <button class:on={dir > 0} onclick={() => { dir = 1; playing = true; }}>Forward ▶</button>
      </span>
      <span class="speed">
        <label for="rv-speed">Speed</label>
        <input id="rv-speed" type="range" min="0" max="1000" bind:value={slider}>
        <span class="num">{fmtSpeed(speed)}</span>
      </span>
      <button onclick={nextStation}>Next station</button>
      <button onclick={() => jump(nowJd())}>Now</button>
      {#if chartJd != null}
        <button onclick={() => jump(chartJd!)} title="Jump to the cast chart's moment">{chartLabel || 'Chart date'}</button>
      {/if}
      <span class="seg" role="group" aria-label="Orbit model">
        <button class:on={modelId === 'ephemeris'} onclick={() => modelId = 'ephemeris'}
          title="Real positions from the app's ephemeris: elliptical, inclined orbits; stations as on the chart wheel">True orbits</button>
        <button class:on={modelId === 'circular'} onclick={() => modelId = 'circular'}
          title="Idealised circular orbits at mean distance and speed, for teaching">Circular</button>
      </span>
    </div>

    <div class="legend">
      <span><i class="sw" style="background:{PALETTE.retro}"></i>Retrograde</span>
      <span><b style="color:{PALETTE.retro}">℞</b> station retrograde</span>
      <span><b style="color:{PALETTE.direct}">D</b> station direct</span>
      <span><i class="sw" style="background:{PALETTE.brass}"></i>Sun–Earth line (synodic reference)</span>
      <span><i class="sw dash"></i>Start longitude (sidereal reference)</span>
      <span><i class="sw" style="background:{PALETTE.venus}"></i>Venus pentagram: inferior conjunctions on the zodiac</span>
    </div>

    <section class="stripbox">
      <h2>The ecliptic as seen from Earth</h2>
      <p class="sub">Apparent longitude against time. The planets swing either side of the Sun (gold) and run backwards, in red, each time they pass between Sun and Earth.</p>
      <canvas class="strip" bind:this={stripEl}></canvas>
    </section>

    <p class="note">
      The plate looks down on the ecliptic from the north; motion is anticlockwise and orbits are to scale.
      Each planet's lane inside the zodiac is a time spiral: the outer edge is now and older positions sink inward, so a retrograde loop opens out.
      The solid sight line runs from Earth through the planet to a dot on the drawn ecliptic; the dotted line from the Sun is parallel to it and gives the true longitude
      (the stars are at infinity, the drawn ring is not, and the dashed arc shows the gap).
      {#if modelId === 'ephemeris'}
        Positions come from the same ephemeris as the charts, and station times match Swiss Ephemeris to within ten minutes (1990–2040). The dot on each orbit marks perihelion.
      {:else}
        Circular orbits use mean motions, so station dates drift from the real ones: by up to about 5 days for Mercury and 2 for Venus (1990–2040).
      {/if}
    </p>
  </div>

  <aside class="side">
    <div class="card">
      <div class="lab">Date shown</div>
      <div class="date">{fmtDate(jdShown)}</div>
      <dl class="kv">
        <dt>Time</dt><dd>{dateOfJd(jdShown).toISOString().slice(11, 16)} UT</dd>
        <dt>Elapsed</dt><dd>{elapsed >= 0 ? '+' : '−'}{Math.abs(elapsed).toFixed(1)} d · {(elapsed / SIDEREAL_DAYS.earth).toFixed(2)} yr</dd>
        <dt>Earth orbits</dt><dd>{(elapsed / SIDEREAL_DAYS.earth).toFixed(3)}</dd>
      </dl>
      <div class="row">
        <button onclick={resetCounters} title="Start the elapsed counters from the date shown">Reset counters</button>
      </div>
      <div class="row">
        <label><input type="checkbox" bind:checked={show.mercury}> <Glyph body="mercury" size={14} color={PALETTE.mercury} /> Mercury</label>
        <label><input type="checkbox" bind:checked={show.venus}> <Glyph body="venus" size={14} color={PALETTE.venus} /> Venus</label>
      </div>
      <div class="row small">
        <label><input type="checkbox" bind:checked={sight}> Sight lines</label>
        <label><input type="checkbox" bind:checked={conj}> Conjunction figure</label>
      </div>
    </div>

    {#each INNER as b (b)}
      {@const r = ro[b]}
      {#if show[b] && r}
        <div class="card">
          <div class="ptitle">
            <h2><Glyph body={b} size={18} color={PALETTE[b]} /> {BODY_NAME[b]}</h2>
            {#if Math.abs(r.speed) < 0.15}
              <span class="chip station">{r.speed < 0 ? 'Stationary ℞' : 'Stationary'}</span>
            {:else if r.speed < 0}
              <span class="chip retro">Retrograde ℞</span>
            {:else}
              <span class="chip direct">Direct</span>
            {/if}
          </div>
          <dl class="kv">
            <dt>Longitude</dt><dd>{fmtDegInSign(r.lon)}</dd>
            <dt>Motion</dt><dd>{r.speed >= 0 ? '+' : '−'}{Math.abs(r.speed).toFixed(3)}°/d</dd>
            <dt>Elongation</dt><dd>{Math.abs(r.elong).toFixed(1)}° {r.elong >= 0 ? 'E (evening)' : 'W (morning)'}</dd>
          </dl>
          <div class="bar-row"><span>Sidereal orbit <span class="num">{SIDEREAL_DAYS[b].toFixed(2)} d</span></span><span class="num">{r.sid.toFixed(2)} laps</span>
            <div class="bar"><i style="width:{((r.sid % 1 + 1) % 1) * 100}%;background:{PALETTE[b]}"></i></div></div>
          <div class="bar-row"><span>Synodic cycle <span class="num">{synodicDays(b).toFixed(2)} d</span></span><span class="num">{r.syn.toFixed(2)} cycles</span>
            <div class="bar"><i style="width:{r.synPhase * 100}%;background:{PALETTE.brass}"></i></div></div>
          {#if r.next}
            <dl class="kv">
              <dt>{r.next.inRetro ? 'Turned ℞' : 'Next ℞'}</dt><dd>{fmtDate(r.next.sr.jdUt, true)}<br>{fmtDegInSign(r.next.sr.lon)}</dd>
              <dt>Turns direct</dt><dd>{fmtDate(r.next.sd.jdUt, true)}<br>{fmtDegInSign(r.next.sd.lon)}</dd>
              <dt>Retrograde arc</dt><dd>{r.next.arc.toFixed(1)}° in {(r.next.sd.jdUt - r.next.sr.jdUt).toFixed(1)} d</dd>
            </dl>
          {/if}
        </div>
      {/if}
    {/each}

    <div class="card">
      <h2>Sidereal against synodic</h2>
      <p class="note">The <b>sidereal</b> period is one lap against the stars. The <b>synodic</b> period runs from one inferior conjunction to the next. Earth moves on meanwhile, so the inner planet needs extra time to catch up:</p>
      <div class="formula">
        {#each INNER as b (b)}
          <div><Glyph body={b} size={12} /> 1/S = 1/{SIDEREAL_DAYS[b].toFixed(3)} − 1/{SIDEREAL_DAYS.earth.toFixed(3)} → <b>S = {synodicDays(b).toFixed(2)} d</b></div>
        {/each}
        <div>Venus: 5 synodic periods = {(5 * synodicDays('venus') / SIDEREAL_DAYS.earth).toFixed(3)} yr ≈ 8 yr, hence the pentagram.</div>
        <div>Each conjunction falls {(360 - (synodicDays('venus') / SIDEREAL_DAYS.earth % 1) * 360).toFixed(1)}° behind the last in the zodiac (two-fifths of a circle),
          so joining them in order draws a five-pointed star; after five the star has turned back {(5 * 360 * (1 - synodicDays('venus') / SIDEREAL_DAYS.earth % 1) - 720).toFixed(1)}°.</div>
      </div>
    </div>

    <div class="card">
      <h2>Event log</h2>
      <ul class="log">
        {#each log as e (e.jd + e.text)}
          <li><span class="num">{fmtDate(e.jd)}</span><span><Glyph body={e.glyph} size={12} color={PALETTE[e.glyph]} /> <span class={e.tone}>{e.text}</span></span></li>
        {:else}
          <li><span>—</span><span>Stations, conjunctions and completed orbits appear here as they happen.</span></li>
        {/each}
      </ul>
    </div>
  </aside>
</div>

<style>
  .rview {
    max-width: 1220px; margin: 0 auto; padding: 8px 24px 24px;
    display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start;
  }
  @media (max-width: 920px) { .rview { grid-template-columns: minmax(0, 1fr); padding-inline: 16px; } }
  .stage { min-width: 0; display: grid; gap: 10px; }
  .plate { width: 100%; max-width: 780px; margin: 0 auto; aspect-ratio: 1 / 1; }
  .plate canvas { width: 100%; height: 100%; display: block; border-radius: 10px; }
  .controlbar {
    display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; width: 100%; max-width: 780px; margin: 0 auto;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px;
  }
  button {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px; cursor: pointer;
  }
  button:hover { border-color: var(--gold-dim); }
  button.on { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .seg { display: inline-flex; }
  .seg button { border-radius: 0; }
  .seg button:first-child { border-radius: 14px 0 0 14px; }
  .seg button:last-child { border-radius: 0 14px 14px 0; border-left: 0; }
  .speed { display: flex; align-items: center; gap: 10px; flex: 1 1 240px; min-width: 0; }
  .speed label { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
  .speed input { flex: 1; min-width: 80px; accent-color: var(--gold); }
  .speed .num { min-width: 7.5em; text-align: right; font-size: 12.5px; }
  .num { font-variant-numeric: tabular-nums; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: var(--dim); max-width: 780px; margin: 0 auto; width: 100%; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .sw { display: inline-block; width: 18px; height: 3px; border-radius: 2px; }
  .sw.dash { background: repeating-linear-gradient(90deg, var(--dim) 0 4px, transparent 4px 7px); }
  .stripbox { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 6px; min-width: 0; }
  .stripbox h2, .card h2 { font-size: 15px; color: var(--gold); margin: 0; font-weight: 600; }
  .stripbox .sub { color: var(--dim); font-size: 12px; margin: 2px 0 6px; }
  .strip { width: 100%; height: 230px; display: block; border-radius: 6px; }
  .note { font-size: 12px; color: var(--dim); margin: 0; line-height: 1.5; }
  .note b { color: var(--ink); font-weight: 600; }
  .side { display: grid; gap: 12px; min-width: 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 9px; }
  .lab { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
  .date { font-size: 24px; color: var(--ink); letter-spacing: .02em; }
  .row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
  .row.small { font-size: 12px; color: var(--dim); }
  label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
  .kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 13px; margin: 0; }
  .kv dt { color: var(--dim); }
  .kv dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .ptitle { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chip { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; white-space: nowrap; }
  .chip.direct { color: var(--sextile); }
  .chip.retro { color: var(--square); }
  .chip.station { color: var(--gold); }
  .bar-row { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; font-size: 12px; align-items: center; }
  .bar { grid-column: 1 / -1; height: 8px; background: var(--bg); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .bar i { display: block; height: 100%; }
  .formula { font-size: 12px; color: var(--dim); line-height: 1.7; overflow-x: auto; font-variant-numeric: tabular-nums; }
  .formula b { color: var(--ink); }
  .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12px; max-height: 190px; overflow-y: auto; }
  .log li { display: grid; grid-template-columns: 86px 1fr; gap: 8px; color: var(--dim); }
  .log li > span:last-child { color: var(--ink); }
  .rc { color: var(--square); } .dc { color: var(--sextile); }
</style>
