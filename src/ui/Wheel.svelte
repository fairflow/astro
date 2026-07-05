<script lang="ts">
  import { wheelGeometry } from '../render/wheel';
  import { bodyGlyphId, signGlyphId } from '../render/glyphset';
  import { signIndex } from '../render/glyphs';
  import type { Chart } from '../chart/chart';
  import type { BodyKey } from '../ephemeris/types';
  import type { Selection } from './selection';
  import type { DisplaySettings } from './state';

  let { chart, selection, display, onselect, outer, outerColor = 'var(--transit)', crossAspects, crossSelected = null, oncross }: {
    chart: Chart;
    selection: Selection;
    display: DisplaySettings;
    onselect: (s: Selection) => void;
    /** Bi-wheel: outer-ring bodies (transits or partner chart). */
    outer?: import('../render/wheel').OuterBody[];
    outerColor?: string;
    crossAspects?: import('../render/wheel').CrossLike[];
    crossSelected?: number | null;
    oncross?: (i: number) => void;
  } = $props();

  const geom = $derived(wheelGeometry(chart, {
    glyphScale: display.glyphScale,
    opacityFloor: display.contrast ? 0.45 : 0.25,
    outer,
    crossAspects,
  }));

  function inSelectedSign(body: BodyKey): boolean {
    if (selection.kind !== 'sign') return false;
    const p = chart.positions.find(x => x.body === body);
    return p !== undefined && signIndex(p.lon) === selection.index;
  }

  function aspectDimmed(key: string, a: BodyKey, b: BodyKey): boolean {
    if (selection.kind === 'aspect') return key !== selection.key;
    if (selection.kind === 'body') return a !== selection.body && b !== selection.body;
    if (selection.kind === 'sign') return !inSelectedSign(a) && !inSelectedSign(b);
    return false;
  }

  function planetDimmed(body: BodyKey): boolean {
    if (crossSelected !== null && crossAspects) {
      const x = crossAspects[crossSelected];
      return x ? x.b !== body : false;
    }
    if (selection.kind === 'aspect') {
      const sel = geom.aspects.find(x => x.key === selection.key);
      return sel ? sel.aspect.a !== body && sel.aspect.b !== body : false;
    }
    if (selection.kind === 'sign') return !inSelectedSign(body);
    return false;
  }

  function crossDimmed(i: number): boolean {
    return crossSelected !== null && crossSelected !== i;
  }
</script>

