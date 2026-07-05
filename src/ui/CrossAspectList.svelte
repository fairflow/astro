<script lang="ts">
  import { ASPECT_COLOR, BODY_NAME, fmtOrb } from '../render/glyphs';
  import Glyph from './Glyph.svelte';
  import type { CrossAspect } from '../chart/relate';

  let { items, aLabel, bLabel, selectedIndex, onselect }: {
    items: CrossAspect[];
    aLabel: string;
    bLabel: string;
    selectedIndex: number | null;
    onselect: (i: number) => void;
  } = $props();
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
    <span class="as">{a.applying ? 'a' : 's'}</span>
    <span class="orb">{fmtOrb(a.orb)}</span>
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
  .as { color: var(--dim); font-size: 11px; width: 12px; }
  .orb { margin-left: auto; color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
  .none { color: var(--dim); font-size: 13px; padding: 6px 8px; }
</style>
