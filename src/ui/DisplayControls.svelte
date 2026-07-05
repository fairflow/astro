<script lang="ts">
  import type { DisplaySettings } from './state';

  let { display = $bindable() }: { display: DisplaySettings } = $props();
  let open = $state(false);
</script>

<div class="display">
  <button onclick={() => open = !open} aria-expanded={open}>Display ▾</button>
  {#if open}
    <div class="menu">
      <label>Glyph size <span>{Math.round(display.glyphScale * 100)}%</span>
        <input type="range" min="0.9" max="1.9" step="0.05" bind:value={display.glyphScale}>
      </label>
      <label>Glyph weight <span>{display.weight}</span>
        <input type="range" min="4" max="12" step="0.5" bind:value={display.weight}>
      </label>
      <label>Slant (italic) <span>{display.slant}°</span>
        <input type="range" min="0" max="14" step="1" bind:value={display.slant}>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={display.contrast}> High contrast
      </label>
    </div>
  {/if}
</div>

<style>
  .display { position: relative; }
  .display > button {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .menu {
    position: absolute; right: 0; top: 115%; z-index: 50; width: 240px;
    background: var(--bg2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; box-shadow: 0 8px 24px #0009;
    display: flex; flex-direction: column; gap: 10px;
  }
  label { font-size: 12px; color: var(--dim); display: flex; flex-direction: column; gap: 4px; }
  label span { color: var(--ink); float: right; }
  label.check { flex-direction: row; align-items: center; gap: 8px; }
</style>
