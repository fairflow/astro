<script lang="ts">
  import type { DisplaySettings } from './state';
  import SettingsControls from './SettingsControls.svelte';
  import DisplayControls from './DisplayControls.svelte';

  // One consolidated panel: bodies/aspects (SettingsControls) + display/theme
  // (DisplayControls), so the header carries a single button instead of two.
  let { display = $bindable() }: { display: DisplaySettings } = $props();
  let open = $state(false);
</script>

<div class="settingsmenu">
  <button class="trigger" onclick={() => open = !open} aria-expanded={open}
    title="Bodies, display, aspects and theme">⚙ Settings ▾</button>
  {#if open}
    <div class="menu">
      <SettingsControls embedded />
      <div class="sectlabel">Display &amp; theme</div>
      <DisplayControls embedded bind:display />
    </div>
  {/if}
</div>

<style>
  .settingsmenu { position: relative; }
  .trigger {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .menu {
    position: absolute; right: 0; top: 115%; z-index: 50; width: 340px;
    max-height: 80vh; overflow-y: auto;
    background: var(--bg2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; box-shadow: 0 8px 24px #0009;
  }
  .sectlabel {
    font-size: 11px; text-transform: uppercase; letter-spacing: .1em;
    color: var(--gold-dim); margin: 14px 0 8px; padding-top: 12px;
    border-top: 1px solid var(--line);
    font-family: -apple-system, sans-serif;
  }
</style>
