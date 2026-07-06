<script lang="ts">
  import { onMount } from 'svelte';
  import { listCharts, type SavedChart } from '../store/db';

  let { excludeName, onpick, selectedId = null }: {
    excludeName?: string;
    onpick: (c: SavedChart) => void;
    /** Preselect (session keeps the partner across tab switches). */
    selectedId?: number | null;
  } = $props();

  let charts = $state<SavedChart[]>([]);
  let chosen = $state(selectedId !== null ? String(selectedId) : '');

  onMount(async () => {
    charts = await listCharts();
  });

  function pick() {
    const c = charts.find(x => String(x.id) === chosen);
    if (c) onpick($state.snapshot(c));
  }
</script>

<div class="pick">
  <label>
    Second chart
    <select bind:value={chosen} onchange={pick}>
      <option value="" disabled>choose a saved chart…</option>
      {#each charts.filter(c => c.name !== excludeName) as c (c.id)}
        <option value={String(c.id)}>{c.name} · {c.date} · {c.place.name}</option>
      {/each}
    </select>
  </label>
  {#if charts.length < 2}
    <span class="hint">Save at least two charts (header → Save chart) to compare.</span>
  {/if}
</div>

<style>
  .pick { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  label {
    display: flex; flex-direction: column; gap: 3px; font-size: 11px;
    color: var(--dim); text-transform: uppercase; letter-spacing: .08em;
  }
  select {
    background: var(--bg2); border: 1px solid var(--line); color: var(--ink);
    border-radius: 6px; padding: 6px 9px; font-size: 14px; min-width: 260px;
  }
  .hint { color: var(--dim); font-size: 12.5px; }
</style>
