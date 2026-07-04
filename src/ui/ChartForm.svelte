<script lang="ts">
  import { searchPlaces, type Gazetteer } from '../store/gazetteer';
  import { fmtOffset, localToUt } from '../chart/civil';
  import type { SavedPlace } from '../store/db';
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

  const matches = $derived(
    gaz && open && query.trim().length >= 2
      ? searchPlaces(gaz, query.trim(), 8)
      : [],
  );

  function pick(p: SavedPlace) {
    form.place = p;
    open = false;
  }

  const tzInfo = $derived.by(() => {
    if (!form.place || !form.date) return '';
    const [y, mo, d] = form.date.split('-').map(Number);
    const [h, mi] = (form.time || '12:00').split(':').map(Number);
    try {
      const r = localToUt(y!, mo!, d!, h ?? 12, mi ?? 0, form.place.zone);
      return `${form.place.zone} · ${fmtOffset(r.offsetMinutes)} at birth`;
    } catch {
      return '';
    }
  });
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
      placeholder={gaz ? 'type a city…' : 'loading places…'}
      disabled={!gaz}
      bind:value={query}
      oninput={() => { open = true; form.place = null; }}
      onfocus={() => { open = true; }}
    >
    {#if matches.length}
      <div class="dropdown">
        {#each matches as m (m.name + m.country + m.lat)}
          <button type="button" onclick={() => pick(m)}>
            {m.name}<span class="cc">{m.country} · {m.lat.toFixed(2)}, {m.lon.toFixed(2)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </label>
  <button class="go" disabled={!form.place || !form.date} onclick={onsubmit}>
    Cast chart
  </button>
  {#if tzInfo}<span class="tzinfo">{tzInfo}</span>{/if}
</div>
