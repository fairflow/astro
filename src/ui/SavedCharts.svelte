<script lang="ts">
  import { onMount } from 'svelte';
  import {
    deleteChart, listCharts, saveChart, type SavedChart,
  } from '../store/db';

  let { saveable, onload }: {
    saveable: Omit<SavedChart, 'id' | 'createdAt'> | null;
    onload: (c: SavedChart) => void;
  } = $props();

  let charts = $state<SavedChart[]>([]);
  let open = $state(false);

  async function refresh() {
    charts = await listCharts();
  }
  onMount(refresh);

  async function save() {
    if (!saveable) return;
    await saveChart(saveable);
    await refresh();
    open = true;
  }

  async function remove(id: number | undefined) {
    if (id === undefined) return;
    await deleteChart(id);
    await refresh();
  }
</script>

<div class="saved">
  <button class="primary" disabled={!saveable} onclick={save}>Save chart</button>
  <button onclick={() => open = !open}>Saved ({charts.length})</button>
  {#if open}
    <div class="menu">
      {#if charts.length === 0}
        <div class="none">Nothing saved yet. Cast a chart, then “Save chart”.</div>
      {/if}
      {#each charts as c (c.id)}
        <div class="item">
          <div class="who">
            <b>{c.name}</b>
            <span>{c.date} {c.time} · {c.place.name}, {c.place.country}</span>
          </div>
          <button onclick={() => { onload(c); open = false; }}>Load</button>
          <button aria-label="delete" onclick={() => remove(c.id)}>×</button>
        </div>
      {/each}
    </div>
  {/if}
</div>
