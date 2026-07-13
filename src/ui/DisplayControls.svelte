<script lang="ts">
  import type { DisplaySettings } from './state';
  import { BW_SKIN, applySkin, skinById } from './skins';
  import { ASPECT_FAMILIES } from '../render/glyphs';

  let { display = $bindable() }: { display: DisplaySettings } = $props();
  let open = $state(false);
  let printOpen = $state(false);
  let coloursOpen = $state(false);

  /** Current effective colour of an aspect var, as #rrggbb for the picker:
   *  the user's override if set, else the live palette value. */
  function aspectColour(varName: string): string {
    const ov = display.aspectColors[varName];
    if (ov) return ov;
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : '#888888';
  }
  function setAspectColour(varName: string, hex: string) {
    display.aspectColors = { ...display.aspectColors, [varName]: hex };
  }
  function resetAspectColour(varName: string) {
    const { [varName]: _drop, ...rest } = display.aspectColors;
    display.aspectColors = rest;
  }

  /** Print pipeline (issue #4): optionally switch to the B/W skin just
   *  for the print job, then restore whatever skin the user had. */
  function doPrint(bw: boolean) {
    printOpen = false;
    if (bw) applySkin(BW_SKIN);
    const restore = () => {
      applySkin(skinById(display.skin));
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    // let the skin swap paint before the print dialog freezes rendering
    setTimeout(() => window.print(), 60);
  }

  const dark = $derived(display.theme === 'dark' && display.skin !== 'bw');
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
      <label>Aspect emphasis <span>{Math.round(display.aspectEmphasis * 100)}%</span>
        <input type="range" min="0" max="1" step="0.05" bind:value={display.aspectEmphasis}
          title="Line thickness, colour saturation and how boldly wide-orb aspects show">
      </label>
      <div class="aspcolours">
        <button class="disclose" onclick={() => coloursOpen = !coloursOpen} aria-expanded={coloursOpen}>
          {coloursOpen ? '▾' : '▸'} Aspect colours{display.skin === 'bw' ? ' (off in B/W print)' : ''}
        </button>
        {#if coloursOpen}
          <div class="swatches">
            {#each ASPECT_FAMILIES as fam (fam.var)}
              <div class="swatch">
                <input type="color" aria-label={`${fam.label} colour`}
                  value={aspectColour(fam.var)}
                  oninput={e => setAspectColour(fam.var, (e.target as HTMLInputElement).value)}>
                <span>{fam.label}</span>
                {#if display.aspectColors[fam.var]}
                  <button class="rst" title="Back to palette default"
                    aria-label={`Reset ${fam.label} colour`}
                    onclick={() => resetAspectColour(fam.var)}>×</button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="themes">
        <span class="tlabel">Theme</span>
        <button class:on={display.theme === 'dark'} onclick={() => display.theme = 'dark'}>Dark</button>
        <button class:on={display.theme === 'light'} onclick={() => display.theme = 'light'}>Light</button>
      </div>
      <div class="themes">
        <span class="tlabel">Contrast</span>
        <button class:on={display.contrast === 'low'} onclick={() => display.contrast = 'low'}>Low</button>
        <button class:on={display.contrast === 'medium'} onclick={() => display.contrast = 'medium'}>Medium</button>
        <button class:on={display.contrast === 'high'} onclick={() => display.contrast = 'high'}>High</button>
      </div>
      <div class="themes">
        <span class="tlabel">Skin</span>
        <button class:on={display.skin === 'auto'} onclick={() => display.skin = 'auto'}>Theme</button>
        <button class:on={display.skin === 'bw'} title="Black on white — single ink, paper-safe"
          onclick={() => display.skin = 'bw'}>B/W print</button>
      </div>
      <button class="printbtn" onclick={() => { printOpen = true; open = false; }}>Print chart…</button>
      <div class="note">Settings save automatically in this browser and are used as your defaults.</div>
    </div>
  {/if}
</div>

{#if printOpen}
  <div class="scrim" onclick={() => printOpen = false} role="presentation"></div>
  <div class="printdlg" role="dialog" aria-label="Printing">
    <h2>Print this chart</h2>
    <p>Printing uses the page as displayed — the current tab, wheel and
    readings — with the app controls hidden.</p>
    {#if dark}
      <p class="warnink">⚠ You are in dark mode: printing as shown would lay
      heavy ink over the whole page. Black on white is recommended.</p>
    {/if}
    <div class="actions">
      <button class="go" onclick={() => doPrint(true)}>Print black on white</button>
      <button class="alt" onclick={() => doPrint(false)}>Print as shown</button>
      <button class="alt" onclick={() => printOpen = false}>Cancel</button>
    </div>
    <p class="fine">Tip: the B/W skin can also be kept on-screen — Display →
    Skin → B/W print. Tracked as <a href="https://github.com/fairflow/astro/issues/4" target="_blank" rel="noreferrer">issue #4</a>.</p>
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
  .disclose {
    background: none; border: none; color: var(--dim); font-size: 12px;
    text-align: left; padding: 0; cursor: pointer;
  }
  .swatches { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 8px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink); }
  .swatch input[type="color"] {
    width: 26px; height: 20px; padding: 0; border: 1px solid var(--line);
    border-radius: 4px; background: none; cursor: pointer;
  }
  .swatch .rst {
    background: none; border: none; color: var(--dim); cursor: pointer;
    font-size: 14px; line-height: 1; padding: 0 2px;
  }
  .swatch .rst:hover { color: var(--square); }
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
    z-index: 95; width: min(460px, 92vw);
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 18px 20px;
  }
  .printdlg h2 {
    color: var(--gold); font-size: 17px; margin-bottom: 8px;
    font-family: "Iowan Old Style", "Palatino", Georgia, serif;
  }
  .printdlg p { font-size: 13.5px; line-height: 1.5; margin-bottom: 8px; }
  .printdlg .warnink { color: var(--square); }
  .printdlg .fine { color: var(--dim); font-size: 12px; margin-top: 10px; margin-bottom: 0; }
  .printdlg a { color: var(--gold); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  .actions .go {
    background: var(--gold); color: var(--on-gold); border: none; font-weight: 600;
    padding: 6px 16px; border-radius: 6px;
  }
  .actions .alt {
    background: none; border: 1px solid var(--line); color: var(--dim);
    padding: 6px 14px; border-radius: 6px;
  }
</style>
