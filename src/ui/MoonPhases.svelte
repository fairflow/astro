<script lang="ts">
  import { litPath, moonPhaseAt, PHASES } from '../chart/moonphase';
  import { paletteFor } from '../render/orrery';

  /**
   * The Moon's phases (astro-ht7, restyled for astro-0qk): the Earth seen from
   * above the north pole with sunlight from the right, the Moon's orbit (not to
   * scale) with eight Moons on it, each lit on its sunward half, and outside
   * each how it looks from Earth, named. The Moon of the date shown is marked.
   * A box like the strip chart's, closed until opened (remembered); the dates
   * and eclipses are in the Moon card beside the orrery.
   */
  let { jd, theme = 'dark' }: { jd: number; theme?: 'dark' | 'light' } = $props();

  // the orrery's own Moon colours; text and lines from the app's theme
  const pal = $derived(paletteFor(theme));

  const OPEN_KEY = 'astro-moon-phases-open';
  let open = $state((() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } })());
  $effect(() => { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* private mode */ } });

  let south = $state(false);   // the view from the southern hemisphere is mirrored left to right

  const W = 900, H = 670, cx = 400, cy = 310;
  const R = 150;               // the orbit
  const RV = 226;              // the views from Earth
  const RL = 268;              // their names
  const rm = 15, rv = 23;
  const at = (e: number, r: number) => ({ x: cx + r * Math.cos((e * Math.PI) / 180), y: cy - r * Math.sin((e * Math.PI) / 180) });
  const anchor = (e: number) => (Math.abs(Math.cos((e * Math.PI) / 180)) < 0.3 ? 'middle' : Math.cos((e * Math.PI) / 180) > 0 ? 'start' : 'end');
  /** The Moon's sunward half, as it is on the orbit (the Sun is to the right). */
  const sunwardHalf = (r: number) => `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`;

  const now = $derived(open ? moonPhaseAt(jd) : null);
</script>

