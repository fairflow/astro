<script module lang="ts">
  import type { Planet } from '../chart/retrograde';
  // Survives tab switches (the view is destroyed when another tab is shown).
  const kept = {
    jd: NaN, jdStart: NaN, model: 'ephemeris' as 'ephemeris' | 'circular',
    inferior: true, superior: false, decagram: false, sight: true, view: 'earth' as 'earth' | 'sun',
    show: {
      mercury: true, venus: true, mars: false, jupiter: false, saturn: false,
      uranus: false, neptune: false, pluto: false,
    } as Record<Planet, boolean>,
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Glyph from './Glyph.svelte';
  import {
    GROUPS, OrreryPlate, PLANETS_IN_ORDER, StripChart, circularModel, dateOfJd, ephemerisModel,
    paletteFor, type OrreryModel, type PlateState,
  } from '../render/orrery';
  import { SIDEREAL_DAYS, isInner, retroArc, synodicDays } from '../chart/retrograde';
  import { jdUtFromDate } from '../chart/time';
  import { BODY_NAME, fmtDegInSign } from '../render/glyphs';
  import { J2000_JD, degDiff, normDeg, type EphemerisProvider } from '../ephemeris/types';
  import type { DisplaySettings } from './state';

  let {
    provider, display, chartJd = null, chartLabel = '', standalone = false,
    theme = 'dark', onthemechange,
  }: {
    provider: EphemerisProvider;
    display: DisplaySettings;
    /** The cast chart's moment, if any: offered as a starting point. */
    chartJd?: number | null;
    chartLabel?: string;
    /** True in the standalone build, which links back to the app instead. */
    standalone?: boolean;
    /** Light or dark: the app's setting, or the standalone page's own switch. */
    theme?: 'dark' | 'light';
    /** Standalone only: the page owns its theme, so the switch lives in the options panel. */
    onthemechange?: (t: 'dark' | 'light') => void;
  } = $props();

  /** The standalone build, published on claude.ai (see DEVELOPMENT.md). */
  const ARTIFACT_URL = 'https://claude.ai/artifact/B7PYodLUsCczgkGTPhCynF';
  const FONT = getComputedStyle(document.documentElement).fontFamily || 'system-ui, sans-serif';
  const models = { ephemeris: ephemerisModel(provider), circular: circularModel() };
  let modelId = $state<'ephemeris' | 'circular'>(kept.model);
  const model = $derived<OrreryModel>(models[modelId]);
  const pal = $derived(paletteFor(theme));

  const nowJd = () => jdUtFromDate(new Date());
  // the ephemeris covers 1700–2200 (CoreProvider); keep a margin for the station search
  const JD_MIN = J2000_JD - 299 * 365.25, JD_MAX = J2000_JD + 199 * 365.25;
  let playing = $state(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  let dir = $state(1);
  // 0.25 to 10,000 days a second on a log scale; 392 ≈ 16 d/s
  let slider = $state(392);
  const speed = $derived(0.25 * Math.pow(40000, slider / 1000));
  let show = $state<Record<Planet, boolean>>({ ...kept.show });
  let sight = $state(kept.sight);
  let inferior = $state(kept.inferior);
  let superior = $state(kept.superior);
  let decagram = $state(kept.decagram);
  let view = $state<'earth' | 'sun'>(kept.view);
  let helpOpen = $state(false);
  let panelOpen = $state(false);
  const visible = $derived(PLANETS_IN_ORDER.filter(b => show[b]));

  const plate: PlateState = {
    jd: Number.isFinite(kept.jd) ? kept.jd : nowJd(),
    jdStart: Number.isFinite(kept.jdStart) ? kept.jdStart : nowJd(),
    show: { ...kept.show }, sight: true, inferior: true, superior: false, decagram: false,
    view: 'earth', theme: 'dark', pulses: [], glyphStyle: { weight: 7, slant: 0 }, markJd: null,
  };

  // Panel read-outs, refreshed ~10× a second from the animation loop.
  interface Readout {
    lon: number; speed: number; elong: number; sid: number; synPhase: number; syn: number;
    next: { sr: { jdUt: number; lon: number }; sd: { jdUt: number; lon: number }; inRetro: boolean; arc: number } | null;
  }
  let jdShown = $state(plate.jd);
  let ro = $state<Partial<Record<Planet, Readout>>>({});
  let log = $state<{ jd: number; text: string; glyph: Planet; tone: '' | 'rc' | 'dc' }[]>([]);

  let skyEl: HTMLCanvasElement, stripEl: HTMLCanvasElement, plateBox: HTMLDivElement;

  function fmtDate(jd: number, withTime = false) {
    const d = dateOfJd(jd);
    const s = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return withTime ? `${s} ${d.toISOString().slice(11, 16)} UT` : s;
  }
  const helioLon = (b: Planet | 'earth', jd: number) => { const p = model.pos(b, jd); return Math.atan2(p[1], p[0]) * 180 / Math.PI; };

  function readout(b: Planet, jd: number): Readout {
    // reported values: the app's apparent ephemeris (or the idealised model)
    const eph = modelId === 'ephemeris';
    const st = eph ? provider.state(b, jd) : { lon: model.geoLon(b, jd), speed: model.rate(b, jd) };
    const sun = eph ? provider.state('sun', jd).lon : model.sunLon(jd);
    // synodic phase from the mid-retrograde alignment: the faster body's lead over the slower
    const lead = isInner(b) ? helioLon(b, jd) - helioLon('earth', jd) : helioLon('earth', jd) - helioLon(b, jd);
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
      sid: el / SIDEREAL_DAYS[b], syn: el / synodicDays(b), synPhase: normDeg(lead) / 360, next,
    };
  }

  function addLog(jd: number, glyph: Planet, text: string, tone: '' | 'rc' | 'dc' = '') {
    log = [{ jd, glyph, text, tone }, ...log].slice(0, 40);
  }
  const midName = (b: Planet) => isInner(b) ? 'inferior conjunction' : 'opposition';
  const behindName = (b: Planet) => isInner(b) ? 'superior conjunction' : 'conjunction with the Sun';

  /** Sidereal laps, alignments with the Sun and stations crossed between two frames. */
  function events(j0: number, j1: number, now: number) {
    if (j0 === j1) return;
    const lo = Math.min(j0, j1), hi = Math.max(j0, j1);
    const evs: [number, () => void][] = [];
    for (const b of visible) {
      const P = SIDEREAL_DAYS[b];
      for (let k = Math.ceil((lo - plate.jdStart) / P); plate.jdStart + k * P <= hi; k++) {
        const t = plate.jdStart + k * P;
        if (k === 0 || t <= lo) continue;
        evs.push([t, () => {
          addLog(t, b, `sidereal orbit ${k} complete (${P < 1000 ? P.toFixed(1) + ' d' : (P / 365.25).toFixed(1) + ' yr'}): back among the same stars`);
          plate.pulses.push({ at: now, xy: model.pos(b, t), color: pal[b], label: 'sidereal' });
        }]);
      }
      for (const t of model.midRetro(b, hi)) {
        if (t <= lo || t > hi) continue;
        evs.push([t, () => {
          addLog(t, b, `${midName(b)} at ${fmtDegInSign(model.geoLon(b, t))}: synodic cycle ends`);
          plate.pulses.push({ at: now, xy: model.pos(b, t), earth: model.pos(isInner(b) ? 'earth' : b, t), color: pal.brass, label: 'synodic' });
        }]);
      }
      for (const t of model.behindSun(b, hi)) {
        if (t <= lo || t > hi) continue;
        evs.push([t, () => {
          addLog(t, b, `${behindName(b)} at ${fmtDegInSign(model.geoLon(b, t))}: behind the Sun`);
          plate.pulses.push({ at: now, xy: model.pos(b, t), color: pal.superior, label: 'behind ☉' });
        }]);
      }
      for (const st of model.stations(b, hi)) {
        if (st.jdUt <= lo || st.jdUt > hi) continue;
        const sr = st.kind === 'SR';
        evs.push([st.jdUt, () => {
          addLog(st.jdUt, b, `stations ${sr ? 'retrograde ℞' : 'direct'} at ${fmtDegInSign(st.lon)}`, sr ? 'rc' : 'dc');
          plate.pulses.push({ at: now, xy: model.pos(b, st.jdUt), color: sr ? pal.retro : pal.direct, label: sr ? '℞ station' : 'D station' });
        }]);
      }
    }
    evs.sort((a, b) => j1 > j0 ? a[0] - b[0] : b[0] - a[0]).slice(-12).forEach(e => e[1]());
  }

  function jump(jd: number) { plate.jd = jd; kept.jd = jd; }
  function nextStation() {
    let best: number | null = null;
    for (const b of visible) for (const st of model.stations(b, plate.jd)) {
      const d = (st.jdUt - plate.jd) * dir;
      if (d > 1e-4 && (best === null || d < (best - plate.jd) * dir)) best = st.jdUt;
    }
    if (best !== null) { events(plate.jd, best, performance.now()); jump(best); playing = false; }
  }
  function resetCounters() { plate.jdStart = plate.jd; kept.jdStart = plate.jd; log = []; }
  function setGroup(planets: Planet[], on: boolean) { for (const b of planets) show[b] = on; }

  $effect(() => { kept.model = modelId; });
  $effect(() => {
    plate.show = { ...show }; plate.sight = sight; plate.theme = theme;
    plate.inferior = inferior; plate.superior = superior; plate.decagram = decagram; plate.view = view;
    Object.assign(kept, { show: { ...show }, sight, inferior, superior, decagram, view });
    plate.glyphStyle = { weight: display.weight, slant: display.slant };
    plate.markJd = chartJd;
  });

  onMount(() => {
    const p = new OrreryPlate(skyEl, FONT), s = new StripChart(stripEl, FONT);
    const fit = () => { p.resize(plateBox.clientWidth, devicePixelRatio); s.resize(stripEl.clientWidth, devicePixelRatio); };
    fit();
    const obs = new ResizeObserver(fit); obs.observe(plateBox); obs.observe(stripEl);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') panelOpen = false; };
    addEventListener('keydown', esc);
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
      s.draw(model, plate.jd, plate.show, plate.glyphStyle, plate.theme);
      if (now - lastPanel > 100) {
        lastPanel = now; jdShown = plate.jd;
        const r: Partial<Record<Planet, Readout>> = {};
        for (const b of PLANETS_IN_ORDER) if (plate.show[b]) r[b] = readout(b, plate.jd);
        ro = r;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); obs.disconnect(); removeEventListener('keydown', esc); };
  });

  const elapsed = $derived(jdShown - plate.jdStart);
  const fmtSpeed = (v: number) => v < 10 ? `${v.toFixed(1)} d/s` : v < 1000 ? `${Math.round(v)} d/s` : `${(v / 365.25).toFixed(1)} yr/s`;
  const fmtPeriod = (d: number) => d < 1000 ? `${d.toFixed(2)} d` : `${(d / 365.25).toFixed(2)} yr`;
