<script lang="ts">
  import type { Chart } from '../chart/chart';
  import type { EphemerisProvider } from '../ephemeris/types';
  import {
    chironDossier, saturnDossier, sunMoonDossier, type Dossier,
  } from '../interpret/dossiers';
  import { tensionReport, tensionText } from '../interpret/composer';
  import type { StyleId } from '../interpret/types';

  let { chart, style, provider, jdBirth }: {
    chart: Chart;
    style: StyleId;
    provider: EphemerisProvider;
    jdBirth: number;
  } = $props();

  const dossiers = $derived<Dossier[]>([
    chironDossier(chart, style),
    saturnDossier(chart, style, provider, jdBirth),
    sunMoonDossier(chart, style),
  ]);
  const tensions = $derived(tensionReport(chart));
</script>

<div class="themes">
  <h3>Themes</h3>
  {#each dossiers as d (d.id)}
    <details>
      <summary>{d.title}</summary>
      <div class="factors">Factors: {d.factors}</div>
      {#each d.sections as s}
        <div class="sec">
          <b>{s.heading}</b>
          <p>{s.text} <span class="src">{s.source}</span></p>
        </div>
      {/each}
    </details>
  {/each}
  <details>
    <summary>Tensions &amp; polarities</summary>
    <div class="factors">Aspect pairs whose theme signatures strongly oppose each other — stated, not averaged away.</div>
    {#if tensions.length}
      {#each tensions as t}
        <div class="sec"><p>{tensionText(t, style)}</p></div>
      {/each}
    {:else}
      <div class="sec"><p>No strong contradictions between this chart’s aspects.</p></div>
    {/if}
  </details>
</div>

<style>
  .themes { margin-top: 16px; }
  h3 {
    font-size: 12px; text-transform: uppercase; letter-spacing: .1em;
    color: var(--dim); margin-bottom: 6px;
    font-family: -apple-system, sans-serif;
  }
  details {
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    padding: 8px 14px; margin-bottom: 8px;
  }
  summary {
    cursor: pointer; color: var(--gold); font-size: 15px;
    font-family: "Iowan Old Style", "Palatino", Georgia, serif;
  }
  .factors { color: var(--dim); font-size: 11.5px; margin: 6px 0 4px; }
  .sec { margin: 9px 0; font-size: 13.5px; }
  .sec b { display: block; font-size: 12.5px; color: var(--ink); margin-bottom: 2px; }
  .sec p { line-height: 1.5; }
  .src {
    color: var(--dim); font-size: 10px; text-transform: uppercase;
    letter-spacing: .06em; border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 4px; white-space: nowrap;
  }
</style>
