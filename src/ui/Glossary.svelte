<script lang="ts">
  import { GLOSSARY } from '../interpret/glossary';

  let query = $state('');
  const shown = $derived(query.trim().length >= 2
    ? GLOSSARY.filter(g =>
        g.term.toLowerCase().includes(query.toLowerCase())
        || g.text.toLowerCase().includes(query.toLowerCase()))
    : GLOSSARY);
</script>

<div class="glossary">
  <details>
    <summary>Glossary — the terms, in plain language</summary>
    <input placeholder="filter terms…" bind:value={query}>
    {#each shown as g (g.term)}
      <div class="entry">
        <b>{g.term}</b>
        <p>{g.text}</p>
      </div>
    {/each}
    {#if !shown.length}<div class="none">No matching terms.</div>{/if}
  </details>
</div>

<style>
  .glossary { margin-top: 10px; }
  details {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 8px 14px;
  }
  summary {
    cursor: pointer; color: var(--gold); font-size: 15px;
    font-family: "Iowan Old Style", "Palatino", Georgia, serif;
  }
  input {
    margin: 8px 0 4px; width: 100%;
    background: var(--bg2); border: 1px solid var(--line); color: var(--ink);
    border-radius: 6px; padding: 5px 9px; font-size: 13px;
  }
  .entry { margin: 9px 0; font-size: 13.5px; }
  .entry b { color: var(--ink); }
  .entry p { color: var(--dim); line-height: 1.5; margin-top: 1px; }
  .none { color: var(--dim); font-size: 13px; padding: 6px 0; }
</style>
