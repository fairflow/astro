<script lang="ts">
  import {
    BODY_GROUPS, LOCKED_BODIES, defaultPrefs, prefs, storePrefs,
  } from './prefs.svelte';
  import { DEFAULT_ASPECTS } from '../chart/aspects';
  import { BODY_NAME } from '../render/glyphs';
  import Glyph from './Glyph.svelte';

  let open = $state(false);

  $effect(() => storePrefs($state.snapshot(prefs)));

  function reset() {
    const d = defaultPrefs();
    Object.assign(prefs.bodies, d.bodies);
    Object.assign(prefs.aspects, d.aspects);
  }
</script>

<div class="settings">
  <button onclick={() => open = !open} aria-expanded={open}>Settings ▾</button>
  {#if open}
    <div class="menu">
      <h3>Bodies in charts & readings</h3>
      {#each BODY_GROUPS as g (g.label)}
        <div class="group">{g.label}</div>
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

      <div class="foot">
        <button class="reset" onclick={reset}>Reset to defaults</button>
        <span class="note">Applies everywhere: wheels, aspect lists, readings,
          dossiers, snapshots. Saved automatically.</span>
      </div>
    </div>
  {/if}
</div>

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
  .group { color: var(--dim); font-size: 11px; margin: 6px 0 2px; }
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
