<script lang="ts">
  import { ASPECT_COLOR, BODY_NAME, fmtOrb } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import type { CrossAspect } from '../chart/relate';
  import type { BodyKey } from '../ephemeris/types';

  let { items, aLabel, bLabel, selectedIndex, onselect, aHouse, bHouse }: {
    items: CrossAspect[];
    aLabel: string;
    bLabel: string;
    selectedIndex: number | null;
    onselect: (i: number) => void;
    /** House lookups per side; omit a side to hide its house. */
    aHouse?: (b: BodyKey) => number | undefined;
    bHouse?: (b: BodyKey) => number | undefined;
  } = $props();

  function houses(a: CrossAspect): string {
    const ha = aHouse?.(a.a);
    const hb = bHouse?.(a.b);
    if (ha && hb) return `H${ha}·H${hb}`;
    if (hb) return `H${hb}`;
    if (ha) return `H${ha}`;
    return '';
  }
</script>

{#if items.length === 0}
  <div class="none">No aspects in orb.</div>
{/if}
{#each items as a, i}
  <button class="row" class:sel={selectedIndex === i} onclick={() => onselect(i)}>
    <span class="g"><Glyph body={a.a} size={17} /></span>
    <span class="a"><Glyph aspect={a.def.name} size={15} color={`var(${ASPECT_COLOR[a.def.name]})`} /></span>
    <span class="g"><Glyph body={a.b} size={17} /></span>
    <span>{aLabel} {BODY_NAME[a.a]} – {bLabel} {BODY_NAME[a.b]}</span>
    <span class="right">
      {#if houses(a)}<span class="hn">{houses(a)}</span>{/if}
      <span class="as">{a.applying ? 'a' : 's'}</span>
      <span class="orb">{fmtOrb(a.orb)}</span>
    </span>
  </button>
{/each}

<style>
  .row {
    display: flex; align-items: center; gap: 8px; padding: 4px 8px;
    border-radius: 6px; cursor: pointer; font-size: 13.5px; width: 100%;
    background: none; border: none; color: var(--ink); text-align: left;
  }
  .row:hover { background: #1c2340; }
  .row.sel { background: #232b4d; outline: 1px solid var(--gold-dim); }
  .g { font-size: 16px; width: 20px; text-align: center; }
  .a { width: 22px; text-align: center; }
  .right { margin-left: auto; display: flex; align-items: center; gap: 7px; }
  .hn { color: var(--dim); font-size: 11px; font-variant-numeric: tabular-nums; }
  .as { color: var(--dim); font-size: 11px; width: 12px; }
  .orb { color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
  .none { color: var(--dim); font-size: 13px; padding: 6px 8px; }
</style>
