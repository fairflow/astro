<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import Wheel from './Wheel.svelte';
  import { exportWheelPng, exportWheelSvg, wheelBasename } from '../render/export';

  type WheelProps = ComponentProps<typeof Wheel>;
  let { caption = [], flyout, ...wheel }: {
    /** Lines shown beside the expanded wheel: name, birth data, place… */
    caption?: string[];
    /** Extra overlay content (e.g. the natal selection reading). */
    flyout?: Snippet;
  } & WheelProps = $props();

  let expanded = $state(false);
  let castStamp = $state('');
  let wrap: HTMLDivElement | undefined = $state();

  function expand() {
    const n = new Date();
    castStamp = `cast ${n.toISOString().slice(0, 10)} `
      + `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    expanded = true;
  }

  function theSvg(): SVGSVGElement | null {
    return wrap?.querySelector('svg') ?? null;
  }
  function saveSvg() {
    const svg = theSvg();
    if (svg) exportWheelSvg(svg, wheelBasename(caption[0]));
  }
  function savePng() {
    const svg = theSvg();
    if (svg) void exportWheelPng(svg, wheelBasename(caption[0]));
  }
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape') expanded = false; }} />

<div class="wheelx" bind:this={wrap}>
  <div class="exports">
    <button class="expand" title="Expand chart" onclick={expand}>⤢ Expand</button>
    <button class="expand" title="Download the wheel as an SVG image (crisp at any size)" onclick={saveSvg}>SVG</button>
    <button class="expand" title="Download the wheel as a PNG image" onclick={savePng}>PNG</button>
  </div>
  <Wheel {...wheel} />
</div>

{#if expanded}
  <div class="overlay" role="dialog" aria-label="Expanded chart">
    <button class="close" onclick={() => expanded = false}>✕ Close</button>
    <div class="caption">
      {#each caption as line, i}
        <div class={i === 0 ? 'who serif' : ''}>{line}</div>
      {/each}
      <div class="stamp">{castStamp}</div>
    </div>
    <div class="bigwheel">
      <Wheel {...wheel} />
    </div>
    {@render flyout?.()}
  </div>
{/if}
