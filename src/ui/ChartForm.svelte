<script lang="ts">
  import {
    fold, loadShard, placeFromCoordinates, searchPlaces, shardKey,
    type Gazetteer, type PlaceHit, type PlaceRow,
  } from '../store/gazetteer';
  import type { FormState } from './state';

  let { form = $bindable(), gaz, onsubmit }: {
    form: FormState;
    gaz: Gazetteer | null;
    onsubmit: () => void;
  } = $props();

  let query = $state('');
  let open = $state(false);

  $effect(() => {
    if (form.place) query = `${form.place.name}, ${form.place.country}`;
  });

  // the smaller places filed under the query's first letters, fetched as it is typed (astro-brv)
  let small = $state<PlaceRow[]>([]);
  $effect(() => {
    const key = gaz && open ? shardKey(fold(query.split(',')[0] ?? ''), gaz.split) : null;
    if (!key) { small = []; return; }
    let current = true;
    void loadShard(key).then(rows => { if (current) small = rows; });
    return () => { current = false; };
  });

  const coords = $derived(gaz && open ? placeFromCoordinates(gaz, query) : null);
  const matches = $derived(
    gaz && open && !coords && query.trim().length >= 2
      ? searchPlaces(gaz, query.trim(), 8, small)
      : [],
  );

  function pick(p: PlaceHit) {
    form.place = { name: p.name, country: p.country, lat: p.lat, lon: p.lon, zone: p.zone };
    open = false;
  }

</script>

<div class="form">
  <label>Name
    <input placeholder="optional" bind:value={form.name}>
  </label>
  <label>Date of birth
    <input type="date" bind:value={form.date}>
  </label>
  <label>Time of birth
    <input type="time" bind:value={form.time}>
  </label>
  <label>Time accuracy
    <select bind:value={form.accuracy}>
      <option value="exact">Exact</option>
      <option value="5min">± 5 min</option>
      <option value="30min">± 30 min</option>
      <option value="2h">± 2 h</option>
      <option value="unknown">Unknown</option>
    </select>
  </label>
  <label>Place
    <input
      class="place"
      placeholder={gaz ? 'type a town, or latitude, longitude' : 'loading places…'}
      disabled={!gaz}
      bind:value={query}
      oninput={() => { open = true; form.place = null; }}
      onfocus={() => { open = true; }}
    >
    {#if coords}
      <div class="dropdown">
        <button type="button" onclick={() => pick(coords)}>
          Use these coordinates<span class="cc">time zone {coords.zone}, from the nearest listed place, {coords.near} ({coords.country}): check it is right</span>
        </button>
      </div>
    {:else if open && query.trim().length >= 2}
      <div class="dropdown">
        {#each matches as m (m.name + m.country + m.lat + m.lon)}
          <button type="button" onclick={() => pick(m)}>
            {m.name}<span class="cc">{m.region ? `${m.region}, ` : ''}{m.country} · {m.lat.toFixed(2)}, {m.lon.toFixed(2)}</span>
          </button>
        {/each}
        <div class="nolist">{matches.length ? 'Not the one?' : 'No match.'} Add a region (“Newport, Wales”), or type latitude, longitude (e.g. 51.48, -3.18).</div>
      </div>
    {/if}
  </label>
  <button class="go" disabled={!form.place || !form.date} onclick={onsubmit}>
    Cast chart
  </button>
</div>
