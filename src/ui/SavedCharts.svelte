<script lang="ts">
  import { onMount } from 'svelte';
  import {
    DEFAULT_SET, deleteChart, listCharts, moveChart, onChartsChange, saveChart, setsOf,
    updateChart, type SavedChart,
  } from '../store/db';
  import { readings } from '../ai/readings.svelte';
  import { linkReadings } from '../ai/readinglinks';
  import type { SavedReading } from '../ai/readingstore';
  import { renderMarkdown } from '../ai/markdown';

  let { saveable, onload, loadedId = null, onsaved, onopenreading }: {
    saveable: Omit<SavedChart, 'id' | 'createdAt'> | null;
    onload: (c: SavedChart) => void;
    loadedId?: number | null;
    onsaved?: (id: number) => void;
    /** Show a saved reading in its tab, with its people's charts loaded. */
    onopenreading?: (r: SavedReading, people: SavedChart[]) => void;
  } = $props();

  let charts = $state<SavedChart[]>([]);
  let open = $state(false);
  let flash = $state('');
  let confirmDelete = $state<number | null>(null);
  // load view: search box + family filter
  let search = $state('');
  let family = $state('__all__');
  // save view: which set to file the person under
  let saveMode = $state(false);
  let saveSet = $state(DEFAULT_SET);
  let newSet = $state('');
  // move view: reassign an already-saved person to another family
  let moveId = $state<number | null>(null);
  let moveSet = $state(DEFAULT_SET);
  let moveNew = $state('');
  // Charts | Readings (astro-32t): readings filed under the people they are
  // about (name + birth date), with the same search and family filter
  let view = $state<'charts' | 'readings'>('charts');
  /** The reading shown in full, as "<chart id or 'none'>:<reading id>": a pair reading is listed twice. */
  let expanded = $state<string | null>(null);

  async function refresh() {
    charts = await listCharts();
  }
  // also when sync brings changes from another device
  onMount(() => { void refresh(); return onChartsChange(() => void refresh()); });

  const sets = $derived(setsOf(charts));
  // Search wins over the family filter: a query matches any fragment of the
  // name, date/time or place, across every family (SolarFire-style lookup).
  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return charts.filter(c => {
        const hay = `${c.name} ${c.date} ${c.time} ${c.place.name} ${c.place.country}`;
        return hay.toLowerCase().includes(q);
      });
    }
    if (family !== '__all__') {
      return charts.filter(c => (c.set || DEFAULT_SET) === family);
    }
    return charts;
  });

  const links = $derived(linkReadings(readings.saved, charts));
  const showing = $derived(readings.saved.length ? view : 'charts');
  const withReadings = $derived(filtered.filter(c => links.byChart.has(c)));
  // readings with no saved chart have no family, so they show under "All families"
  const unlinked = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (q) return links.unlinked.filter(r => `${r.title} ${r.question}`.toLowerCase().includes(q));
    return family === '__all__' ? links.unlinked : [];
  });
  const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const excerpt = (q: string) => (q.length > 90 ? `${q.slice(0, 90)}…` : q);

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

  /** Open the save panel and preselect a sensible target family. */
  function beginSave() {
    if (!saveable || alreadySaved) return;
    saveSet = family !== '__all__' ? family : (loaded?.set || sets[0] || DEFAULT_SET);
    newSet = '';
    saveMode = true;
    open = true;
  }

  async function confirmSave() {
    if (!saveable) return;
    const set = newSet.trim() || saveSet || DEFAULT_SET;
    const id = await saveChart({ ...saveable, set });
    await refresh();
    saveMode = false;
    newSet = '';
    family = set;               // reveal the family we just filed into
    flash = `Saved “${saveable.name}” to ${set}`;
    if (typeof id === 'number') onsaved?.(id);
    setTimeout(() => flash = '', 2500);
  }

  function beginMove(c: SavedChart) {
    moveId = c.id ?? null;
    moveSet = c.set || DEFAULT_SET;
    moveNew = '';
    saveMode = false;
  }

  async function confirmMove() {
    if (moveId === null) return;
    const set = moveNew.trim() || moveSet || DEFAULT_SET;
    const moved = charts.find(c => c.id === moveId);
    await moveChart(moveId, set);
    await refresh();
    moveId = null;
    moveNew = '';
    if (family !== '__all__' && !search.trim()) family = set;  // follow the person
    flash = `Moved “${moved?.name ?? ''}” to ${set}`;
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
          set: typeof c.set === 'string' ? c.set : DEFAULT_SET,
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
      disabled={alreadySaved} onclick={beginSave}>Save new</button>
  {:else}
    <button class="primary" disabled={!saveable || alreadySaved}
      title={alreadySaved ? 'This chart is already saved' : 'Save the current birth data into a family (positions are recomputed on load)'}
      onclick={beginSave}>
      {alreadySaved ? 'Saved ✓' : 'Save chart'}
    </button>
  {/if}
  <button onclick={() => { open = !open; confirmDelete = null; saveMode = false; }}
    title="Show saved charts">Saved ({charts.length})</button>
  {#if open}
    <div class="menu">
      {#if flash}<div class="flash">{flash}</div>{/if}

      {#if saveMode && saveable}
        <div class="savebox">
          <div class="savehead">Save “{saveable.name}” to family</div>
          <select bind:value={saveSet} aria-label="Choose family">
            {#each sets as s (s)}<option value={s}>{s}</option>{/each}
            {#if !sets.includes(DEFAULT_SET)}<option value={DEFAULT_SET}>{DEFAULT_SET}</option>{/if}
          </select>
          <input type="text" placeholder="…or type a new family" bind:value={newSet}
            aria-label="New family name">
          <div class="saveactions">
            <button class="go" onclick={confirmSave}>Save</button>
            <button onclick={() => saveMode = false}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if moveId !== null}
        {@const mc = charts.find(c => c.id === moveId)}
        <div class="savebox">
          <div class="savehead">Move “{mc?.name ?? ''}” to family</div>
          <select bind:value={moveSet} aria-label="Choose family">
            {#each sets as s (s)}<option value={s}>{s}</option>{/each}
            {#if !sets.includes(DEFAULT_SET)}<option value={DEFAULT_SET}>{DEFAULT_SET}</option>{/if}
          </select>
          <input type="text" placeholder="…or type a new family" bind:value={moveNew}
            aria-label="New family name">
          <div class="saveactions">
            <button class="go" onclick={confirmMove}>Move</button>
            <button onclick={() => moveId = null}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if readings.saved.length}
        <div class="viewsw" role="group" aria-label="Show saved charts or saved readings">
          <button class:on={showing === 'charts'} onclick={() => view = 'charts'}>Charts ({charts.length})</button>
          <button class:on={showing === 'readings'} onclick={() => view = 'readings'}>Readings ({readings.saved.length})</button>
        </div>
      {/if}

      {#if charts.length === 0}
        {#if showing === 'charts'}<div class="none">Nothing saved yet. Cast a chart, then “Save chart”.</div>{/if}
      {:else}
        <div class="find">
          <input type="search" class="search" placeholder="🔍 search name, date or place"
            bind:value={search} aria-label="Search saved charts">
          {#if !search.trim()}
            <select bind:value={family} aria-label="Filter by family" class="famsel">
              <option value="__all__">All families ({charts.length})</option>
              {#each sets as s (s)}
                <option value={s}>{s} ({charts.filter(c => (c.set || DEFAULT_SET) === s).length})</option>
              {/each}
            </select>
          {/if}
        </div>
        {#if filtered.length === 0 && showing === 'charts'}
          <div class="none">No matches.</div>
        {/if}
      {/if}

      {#if showing === 'readings'}
        {#each withReadings as c (c.id)}
          <div class="rhead"><b>{c.name}</b> <span>{c.date} · {c.set || DEFAULT_SET}</span></div>
          {#each links.byChart.get(c) ?? [] as r (r.id)}{@render reading(r, links.charts.get(r.id), `${c.id}:${r.id}`)}{/each}
        {/each}
        {#if unlinked.length}
          <div class="rhead"><b>Not linked</b> <span>no saved chart for its people</span></div>
          {#each unlinked as r (r.id)}{@render reading(r, undefined, `none:${r.id}`)}{/each}
        {/if}
        {#if !withReadings.length && !unlinked.length}
          <div class="none">{search.trim() ? 'No matches.' : 'No readings for this family yet.'}</div>
        {/if}
      {/if}

      {#snippet reading(r: SavedReading, people: SavedChart[] | undefined, at: string)}
        <div class="ritem">
          <button class="rpick" aria-expanded={expanded === at} title="Show or hide the reading"
            onclick={() => expanded = expanded === at ? null : at}>
            <span class="when">{day(r.createdAt)}</span>
            <span class="ttl">{r.title}</span>
            <span class="q">{excerpt(r.question)}</span>
          </button>
          {#if people && onopenreading}
            <button title="Load the chart in its tab and show this reading in Ask Claude"
              onclick={() => { onopenreading(r, people); open = false; }}>Open</button>
          {/if}
        </div>
        {#if expanded === at}
          <!-- renderMarkdown escapes everything and emits only a fixed tag set (src/ai/markdown.ts) -->
          <div class="rtext">{@html renderMarkdown(r.text)}</div>
        {/if}
      {/snippet}

      {#each showing === 'charts' ? filtered : [] as c (c.id)}
        <div class="item">
          <div class="who">
            <b>{c.name}</b>
            <span>{c.date} {c.time} · {c.place.name}, {c.place.country}</span>
            <button class="settag" title="Change this person's family"
              onclick={() => beginMove(c)}>{c.set || DEFAULT_SET} ▾</button>
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
        load, so saved charts benefit from ephemeris improvements. Charts are kept
        in this browser, and in your account while you are signed in (Settings,
        Account); Export makes a backup file you control.</div>
    </div>
  {/if}
</div>

<style>
  .flash {
    background: #1d3324; color: #7fdca4; border: 1px solid #2f5c3e;
    border-radius: 6px; padding: 4px 8px; font-size: 12.5px; margin-bottom: 6px;
  }
  .danger { color: #ff8b8b !important; border-color: #7a4a4a !important; }
  .savebox {
    border: 1px solid var(--gold-dim); border-radius: 8px; padding: 8px 10px;
    margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;
  }
  .savehead { font-size: 12.5px; color: var(--gold); }
  .savebox select, .savebox input, .find select, .find input {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; padding: 5px 8px; font-size: 12.5px; width: 100%;
  }
  .saveactions { display: flex; gap: 6px; }
  .saveactions .go { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .saveactions button, .savebox { box-sizing: border-box; }
  .saveactions button {
    border: 1px solid var(--line); background: var(--bg2); color: var(--ink);
    border-radius: 8px; padding: 4px 14px; font-size: 12.5px;
  }
  .find { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
  .tools { display: flex; gap: 6px; padding: 6px 4px 2px; }
  .tools button {
    background: none; border: 1px solid var(--gold-dim); color: var(--gold);
    border-radius: 10px; padding: 3px 12px; font-size: 12px;
  }
  .tools button:disabled { opacity: 0.4; cursor: not-allowed; }
  .viewsw { display: flex; gap: 0; margin-bottom: 8px; }
  .viewsw button {
    flex: 1; background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    padding: 4px 8px; font-size: 12.5px;
  }
  .viewsw button:first-child { border-radius: 8px 0 0 8px; }
  .viewsw button:last-child { border-radius: 0 8px 8px 0; border-left: none; }
  .viewsw button.on { color: var(--gold); border-color: var(--gold-dim); }
  .rhead { display: flex; gap: 8px; align-items: baseline; padding: 8px 4px 2px; font-size: 13px; }
  .rhead span { color: var(--dim); font-size: 11.5px; }
  .ritem { display: flex; gap: 6px; align-items: flex-start; padding: 2px 0 2px 10px; }
  .rpick {
    flex: 1; min-width: 0; text-align: left; background: none; border: none; color: var(--ink);
    padding: 3px 4px; display: flex; flex-direction: column; gap: 1px; cursor: pointer;
  }
  .rpick .when { color: var(--dim); font-size: 11px; }
  .rpick .ttl { font-size: 12.5px; }
  .rpick .q { color: var(--dim); font-size: 11.5px; overflow-wrap: anywhere; }
  .rtext {
    margin: 2px 0 8px 14px; padding: 6px 10px; border-left: 2px solid var(--gold-dim);
    font-size: 12.5px; line-height: 1.45; max-height: 320px; overflow: auto;
  }
  .fine { color: var(--dim); font-size: 11px; line-height: 1.4; padding: 6px 6px 2px; }
</style>
