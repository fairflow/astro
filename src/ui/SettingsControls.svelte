<script lang="ts">
  import {
    BODY_GROUPS, LOCKED_BODIES, defaultPrefs, prefs, storePrefs,
  } from './prefs.svelte';
  import { DEFAULT_ASPECTS } from '../chart/aspects';
  import { BODY_NAME } from '../render/glyphs';
  import Glyph from './Glyph.svelte';

  // embedded = render bare content inside the shared Settings panel (no own
  // button/dropdown); standalone keeps the old button+menu for compatibility.
  let { embedded = false }: { embedded?: boolean } = $props();
  let open = $state(false);

  $effect(() => storePrefs($state.snapshot(prefs)));

  function reset() {
    const d = defaultPrefs();
    Object.assign(prefs.bodies, d.bodies);
    Object.assign(prefs.aspects, d.aspects);
    prefs.showMoonPhase = d.showMoonPhase;
  }
</script>

{#snippet content()}
      <h3>Bodies in charts & readings</h3>
      {#each BODY_GROUPS as g (g.label)}
        {@const unlocked = g.bodies.filter(b => !LOCKED_BODIES.includes(b))}
        {@const allOn = unlocked.every(b => prefs.bodies[b])}
        <label class="group">
          <input type="checkbox" checked={allOn}
            title={allOn ? `Switch the whole “${g.label}” group off` : `Switch the whole “${g.label}” group on`}
            onchange={() => {
              // compute once: {@const allOn} is reactive and would flip mid-loop
              const on = !unlocked.every(b => prefs.bodies[b]);
              for (const b of unlocked) prefs.bodies[b] = on;
            }}>
          {g.label}
        </label>
        <div class="grid">
          {#each g.bodies as b (b)}
            <label class:locked={LOCKED_BODIES.includes(b)}
              title={LOCKED_BODIES.includes(b) ? 'The luminaries anchor houses and dossiers and cannot be disabled' : ''}>
              <input type="checkbox" bind:checked={prefs.bodies[b]}
                disabled={LOCKED_BODIES.includes(b)}>
              <Glyph body={b} size={14} /> {BODY_NAME[b]}
            </label>
          {/each}
        </div>
      {/each}

      <h3>Aspects</h3>
      <div class="grid">
        {#each DEFAULT_ASPECTS as d (d.name)}
          <label>
            <input type="checkbox" bind:checked={prefs.aspects[d.name]}>
            <Glyph aspect={d.name} size={13} /> {d.name} ({d.angle}°)
          </label>
        {/each}
      </div>

      <h3>Readings</h3>
      <label>
        <input type="checkbox" bind:checked={prefs.showMoonPhase}>
        Show Moon phase in the reading panel
      </label>

      <div class="foot">
        <button class="reset" onclick={reset}>Reset to defaults</button>
        <span class="note">Applies everywhere: wheels, aspect lists, readings,
          dossiers, snapshots. Saved automatically.</span>
      </div>
{/snippet}

{#if embedded}
  {@render content()}
{:else}
  <div class="settings">
    <button onclick={() => open = !open} aria-expanded={open}>Settings ▾</button>
    {#if open}<div class="menu">{@render content()}</div>{/if}
  </div>
{/if}

<style>
  .settings { position: relative; }
  .settings > button {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .menu {
    position: absolute; right: 0; top: 115%; z-index: 50; width: 340px;
    max-height: 70vh; overflow-y: auto;
    background: var(--bg2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; box-shadow: 0 8px 24px #0009;
  }
  h3 {
    font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
    color: var(--gold-dim); margin: 10px 0 4px;
    font-family: -apple-system, sans-serif;
  }
  h3:first-child { margin-top: 0; }
  .group {
    color: var(--gold); font-size: 13.5px; font-weight: 600;
    margin: 8px 0 3px; display: flex; align-items: center; gap: 7px;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
  label {
    display: flex; align-items: center; gap: 6px; font-size: 13px;
    color: var(--ink); padding: 2px 0; cursor: pointer;
  }
  label.locked { color: var(--dim); cursor: not-allowed; }
  .foot { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .reset {
    background: none; border: 1px solid var(--line); color: var(--dim);
    border-radius: 10px; padding: 3px 10px; font-size: 12px; align-self: flex-start;
  }
  .note { color: var(--dim); font-size: 11px; line-height: 1.4; }
</style>