</script>

{#if !standalone}
  <div class="elsewhere">
    <span>This view on its own page:</span>
    <a href="retrograde/" target="_blank" rel="noopener">Standalone page ↗</a>
    <a href={ARTIFACT_URL} target="_blank" rel="noopener"
      title="The same page published on claude.ai; private until shared from its Share menu">claude.ai artifact ↗</a>
  </div>
{/if}

<div class="rview">
  <div class="stage">
    <div class="plate" bind:this={plateBox}>
      <canvas bind:this={skyEl} aria-label="The planets seen from above the north ecliptic pole inside the zodiac, with each planet's apparent track among the stars"></canvas>
    </div>

    <div class="legend">
      <span><i class="sw" style="background:{pal.retro}"></i>Retrograde</span>
      <span><b style="color:{pal.retro}">℞</b> station retrograde</span>
      <span><b style="color:{pal.direct}">D</b> station direct</span>
      <span><i class="sw" style="background:{pal.brass}"></i>Sun–Earth line</span>
      {#if show.venus && (inferior || decagram)}<span><i class="sw" style="background:{pal.venus}"></i>Inferior conjunctions</span>{/if}
      {#if show.venus && (superior || decagram)}<span><i class="sw" style="background:{pal.superior}"></i>Superior conjunctions</span>{/if}
      {#if visible.some(b => !isInner(b))}<span class="scale">Distances true to scale out to Mars, then logarithmic: each step out multiplies distance by the same factor.</span>{/if}
    </div>

    <section class="stripbox">
      <h2>The ecliptic as seen from Earth</h2>
      <p class="sub">Apparent longitude against time. Red stretches are retrograde; the gold line is the Sun.</p>
      <canvas class="strip" bind:this={stripEl}></canvas>
    </section>

    <p class="note">
      Seen from above the north ecliptic pole: motion is anticlockwise.
      With Earth centred, each sight line meets the zodiac where the planet appears.
      Each planet's lane is a time spiral: the outer edge is now and older positions sink inward, so a retrograde loop opens out.
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
        <button onclick={() => panelOpen = true}>Planets and options…</button>
      </div>
    </div>

    {#each visible as b (b)}
      {@const r = ro[b]}
      {#if r}
        <div class="card">
          <div class="ptitle">
            <h2><Glyph body={b} size={18} color={pal[b]} /> {BODY_NAME[b]}</h2>
            {#if Math.abs(r.speed) < (isInner(b) ? 0.15 : 0.005)}
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
          <div class="bar-row"><span>Sidereal orbit <span class="num">{fmtPeriod(SIDEREAL_DAYS[b])}</span></span><span class="num">{r.sid.toFixed(2)} laps</span>
            <div class="bar"><i style="width:{((r.sid % 1 + 1) % 1) * 100}%;background:{pal[b]}"></i></div></div>
          <div class="bar-row"><span>Synodic cycle <span class="num">{fmtPeriod(synodicDays(b))}</span></span><span class="num">{r.syn.toFixed(2)} cycles</span>
            <div class="bar"><i style="width:{r.synPhase * 100}%;background:{pal.brass}"></i></div></div>
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
      <p class="note">The <b>sidereal</b> period is one lap against the stars. The <b>synodic</b> period runs from one {visible.some(b => !isInner(b)) ? 'inferior conjunction or opposition' : 'inferior conjunction'} to the next, the faster planet having gained a whole lap on the slower:</p>
      <div class="formula">
        {#each visible as b (b)}
          <div><Glyph body={b} size={12} />
            {#if isInner(b)}1/S = 1/{SIDEREAL_DAYS[b].toFixed(3)} − 1/{SIDEREAL_DAYS.earth.toFixed(3)}{:else}1/S = 1/{SIDEREAL_DAYS.earth.toFixed(3)} − 1/{SIDEREAL_DAYS[b].toFixed(1)}{/if}
            → <b>S = {synodicDays(b).toFixed(2)} d</b></div>
        {/each}
        {#if show.venus}
          <div>Venus: 5 synodic periods = {(5 * synodicDays('venus') / SIDEREAL_DAYS.earth).toFixed(3)} yr ≈ 8 yr, hence the pentagram.</div>
          <div>Each conjunction falls {(360 - (synodicDays('venus') / SIDEREAL_DAYS.earth % 1) * 360).toFixed(1)}° behind the last in the zodiac (two-fifths of a circle),
            so joining them in order draws a five-pointed star. After five conjunctions ({(5 * synodicDays('venus') / SIDEREAL_DAYS.earth).toFixed(3)} yr) each point has moved
            back {(5 * 360 * (1 - synodicDays('venus') / SIDEREAL_DAYS.earth % 1) - 720).toFixed(1)}° against the stars, or about 2.3° in zodiac longitude, which itself precesses
            (measured from the ephemeris, 1700–2200: 2.1°–2.6°). A point takes about 1,200 years to go once round.</div>
        {/if}
      </div>
    </div>

    <div class="card">
      <h2>Event log</h2>
      <ul class="log">
        {#each log as e (e.jd + e.text)}
          <li><span class="num">{fmtDate(e.jd)}</span><span><Glyph body={e.glyph} size={12} color={pal[e.glyph]} /> <span class={e.tone}>{e.text}</span></span></li>
        {:else}
          <li><span>—</span><span>Stations, alignments with the Sun and completed orbits appear here as they happen.</span></li>
        {/each}
      </ul>
    </div>
  </aside>
</div>

<!-- the player stays in view at all times -->
<div class="player" role="group" aria-label="Animation controls">
  <div class="inner">
    <button class="play" onclick={() => playing = !playing}>{playing ? 'Pause' : 'Play'}</button>
    <span class="seg" role="group" aria-label="Direction of time">
      <button class:on={dir < 0} onclick={() => { dir = -1; playing = true; }} aria-label="Play backwards">◀</button>
      <button class:on={dir > 0} onclick={() => { dir = 1; playing = true; }} aria-label="Play forwards">▶</button>
    </span>
    <span class="speed">
      <label for="rv-speed">Speed</label>
      <input id="rv-speed" type="range" min="0" max="1000" bind:value={slider}>
      <span class="num">{fmtSpeed(speed)}</span>
    </span>
    <span class="when num">{fmtDate(jdShown)}</span>
    <button onclick={nextStation}>Next station</button>
    <button onclick={() => jump(nowJd())}>Now</button>
    {#if chartJd != null}
      <button onclick={() => jump(chartJd!)} title="Jump to the cast chart's moment">{chartLabel || 'Chart date'}</button>
    {/if}
    <button class="opts" aria-expanded={panelOpen} aria-controls="rv-panel" onclick={() => panelOpen = !panelOpen}>☰ Options</button>
  </div>
</div>

{#if panelOpen}
  <button class="scrim" aria-label="Close options" onclick={() => panelOpen = false}></button>
{/if}
<aside id="rv-panel" class="drawer" class:open={panelOpen} aria-hidden={!panelOpen} inert={!panelOpen}>
  <div class="dhead">
    <h2>Options</h2>
    <button onclick={() => panelOpen = false} aria-label="Close options">✕</button>
  </div>

  <section>
    <h3>Planets</h3>
    {#each GROUPS as g (g.id)}
      {@const n = g.planets.filter(b => show[b]).length}
      <div class="group">
        <label class="gl">
          <input type="checkbox" checked={n === g.planets.length} indeterminate={n > 0 && n < g.planets.length}
            onchange={e => setGroup(g.planets, (e.currentTarget as HTMLInputElement).checked)}>
          {g.label}
        </label>
        <div class="members">
          {#each g.planets as b (b)}
            <label><input type="checkbox" bind:checked={show[b]}> <Glyph body={b} size={14} color={pal[b]} /> {BODY_NAME[b]}</label>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section>
    <h3>Show</h3>
    <label><input type="checkbox" bind:checked={sight}> Sight lines</label>
    <label style="--c:{pal.venus}"><input type="checkbox" bind:checked={inferior}> Venus inferior ☌ pentagram</label>
    <label style="--c:{pal.superior}"><input type="checkbox" bind:checked={superior}> Venus superior ☌ pentagram</label>
    <label><input type="checkbox" bind:checked={decagram}> Venus decagram round the Sun</label>
  </section>

  <section>
    <h3>View</h3>
    <div class="row">
      <span class="seg" role="group" aria-label="Keep still">
        <button class:on={view === 'earth'} onclick={() => view = 'earth'}
          title="Earth stays at the centre with the zodiac round it, as the sky is seen">Earth centre</button>
        <button class:on={view === 'sun'} onclick={() => view = 'sun'}
          title="The Sun stays at the centre with the zodiac drawn round it">Sun centre</button>
      </span>
    </div>
    <div class="row">
      <span class="seg" role="group" aria-label="Orbit model">
        <button class:on={modelId === 'ephemeris'} onclick={() => modelId = 'ephemeris'}>True orbits</button>
        <button class:on={modelId === 'circular'} onclick={() => modelId = 'circular'}>Circular</button>
      </span>
      <button class="q" aria-expanded={helpOpen} aria-label="About the orbit models" onclick={() => helpOpen = !helpOpen}>?</button>
    </div>
    {#if helpOpen}
      <p class="pop" role="note">
        <b>True orbits</b>: positions from the same ephemeris as the charts; station times match Swiss Ephemeris to within ten minutes for Mercury to Jupiter and within an hour for the outermost planets (1990–2040).<br>
        <b>Circular</b>: mean motions on circular orbits, so station dates drift by up to about 5 days for Mercury and 2 for Venus.
      </p>
    {/if}
    {#if standalone && onthemechange}
      <div class="row">
        <span class="seg" role="group" aria-label="Theme">
          <button class:on={theme === 'dark'} onclick={() => onthemechange('dark')}>Dark</button>
          <button class:on={theme === 'light'} onclick={() => onthemechange('light')}>Light</button>
        </span>
      </div>
    {/if}
  </section>
</aside>

<style>
  .elsewhere {
    max-width: 1220px; margin: 2px auto 0; padding: 0 24px;
    display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 12.5px; color: var(--dim);
  }
  .elsewhere a {
    color: var(--gold); border: 1px solid var(--gold-dim); border-radius: 14px;
    padding: 3px 12px; text-decoration: none;
  }
  .elsewhere a:hover { background: var(--bg2); }
  .rview {
    max-width: 1220px; margin: 0 auto; padding: 8px 24px 96px;
    display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start;
  }
  @media (max-width: 920px) {
    .rview { grid-template-columns: minmax(0, 1fr); padding-inline: 16px; padding-bottom: 130px; }
    .elsewhere { padding-inline: 16px; }
  }
  .stage { min-width: 0; display: grid; gap: 10px; }
  .plate { width: 100%; max-width: 780px; margin: 0 auto; aspect-ratio: 1 / 1; }
  .plate canvas { width: 100%; height: 100%; display: block; border-radius: 10px; }
  button {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px; cursor: pointer;
  }
  button:hover { border-color: var(--gold-dim); }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  button.on { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .seg { display: inline-flex; }
  .seg button { border-radius: 0; }
  .seg button:first-child { border-radius: 14px 0 0 14px; }
  .seg button:last-child { border-radius: 0 14px 14px 0; border-left: 0; }
  .num { font-variant-numeric: tabular-nums; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: var(--dim); max-width: 780px; margin: 0 auto; width: 100%; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend .scale { flex-basis: 100%; }
  .sw { display: inline-block; width: 18px; height: 3px; border-radius: 2px; }
  .stripbox { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 6px; min-width: 0; }
  .stripbox h2, .card h2, .drawer h2 { font-size: 15px; color: var(--gold); margin: 0; font-weight: 600; }
  .stripbox .sub { color: var(--dim); font-size: 12px; margin: 2px 0 6px; }
  .strip { width: 100%; height: 230px; display: block; border-radius: 6px; }
  .note { font-size: 12px; color: var(--dim); margin: 0; line-height: 1.5; }
  .note b { color: var(--ink); font-weight: 600; }
  .side { display: grid; gap: 12px; min-width: 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 9px; }
  .lab { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
  .date { font-size: 24px; color: var(--ink); letter-spacing: .02em; }
  .row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
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

  /* player: fixed to the bottom of the window so it is always in view */
  .player {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
    background: color-mix(in srgb, var(--panel) 92%, transparent); backdrop-filter: blur(6px);
    border-top: 1px solid var(--line);
    padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
  }
  .player .inner { max-width: 1220px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
  .player .play { min-width: 64px; font-weight: 600; }
  .speed { display: flex; align-items: center; gap: 8px; flex: 1 1 200px; min-width: 0; }
  .speed label { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
  .speed input { flex: 1; min-width: 70px; accent-color: var(--gold); }
  .speed .num { min-width: 5.5em; text-align: right; font-size: 12.5px; }
  .when { font-size: 13px; color: var(--ink); min-width: 7.5em; }
  .opts { margin-left: auto; color: var(--gold); border-color: var(--gold-dim); }

  /* options flyout */
  .scrim { position: fixed; inset: 0; z-index: 29; background: rgba(0, 0, 0, .35); border: 0; border-radius: 0; padding: 0; cursor: default; }
  .drawer {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 30; width: min(340px, 88vw);
    background: var(--panel); border-left: 1px solid var(--line); box-shadow: -8px 0 24px rgba(0, 0, 0, .3);
    padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 120px; overflow-y: auto;
    display: grid; align-content: start; gap: 16px;
    transform: translateX(105%); transition: transform .2s ease; visibility: hidden;
  }
  .drawer.open { transform: none; visibility: visible; }
  @media (prefers-reduced-motion: reduce) { .drawer { transition: none; } }
  .dhead { display: flex; justify-content: space-between; align-items: center; }
  .dhead button { padding: 3px 10px; }
  .drawer section { display: grid; gap: 8px; }
  .drawer h3 { margin: 0; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); font-weight: 600; }
  .drawer section > label { font-size: 13px; color: var(--c, var(--ink)); }
  .drawer section > label input { accent-color: var(--c, var(--gold)); }
  .group { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: grid; gap: 6px; }
  .group .gl { font-weight: 600; font-size: 13px; color: var(--ink); }
  .members { display: flex; flex-wrap: wrap; gap: 6px 14px; padding-left: 4px; font-size: 13px; }
  .q { width: 26px; height: 26px; padding: 0; border-radius: 50%; font-weight: 600; color: var(--gold); }
  .pop {
    margin: 0; background: var(--bg2); border: 1px solid var(--gold-dim); border-radius: 8px;
    padding: 8px 12px; font-size: 12px; line-height: 1.5; color: var(--dim);
  }
  .pop b { color: var(--ink); }
</style>
