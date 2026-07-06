<script lang="ts">
  import { onMount } from 'svelte';
  import {
    deleteChart, listCharts, saveChart, updateChart, type SavedChart,
  } from '../store/db';

  let { saveable, onload, loadedId = null, onsaved }: {
    saveable: Omit<SavedChart, 'id' | 'createdAt'> | null;
    onload: (c: SavedChart) => void;
    loadedId?: number | null;
    onsaved?: (id: number) => void;
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
  const loaded = $derived(loadedId !== null
    ? charts.find(c => c.id === loadedId) ?? null : null);
  /** Loaded person's data differs from the form -> offer Update. */
  const dirty = $derived(saveable !== null && loaded !== null
    && !samePerson(saveable, loaded));

  async function save() {
    if (!saveable || alreadySaved) return;
    const id = await saveChart(saveable);
    await refresh();
    flash = `Saved “${saveable.name}”`;
    open = true;
    if (typeof id === 'number') onsaved?.(id);
    setTimeout(() => flash = '', 2500);
  }

  async function update() {
    if (!saveable || loadedId === null) return;
    await updateChart(loadedId, saveable);
    await refresh();
    flash = `Updated “${saveable.name}”`;
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

  // Backup & portability: charts as a JSON file the user controls.
  let fileInput = $state<HTMLInputElement | null>(null);

  function exportCharts() {
    const data = JSON.stringify(
      { app: 'astrodynamics', version: 1, charts: charts.map(({ id: _, ...c }) => c) },
      null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `astrodynamics-charts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.charts;
      if (!Array.isArray(list)) throw new Error('no charts array');
      let added = 0;
      let skipped = 0;
      for (const c of list) {
        if (!c || typeof c.name !== 'string' || typeof c.date !== 'string'
          || !c.place || typeof c.place.zone !== 'string') { skipped++; continue; }
        const cand = {
          name: c.name, date: c.date, time: c.time ?? '12:00',
          accuracy: c.accuracy ?? 'unknown', place: c.place, notes: c.notes,
        };
        if (charts.some(x => samePerson(cand, x))) { skipped++; continue; }
        await saveChart(cand);
        added++;
      }
      await refresh();
      flash = `Imported ${added} chart${added === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''}`;
    } catch {
      flash = 'Import failed — not an ASTRODYNAMICS charts file';
    }
    setTimeout(() => flash = '', 3500);
  }
</script>

<div class="saved">
  {#if dirty}
    <button class="primary" title={`Update “${loaded?.name}” in place with the current form data`}
      onclick={update}>Update</button>
    <button class="primary" title="Keep the original and save this as a new person"
      disabled={alreadySaved} onclick={save}>Save new</button>
  {:else}
    <button class="primary" disabled={!saveable || alreadySaved}
      title={alreadySaved ? 'This chart is already saved' : 'Save the current birth data (positions are recomputed on load)'}
      onclick={save}>
      {alreadySaved ? 'Saved ✓' : 'Save chart'}
    </button>
  {/if}
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
      <div class="tools">
        <button title="Download all saved charts as a JSON file — your backup, and the way to move charts to another browser or device"
          onclick={exportCharts} disabled={charts.length === 0}>Export…</button>
        <button title="Add charts from a previously exported file (duplicates are skipped)"
          onclick={() => fileInput?.click()}>Import…</button>
        <input type="file" accept="application/json,.json" bind:this={fileInput}
          onchange={importFile} style="display:none">
      </div>
      <div class="fine">Saving stores birth data only; the wheel is recomputed on
        load, so saved charts benefit from ephemeris improvements. Charts live in
        this browser's local database — Export makes a backup file you control.</div>
    </div>
  {/if}
</div>

<style>
  .flash {
    background: #1d3324; color: #7fdca4; border: 1px solid #2f5c3e;
    border-radius: 6px; padding: 4px 8px; font-size: 12.5px; margin-bottom: 6px;
  }
  .danger { color: #ff8b8b !important; border-color: #7a4a4a !important; }
  .tools { display: flex; gap: 6px; padding: 6px 4px 2px; }
  .tools button {
    background: none; border: 1px solid var(--gold-dim); color: var(--gold);
    border-radius: 10px; padding: 3px 12px; font-size: 12px;
  }
  .tools button:disabled { opacity: 0.4; cursor: not-allowed; }
  .fine { color: var(--dim); font-size: 11px; line-height: 1.4; padding: 6px 6px 2px; }
</style>
