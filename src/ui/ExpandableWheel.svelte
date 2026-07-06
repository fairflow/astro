<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import Wheel from './Wheel.svelte';

  type WheelProps = ComponentProps<typeof Wheel>;
  let { caption = [], flyout, ...wheel }: {
    /** Lines shown beside the expanded wheel: name, birth data, place… */
    caption?: string[];
    /** Extra overlay content (e.g. the natal selection reading). */
    flyout?: Snippet;
  } & WheelProps = $props();

  let expanded = $state(false);
  let castStamp = $state('');

  function expand() {
    const n = new Date();
    castStamp = `cast ${n.toISOString().slice(0, 10)} `
      + `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    expanded = true;
  }
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape') expanded = false; }} />

<div class="wheelx">
  <button class="expand" title="Expand chart" onclick={expand}>⤢ Expand</button>
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