<svg viewBox={`0 0 ${geom.size} ${geom.size}`} role="img" aria-label="Natal chart wheel">
  <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter + 8} fill="var(--bg2)" stroke="var(--line)" />

  <!-- zodiac band -->
  {#each geom.signs as s (s.index)}
    <line x1={s.from.x} y1={s.from.y} x2={s.to.x} y2={s.to.y} stroke="var(--line)" />
    <g class="signhit" role="button" tabindex="0" aria-label={`sign ${s.index}`}
      class:selsign={selection.kind === 'sign' && selection.index === s.index}
      onclick={() => onselect({ kind: 'sign', index: s.index })}
      onkeydown={e => e.key === 'Enter' && onselect({ kind: 'sign', index: s.index })}>
      <circle cx={s.pos.x} cy={s.pos.y} r={geom.signGlyphPx * 0.72} fill="transparent" />
      <use
        href={`#${signGlyphId(s.index)}`}
        x={s.pos.x - geom.signGlyphPx / 2} y={s.pos.y - geom.signGlyphPx / 2}
        width={geom.signGlyphPx} height={geom.signGlyphPx}
        color={`var(--${s.element})`}
      />
    </g>
  {/each}
  <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter} fill="none" stroke="var(--line)" />
  {#each geom.ticks as t}
    <line x1={t.from.x} y1={t.from.y} x2={t.to.x} y2={t.to.y}
      stroke="var(--gold-dim)" stroke-width={t.major ? 1 : 0.5} opacity="0.7" />
  {/each}

  <!-- houses -->
  {#each geom.houseBands as b}
    <path d={b.d} fill="var(--houseband, rgba(255,255,255,0.03))" stroke="none" />
  {/each}
  {#each geom.cusps as c}
    <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
      stroke={c.isAngle ? 'var(--gold)' : 'var(--line)'}
      stroke-width={c.isAngle ? 2 : 1} opacity={c.isAngle ? 0.9 : 0.8} />
    {#if c.label}
      <text x={c.label.pos.x} y={c.label.pos.y} text-anchor="middle"
        dominant-baseline="central" font-size={11 * display.textScale} fill="var(--gold)">{c.label.text}</text>
    {/if}
    <text x={c.degPos.x} y={c.degPos.y} text-anchor="middle" dominant-baseline="central"
      font-size={8.5 * display.textScale} fill="var(--dim)" opacity="0.85">{c.degText}</text>
    <text x={c.numPos.x} y={c.numPos.y} text-anchor="middle" dominant-baseline="central"
      font-size={14 * display.textScale} fill="var(--ink)" opacity="0.75">{c.num}</text>
  {/each}
  <circle cx={geom.cx} cy={geom.cy} r={geom.rHub} fill="var(--hub, #10162a)" stroke="var(--line)" />

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
      <circle cx={p.pos.x} cy={p.pos.y} r={geom.glyphPx / 2 + 5}
        fill="var(--bg)"
        stroke={selection.kind === 'body' && selection.body === p.body ? 'var(--gold)' : 'var(--line)'} />
      <use
        href={`#${bodyGlyphId(p.body)}`}
        x={p.pos.x - geom.glyphPx / 2} y={p.pos.y - geom.glyphPx / 2}
        width={geom.glyphPx} height={geom.glyphPx}
        color={p.luminary ? 'var(--gold)' : 'var(--ink)'}
      />
      {#if p.retro}
        <text x={p.pos.x + geom.glyphPx / 2 + 3} y={p.pos.y - geom.glyphPx / 2 + 2}
          text-anchor="middle" font-size={(9 + 2 * display.glyphScale) * display.textScale}
          fill="var(--square)">℞</text>
      {/if}
      <text x={p.degPos.x} y={p.degPos.y} text-anchor="middle" dominant-baseline="central"
        font-size={(8 + 2.5 * display.glyphScale) * display.textScale} fill="var(--dim)">{p.degText}</text>
    </g>
  {/each}

  <!-- bi-wheel: cross-aspect lines (outer -> natal) -->
  {#if geom.crossLines.length}
    {#each geom.crossLines as c (c.index)}
      <g class="aspect-line" class:dimmed={crossDimmed(c.index)}
        role="button" tabindex="0" aria-label={`cross aspect ${c.index}`}
        onclick={() => oncross?.(c.index)}
        onkeydown={e => e.key === 'Enter' && oncross?.(c.index)}>
        <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
          stroke={`var(${c.colorVar})`} stroke-width="1.3" opacity={c.opacity}
          stroke-dasharray="6 4" />
        <line class="aspect-hit" x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} />
      </g>
    {/each}
  {/if}

  <!-- bi-wheel: outer ring -->
  {#if geom.outer.length}
    <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter + 8} fill="none"
      stroke={outerColor} opacity="0.35" />
    {#each geom.outer as o (o.body)}
      <line x1={o.tickFrom.x} y1={o.tickFrom.y} x2={o.tickTo.x} y2={o.tickTo.y}
        stroke={outerColor} stroke-width="1.5" />
      <use
        href={`#${bodyGlyphId(o.body)}`}
        x={o.pos.x - geom.outerGlyphPx / 2} y={o.pos.y - geom.outerGlyphPx / 2}
        width={geom.outerGlyphPx} height={geom.outerGlyphPx}
        color={outerColor}
      />
      {#if o.retro}
        <text x={o.pos.x + geom.outerGlyphPx / 2 + 2} y={o.pos.y - geom.outerGlyphPx / 2 + 2}
          text-anchor="middle" font-size={8 + 2 * display.glyphScale} fill={outerColor}>℞</text>
      {/if}
    {/each}
  {/if}

  <text x="14" y="16" class="serif" font-size={12 * display.textScale} fill="var(--dim)">
    {chart.houses.polarFallback ? 'Porphyry (polar fallback)' : 'Placidus'} · Tropical{geom.outer.length ? ' · outer ring: second chart' : ''}
  </text>
</svg>