<details class="moonbox" bind:open>
  <summary><h2>The Moon's phases</h2>{#if now}<span class="sub">{now.name}, {Math.round(now.lit * 100)}% lit</span>{/if}</summary>
  {#if now}
    <p class="sub">The Moon's orbit seen from above the Earth's north pole, sunlight from the right; not to scale.</p>
    <div class="moonrow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`The Moon's eight phases round its orbit; on the date shown it is ${now.name.toLowerCase()}, ${Math.round(now.lit * 100)}% lit.`}>
        <defs>
          <marker id="moonarrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--gold)" />
          </marker>
          <marker id="orbitarrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--dim)" />
          </marker>
        </defs>

        <!-- sunlight from the right -->
        {#each [-140, -70, 0, 70, 140] as dy}
          <line x1={W - 8} y1={cy + dy} x2={W - 62} y2={cy + dy} style="stroke: var(--gold)" stroke-width="2.4" marker-end="url(#moonarrow)" />
        {/each}
        <text x={W - 4} y={cy - 172} text-anchor="end" class="t gold" font-size="22">Sunlight</text>

        <!-- the orbit, anticlockwise -->
        <circle {cx} {cy} r={R} fill="none" class="orbit" stroke-width="1.6" stroke-dasharray="5 6" />
        {#each [22.5, 202.5] as e}
          {@const a = at(e, R)}
          {@const b = at(e + 4, R)}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="orbit" stroke-width="1.6" marker-end="url(#orbitarrow)" />
        {/each}

        <!-- the Earth: day side to the Sun -->
        <g transform={`translate(${cx} ${cy})`}>
          <circle r="28" fill={pal.earth} />
          <!-- night side: a shadow in either theme (the light palette's 'night' is paper) -->
          <path d="M 0 -28 A 28 28 0 0 0 0 28 Z" fill="#000" opacity="0.38" />
          <circle r="28" fill="none" stroke={pal.muted} stroke-width="1" />
        </g>
        <text x={cx} y={cy + 52} text-anchor="middle" class="t" font-size="20">Earth</text>

        <!-- eight Moons on the orbit, and how each looks from Earth -->
        {#each PHASES as ph}
          {@const m = at(ph.elong, R)}
          {@const v = at(ph.elong, RV)}
          {@const l = at(ph.elong, RL)}
          {@const lit = litPath(ph.elong, rv)}
          <line x1={at(ph.elong, R + rm + 3).x} y1={at(ph.elong, R + rm + 3).y} x2={at(ph.elong, RV - rv - 4).x} y2={at(ph.elong, RV - rv - 4).y}
            class="orbit" stroke-width="1" opacity="0.6" />
          <g transform={`translate(${m.x} ${m.y})`}>
            <circle r={rm} fill={pal.moonDark} stroke={pal.muted} stroke-width="1" />
            <path d={sunwardHalf(rm)} fill={pal.moonLit} />
          </g>
          <g transform={`translate(${v.x} ${v.y}) scale(${south ? -1 : 1} 1)`}>
            <circle r={rv} fill={pal.moonDark} />
            {#if lit}<path d={lit} fill={pal.moonLit} />{/if}
            <circle r={rv} fill="none" stroke={pal.muted} stroke-width="1.2" />
          </g>
          <text x={l.x} y={l.y + 7} text-anchor={anchor(ph.elong)} class="t" font-size="22">{ph.name}</text>
        {/each}

        <!-- the Moon of the date shown -->
        {#each [at(now.elong, R)] as m}
          <line x1={cx} y1={cy} x2={m.x} y2={m.y} style="stroke: var(--gold)" stroke-width="1.4" stroke-dasharray="3 4" />
          <g transform={`translate(${m.x} ${m.y})`}>
            <circle r={rm} fill={pal.moonDark} stroke={pal.muted} stroke-width="1" />
            <path d={sunwardHalf(rm)} fill={pal.moonLit} />
            <circle r={rm + 7} fill="none" style="stroke: var(--gold)" stroke-width="3" />
          </g>
          <text x={m.x} y={m.y - rm - 15} text-anchor="middle" class="t gold" font-size="20" font-weight="700">Now</text>
        {/each}

        <text x="6" y={H - 34} class="t dim" font-size="18">Inner ring: the Moon on its orbit, its sunward half always lit.</text>
        <text x="6" y={H - 8} class="t dim" font-size="18">Outer ring: how it looks from Earth{south ? ' (southern hemisphere: mirrored)' : ' (northern hemisphere)'}.</text>
      </svg>

      <div class="facts">
        <svg class="bigmoon" viewBox="-62 -62 124 124" role="img" aria-label={`The Moon as seen from Earth: ${now.name}`}>
          <g transform={`scale(${south ? -1 : 1} 1)`}>
            <circle r="56" fill={pal.moonDark} />
            {#if litPath(now.elong, 56)}<path d={litPath(now.elong, 56)} fill={pal.moonLit} />{/if}
            <circle r="56" fill="none" stroke={pal.muted} stroke-width="1.5" />
          </g>
        </svg>
        <div class="name">{now.name}</div>
        <div class="dim">{Math.round(now.lit * 100)}% lit · day {now.age.toFixed(1)}</div>
        <label class="south"><input type="checkbox" bind:checked={south}> Southern hemisphere view</label>
      </div>
    </div>
  {/if}
</details>

<style>
  /* the strip chart's box */
  .moonbox { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 10px 8px; min-width: 0; }
  summary { cursor: pointer; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  summary::marker, summary::-webkit-details-marker { color: var(--gold); }
  summary h2 { font-size: 15px; color: var(--gold); margin: 0; font-weight: 600; display: inline; }
  .sub { color: var(--dim); font-size: 12px; margin: 2px 0 6px; }
  .moonrow { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .moonrow > svg { flex: 1 1 380px; min-width: 0; max-width: 600px; height: auto; }
  .t { fill: var(--ink); }
  .t.dim { fill: var(--dim); }
  .t.gold { fill: var(--gold); }
  .orbit { stroke: var(--dim); opacity: .7; }
  .facts { flex: 0 1 150px; min-width: 130px; text-align: center; font-size: 12.5px; color: var(--ink); display: grid; gap: 4px; justify-items: center; }
  .bigmoon { width: 96px; height: 96px; }
  .name { font-size: 14px; font-weight: 600; color: var(--gold); }
  .dim { color: var(--dim); }
  .south { display: inline-flex; gap: 5px; align-items: center; color: var(--dim); font-size: 12px; margin-top: 4px; }
</style>
