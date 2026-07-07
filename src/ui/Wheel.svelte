<script lang="ts">
  import { distToSegment, wheelGeometry, type XY } from '../render/wheel';
  import { bodyGlyphId, signGlyphId } from '../render/glyphset';
  import { BODY_NAME, fmtOrb, signIndex } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import type { AspectName } from '../chart/aspects';
  import type { Chart } from '../chart/chart';
  import type { BodyKey } from '../ephemeris/types';
  import type { Selection } from './selection';
  import type { DisplaySettings } from './state';

  let { chart, selection, display, onselect, outer, outerColor = 'var(--transit)', crossAspects, crossSelected = null, oncross, outerSelected = null, onouter }: {
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
    /** Selected outer-ring body: its cross aspects stay lit. */
    outerSelected?: BodyKey | null;
    onouter?: (b: BodyKey) => void;
  } = $props();

  const FLOOR = { low: 0.25, medium: 0.45, high: 0.62 };
  const FLOOR_LIGHT = { low: 0.35, medium: 0.55, high: 0.72 };

  const geom = $derived(wheelGeometry(chart, {
    glyphScale: display.glyphScale,
    opacityFloor: (display.theme === 'light' ? FLOOR_LIGHT : FLOOR)[display.contrast],
    outer,
    crossAspects,
  }));

  function inSelectedSign(body: BodyKey): boolean {
    if (selection.kind !== 'sign') return false;
    const p = chart.positions.find(x => x.body === body);
    return p !== undefined && signIndex(p.lon) === selection.index;
  }

  function inSelectedHouse(body: BodyKey): boolean {
    if (selection.kind !== 'house') return false;
    const p = chart.positions.find(x => x.body === body);
    return p !== undefined && p.house === selection.num;
  }

  function aspectDimmed(key: string, a: BodyKey, b: BodyKey): boolean {
    if (selection.kind === 'aspect') return key !== selection.key;
    if (selection.kind === 'body') return a !== selection.body && b !== selection.body;
    if (selection.kind === 'sign') return !inSelectedSign(a) && !inSelectedSign(b);
    if (selection.kind === 'house') return !inSelectedHouse(a) && !inSelectedHouse(b);
    return false;
  }

  function planetDimmed(body: BodyKey): boolean {
    if (crossSelected !== null && crossAspects) {
      const x = crossAspects[crossSelected];
      return x ? x.b !== body : false;
    }
    if (outerSelected !== null && crossAspects) {
      return !crossAspects.some(x => x.a === outerSelected && x.b === body);
    }
    if (selection.kind === 'aspect') {
      const sel = geom.aspects.find(x => x.key === selection.key);
      return sel ? sel.aspect.a !== body && sel.aspect.b !== body : false;
    }
    if (selection.kind === 'sign') return !inSelectedSign(body);
    if (selection.kind === 'house') return !inSelectedHouse(body);
    return false;
  }

  function crossDimmed(i: number): boolean {
    if (crossSelected !== null) return crossSelected !== i;
    const x = crossAspects?.[i];
    if (!x) return false;
    if (outerSelected !== null) return x.a !== outerSelected;
    if (selection.kind === 'body') return x.b !== selection.body;
    if (selection.kind === 'house') return !inSelectedHouse(x.b);
    if (selection.kind === 'sign') return !inSelectedSign(x.b);
    return false;
  }

  function outerDimmed(body: BodyKey): boolean {
    return outerSelected !== null && outerSelected !== body;
  }

  /** The selected planet's aspects get widened hit areas (esp. conjunctions). */
  function aspectFocused(a: BodyKey, b: BodyKey): boolean {
    return selection.kind === 'body' && (a === selection.body || b === selection.body);
  }

  // ---- click-disambiguation chooser (UX option A) ----------------------
  // A click near several overlapping lines (conjunctions especially — a
  // near-zero-length chord under every other line of the same bodies)
  // pops a small menu instead of guessing.
  interface ChooserItem {
    kind: 'aspect' | 'cross';
    key?: string;
    index?: number;
    a: BodyKey; b: BodyKey; name: AspectName; orb: number;
  }
  let chooser = $state<{ x: number; y: number; items: ChooserItem[] } | null>(null);
  let svgEl: SVGSVGElement | undefined = $state();

  function toSvgPoint(e: MouseEvent): XY | null {
    const ctm = svgEl?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function candidatesAt(p: XY): ChooserItem[] {
    const T = 12 * (geom.size / 720);
    const items: ChooserItem[] = [];
    for (const a of geom.aspects) {
      if (distToSegment(p, a.from, a.to) <= T) {
        items.push({
          kind: 'aspect', key: a.key,
          a: a.aspect.a, b: a.aspect.b, name: a.aspect.def.name, orb: a.aspect.orb,
        });
      }
    }
    for (const c of geom.crossLines) {
      const x = crossAspects?.[c.index];
      if (x && distToSegment(p, c.from, c.to) <= T) {
        items.push({ kind: 'cross', index: c.index, a: x.a, b: x.b, name: x.def.name, orb: x.orb });
      }
    }
    return items;
  }

  function pickAspect(e: MouseEvent, primary: ChooserItem) {
    e.stopPropagation();
    const p = toSvgPoint(e);
    const items = p ? candidatesAt(p) : [];
    if (items.length > 1) {
      chooser = { x: e.clientX, y: e.clientY, items };
      return;
    }
    chooser = null;
    choose(primary);
  }

  function choose(item: ChooserItem) {
    chooser = null;
    if (item.kind === 'aspect' && item.key) onselect({ kind: 'aspect', key: item.key });
    else if (item.kind === 'cross' && item.index !== undefined) oncross?.(item.index);
  }
</script>

<svelte:window
  onclick={() => { if (chooser) chooser = null; }}
  onkeydown={e => { if (e.key === 'Escape' && chooser) chooser = null; }} />

<svg bind:this={svgEl} viewBox={`0 0 ${geom.size} ${geom.size}`} role="img" aria-label="Natal chart wheel">
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
    <path d={b.d} fill="var(--houseband, rgba(255,255,255,0.045))" stroke="none" />
  {/each}
  {#each geom.cusps as c}
    <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
      stroke={c.isAngle ? 'var(--gold)' : 'var(--gold-dim)'}
      stroke-width={c.isAngle ? 2.2 : 1.3} opacity={c.isAngle ? 0.95 : 0.8} />
    {#if c.label}
      <text x={c.label.pos.x} y={c.label.pos.y} text-anchor="middle"
        dominant-baseline="central" font-size={11 * display.textScale} fill="var(--gold)">{c.label.text}</text>
    {/if}
    <text x={c.degPos.x} y={c.degPos.y} text-anchor="middle" dominant-baseline="central"
      font-size={10.5 * display.textScale} fill="var(--ink)" opacity="0.9">{c.degText}</text>
  {/each}
  <circle cx={geom.cx} cy={geom.cy} r={geom.rHub} fill="var(--hub, #10162a)" stroke="var(--line)" />

  <!-- aspects -->
  {#each geom.aspects as a (a.key)}
    {@const item = { kind: 'aspect', key: a.key, a: a.aspect.a, b: a.aspect.b, name: a.aspect.def.name, orb: a.aspect.orb } as const}
    <g class="aspect-line" class:dimmed={aspectDimmed(a.key, a.aspect.a, a.aspect.b)}
      role="button" tabindex="0" aria-label={`${a.aspect.a} ${a.aspect.def.name} ${a.aspect.b}`}
      onclick={e => pickAspect(e, item)}
      onkeydown={e => e.key === 'Enter' && choose(item)}>
      {#if a.partile}
        <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}
          stroke={`var(${a.colorVar})`} stroke-width="5" opacity="0.25" />
      {/if}
      <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y}
        stroke={`var(${a.colorVar})`} stroke-width={a.width} opacity={a.opacity}
        stroke-dasharray={a.dashed ? '5 4' : undefined} />
      {#if a.aspect.def.name === 'conjunction'}
        <!-- a conjunction's chord is near zero-length: mark it with a dot
             and give it a round hit disc so it can actually be tapped -->
        <circle cx={(a.from.x + a.to.x) / 2} cy={(a.from.y + a.to.y) / 2}
          r="5" fill={`var(${a.colorVar})`} opacity={a.opacity} />
        <circle class="aspect-hit-dot" cx={(a.from.x + a.to.x) / 2}
          cy={(a.from.y + a.to.y) / 2} r="14" fill="transparent" />
      {/if}
      <line class="aspect-hit" class:big={aspectFocused(a.aspect.a, a.aspect.b)}
        x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} />
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
      {@const x = crossAspects?.[c.index]}
      {@const citem = x ? { kind: 'cross', index: c.index, a: x.a, b: x.b, name: x.def.name, orb: x.orb } as const : null}
      <g class="aspect-line" class:dimmed={crossDimmed(c.index)}
        role="button" tabindex="0" aria-label={`cross aspect ${c.index}`}
        onclick={e => citem ? pickAspect(e, citem) : oncross?.(c.index)}
        onkeydown={e => e.key === 'Enter' && oncross?.(c.index)}>
        <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y}
          stroke={`var(${c.colorVar})`} stroke-width="1.3" opacity={c.opacity}
          stroke-dasharray="6 4" />
        <line class="aspect-hit" x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} />
      </g>
    {/each}
  {/if}

  <!-- bi-wheel: outer ring (glyphs clickable: light up that body's cross aspects) -->
  {#if geom.outer.length}
    <circle cx={geom.cx} cy={geom.cy} r={geom.rZodiacOuter + 8} fill="none"
      stroke={outerColor} opacity="0.35" />
    {#each geom.outer as o (o.body)}
      <line x1={o.tickFrom.x} y1={o.tickFrom.y} x2={o.tickTo.x} y2={o.tickTo.y}
        stroke={outerColor} stroke-width="1.5" />
      <g class="outerhit" class:dimmed={outerDimmed(o.body)}
        class:selouter={outerSelected === o.body}
        role="button" tabindex="0" aria-label={`outer ${o.body}`}
        onclick={() => onouter?.(o.body)}
        onkeydown={e => e.key === 'Enter' && onouter?.(o.body)}>
        <circle cx={o.pos.x} cy={o.pos.y} r={geom.outerGlyphPx * 0.72} fill="transparent" />
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
      </g>
    {/each}
  {/if}

  <!-- house numerals paint LAST so their discs are clickable above the
       aspect lines radiating through an inhabited house -->
  {#each geom.cusps as c}
    <g class="househit" role="button" tabindex="0" aria-label={`house ${c.num}`}
      class:selhouse={selection.kind === 'house' && selection.num === c.num}
      onclick={() => onselect({ kind: 'house', num: c.num })}
      onkeydown={e => e.key === 'Enter' && onselect({ kind: 'house', num: c.num })}>
      <circle cx={c.numPos.x} cy={c.numPos.y} r={11 * Math.min(display.textScale, 1.3)}
        fill="var(--bg2)" stroke="var(--gold-dim)" stroke-width="1" opacity="0.92" />
      <text x={c.numPos.x} y={c.numPos.y} text-anchor="middle" dominant-baseline="central"
        font-size={14.5 * display.textScale} fill="var(--gold)" opacity="0.95">{c.num}</text>
    </g>
  {/each}

  <text x="14" y="16" class="serif" font-size={12 * display.textScale} fill="var(--dim)">
    {chart.houses.polarFallback ? 'Porphyry (polar fallback)' : 'Placidus'} · Tropical{geom.outer.length ? ' · outer ring: second chart' : ''}
  </text>
</svg>

{#if chooser}
  <div class="wheelchooser" role="menu"
    style={`left:${Math.min(chooser.x, window.innerWidth - 330)}px; top:${Math.min(chooser.y + 6, window.innerHeight - 40 * chooser.items.length - 40)}px`}>
    <div class="title">Several lines here — which one?</div>
    {#each chooser.items as item}
      <button role="menuitem" onclick={e => { e.stopPropagation(); choose(item); }}>
        <Glyph body={item.a} size={15} />
        <Glyph aspect={item.name} size={13} />
        <Glyph body={item.b} size={15} />
        {BODY_NAME[item.a]} {item.name} {BODY_NAME[item.b]}{item.kind === 'cross' ? ' (outer)' : ''}
        <span class="orb">{fmtOrb(item.orb)}</span>
      </button>
    {/each}
  </div>
{/if}
