<script lang="ts">
  import { wheelGeometry } from '../render/wheel';
  import type { Chart } from '../chart/chart';
  import type { BodyKey } from '../ephemeris/types';
  import type { Selection } from './selection';

  let { chart, selection, onselect }: {
    chart: Chart;
    selection: Selection;
    onselect: (s: Selection) => void;
  } = $props();

  const geom = $derived(wheelGeometry(chart));

  function aspectDimmed(key: string, a: BodyKey, b: BodyKey): boolean {
    if (selection.kind === 'aspect') return key !== selection.key;
    if (selection.kind === 'body') return a !== selection.body && b !== selection.body;
    return false;
  }

  function planetDimmed(body: BodyKey): boolean {
    if (selection.kind === 'aspect') {
      const sel = geom.aspects.find(x => x.key === selection.key);
      return sel ? sel.aspect.a !== body && sel.aspect.b !== body : false;
    }
    return false;
  }
</script>

<svg viewBox={`0 0 ${geom.size} ${geom.size}`} role="img" aria-label="Natal chart wheel">
  <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter + 8} fill="var(--bg2)" stroke="var(--line)" />

  <!-- zodiac band -->
  {#each geom.signs as s}
    <line x1={s.from.x} y1={s.from.y} x2={s.to.x} y2={s.to.y} stroke="var(--line)" />
    <text x={s.pos.x} y={s.pos.y} text-anchor="middle" dominant-baseline="central"
      font-size="26" fill={`var(--${s.element})`}>{s.glyph}</text>
  {/each}
  <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter} fill="none" stroke="var(--line)" />
  {#each geom.ticks as t}
    <line x1={t.from.x} y1={t.from.y} x2={t.to.x} y2={t.to.y}
      stroke="var(--gold-dim)" stroke-width={t.major ? 1 : 0.5} opacity="0.7" />
  {/each}

  <!-- houses -->
  {#each geom.cusps as c}
    <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
      stroke={c.isAngle ? 'var(--gold)' : 'var(--line)'}
      stroke-width={c.isAngle ? 2 : 1} opacity={c.isAngle ? 0.9 : 0.8} />
    {#if c.label}
      <text x={c.label.pos.x} y={c.label.pos.y} text-anchor="middle"
        dominant-baseline="central" font-size="11" fill="var(--gold)">{c.label.text}</text>
    {/if}
    <text x={c.numPos.x} y={c.numPos.y} text-anchor="middle" dominant-baseline="central"
      font-size="12" fill="var(--dim)">{c.num}</text>
  {/each}
  <circle cx={geom.cx} cy={geom.cy} r={geom.rHub} fill="#10162a" stroke="var(--line)" />

  <!-- aspects -->
  {#each geom.aspects as a (a.key)}
    <g class="aspect-line" class:dimmed={aspectDimmed(a.key, a.aspect.a, a.aspect.b)}
      role="button" tabindex="0" aria-label={`${a.aspect.a} ${a.aspect.def.name} ${a.aspect.b}`}
      onclick={() => onselect({ kind: 'aspect', key: a.key })}
      onkeydown={e => e.key === 'Enter' && onselect({ kind: 'aspect', key: a.key })}>
      {#if a.partile}
        <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}
          stroke={`var(${a.colorVar})`} stroke-width="5" opacity="0.25" />
      {/if}
      <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}
        stroke={`var(${a.colorVar})`} stroke-width={a.width} opacity={a.opacity}
        stroke-dasharray={a.dashed ? '5 4' : undefined} />
      <line class="aspect-hit" x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} />
    </g>
  {/each}

  <!-- planets -->
  {#each geom.planets as p (p.body)}
    <line x1={p.anchorFrom.x} y1={p.anchorFrom.y} x2={p.anchorTo.x} y2={p.anchorTo.y}
      stroke="var(--dim)" stroke-width="1" />
    <line x1={p.anchorTo.x} y1={p.anchorTo.y} x2={p.leaderTo.x} y2={p.leaderTo.y}
      stroke="var(--line)" stroke-width="0.6" opacity="0.85" />
    <g class="planet" class:dimmed={planetDimmed(p.body)}
      role="button" tabindex="0" aria-label={p.body}
      onclick={() => onselect({ kind: 'body', body: p.body })}
      onkeydown={e => e.key === 'Enter' && onselect({ kind: 'body', body: p.body })}>
      <circle cx={p.pos.x} cy={p.pos.y} r="15" fill="var(--bg)"
        stroke={selection.kind === 'body' && selection.body === p.body ? 'var(--gold)' : 'var(--line)'} />
      <text x={p.pos.x} y={p.pos.y} text-anchor="middle" dominant-baseline="central"
        font-size={p.luminary ? 19 : 15} fill={p.luminary ? 'var(--gold)' : 'var(--ink)'}>{p.glyph}</text>
      {#if p.retro}
        <text x={p.pos.x + 11} y={p.pos.y - 9} text-anchor="middle" font-size="9"
          fill="var(--square)">℞</text>
      {/if}
      <text x={p.degPos.x} y={p.degPos.y} text-anchor="middle" dominant-baseline="central"
        font-size="9.5" fill="var(--dim)">{p.degText}</text>
    </g>
  {/each}

  <text x="14" y="16" class="serif" font-size="12" fill="var(--dim)">
    {chart.houses.polarFallback ? 'Porphyry (polar fallback)' : 'Placidus'} · Tropical
  </text>
</svg>
