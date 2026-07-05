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
  let flash = $state('');
  let confirmDelete = $state<number | null>(null);

  async function refresh() {
    charts = await listCharts();
  }
  onMount(refresh);

  function samePerson(a: Omit<SavedChart, 'id' | 'createdAt'>, b: SavedChart): boolean {
    return a.name === b.name && a.date === b.date && a.time === b.time
      && a.place.name === b.place.name && a.place.country === b.place.country;
  }

  const alreadySaved = $derived(
    saveable !== null && charts.some(c => samePerson(saveable, c)));

  async function save() {
    if (!saveable || alreadySaved) return;
    await saveChart(saveable);
    await refresh();
    flash = `Saved “${saveable.name}”`;
    open = true;
    setTimeout(() => flash = '', 2500);
  }

  async function remove(id: number | undefined) {
    if (id === undefined) return;
    if (confirmDelete !== id) {
      confirmDelete = id;
      return;
    }
    await deleteChart(id);
    confirmDelete = null;
    await refresh();
  }
</script>

<div class="saved">
  <button class="primary" disabled={!saveable || alreadySaved}
    title={alreadySaved ? 'This chart is already saved' : 'Save the current birth data (positions are recomputed on load)'}
    onclick={save}>
    {alreadySaved ? 'Saved ✓' : 'Save chart'}
  </button>
  <button onclick={() => { open = !open; confirmDelete = null; }}
    title="Show saved charts">Saved ({charts.length})</button>
  {#if open}
    <div class="menu">
      {#if flash}<div class="flash">{flash}</div>{/if}
      {#if charts.length === 0}
        <div class="none">Nothing saved yet. Cast a chart, then “Save chart”.</div>
      {/if}
      {#each charts as c (c.id)}
        <div class="item">
          <div class="who">
            <b>{c.name}</b>
            <span>{c.date} {c.time} · {c.place.name}, {c.place.country}</span>
          </div>
          <button title="Load this chart into the form and cast it"
            onclick={() => { onload(c); open = false; }}>Load</button>
          {#if confirmDelete === c.id}
            <button class="danger" title="Permanently delete this saved chart"
              onclick={() => remove(c.id)}>Delete?</button>
          {:else}
            <button title="Delete this saved chart (asks to confirm)"
              onclick={() => remove(c.id)}>Delete</button>
          {/if}
        </div>
      {/each}
      <div class="fine">Saving stores birth data only; the wheel is recomputed on
        load, so saved charts benefit from ephemeris improvements. Display
        settings save automatically and separately.</div>
    </div>
  {/if}
</div>

<style>
  .flash {
    background: #1d3324; color: #7fdca4; border: 1px solid #2f5c3e;
    border-radius: 6px; padding: 4px 8px; font-size: 12.5px; margin-bottom: 6px;
  }
  .danger { color: #ff8b8b !important; border-color: #7a4a4a !important; }
  .fine { color: var(--dim); font-size: 11px; line-height: 1.4; padding: 6px 6px 2px; }
</style>
