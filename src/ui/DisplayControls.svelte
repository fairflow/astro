<script lang="ts">
  import type { DisplaySettings } from './state';

  let { display = $bindable() }: { display: DisplaySettings } = $props();
  let open = $state(false);
  let printOpen = $state(false);
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
      <label>Text size <span>{Math.round(display.textScale * 100)}%</span>
        <input type="range" min="0.85" max="1.6" step="0.05" bind:value={display.textScale}>
      </label>
      <div class="themes">
        <span class="tlabel">Theme</span>
        <button class:on={display.theme === 'dark'} onclick={() => display.theme = 'dark'}>Dark</button>
        <button class:on={display.theme === 'light'} onclick={() => display.theme = 'light'}>Light</button>
      </div>
      <div class="themes">
        <span class="tlabel">Contrast</span>
        <button class:on={!display.hc} onclick={() => display.hc = false}>Normal</button>
        <button class:on={display.hc} onclick={() => display.hc = true}>High</button>
      </div>
      <button class="printbtn" onclick={() => { printOpen = true; open = false; }}>Print chart…</button>
      <div class="note">Settings save automatically in this browser and are used as your defaults.</div>
    </div>
  {/if}
</div>

{#if printOpen}
  <div class="scrim" onclick={() => printOpen = false} role="presentation"></div>
  <div class="printdlg" role="dialog" aria-label="Printing">
    <h2>Printing — planned, not built yet</h2>
    <p>The print pipeline will switch the chart to a <b>black-on-white</b> skin,
    show a preview, and warn when large dark areas would be printed. Until then,
    browser printing of the dark theme will waste ink — switch Theme to Light
    first if you must print today.</p>
    <p class="fine">Tracked as <a href="https://github.com/fairflow/astro/issues/4" target="_blank" rel="noreferrer">issue #4</a>.</p>
    <button onclick={() => printOpen = false}>Close</button>
  </div>
{/if}

<style>
  .display { position: relative; }
  .display > button {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 14px; padding: 5px 12px; font-size: 12.5px;
  }
  .menu {
    position: absolute; right: 0; top: 115%; z-index: 50; width: 250px;
    background: var(--bg2); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 14px; box-shadow: 0 8px 24px #0009;
    display: flex; flex-direction: column; gap: 10px;
  }
  label { font-size: 12px; color: var(--dim); display: flex; flex-direction: column; gap: 4px; }
  label span { color: var(--ink); float: right; }
  .themes { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  .tlabel { font-size: 12px; color: var(--dim); margin-right: 2px; }
  .themes button {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 10px; padding: 3px 9px; font-size: 11.5px;
  }
  .themes button.on { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .printbtn {
    background: none; border: 1px solid var(--gold-dim); color: var(--gold);
    border-radius: 12px; padding: 5px 12px; font-size: 12.5px; align-self: flex-start;
  }
  .note { color: var(--dim); font-size: 11px; line-height: 1.4; }
  .scrim { position: fixed; inset: 0; background: #0009; z-index: 90; border: 0; }
  .printdlg {
    position: fixed; top: 20vh; left: 50%; transform: translateX(-50%);
    z-index: 95; width: min(440px, 92vw);
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 18px 20px;
  }
  .printdlg h2 {
    color: var(--gold); font-size: 17px; margin-bottom: 8px;
    font-family: "Iowan Old Style", "Palatino", Georgia, serif;
  }
  .printdlg p { font-size: 13.5px; line-height: 1.5; margin-bottom: 8px; }
  .printdlg .fine { color: var(--dim); font-size: 12px; }
  .printdlg a { color: var(--gold); }
  .printdlg button {
    background: var(--gold); color: var(--on-gold); border: none; font-weight: 600;
    padding: 6px 16px; border-radius: 6px;
  }
</style>
