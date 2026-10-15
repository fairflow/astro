<script lang="ts">
  import { askClaude } from '../ai/ask';
  import { AI_ENABLED, AI_MODEL_LABEL } from '../ai/config';
  import type { Starter } from '../interpret/prompts';

  // Reusable "Ask Claude" panel. The parent supplies the context-specific
  // system prompt, starter prompts, default request, and a buildSnapshot(anon)
  // that returns the raw-factor markdown (optionally redacted). This component
  // owns only the UI + streaming, so all four tabs stay in sync.
  let { system, starters, defaultRequest, buildSnapshot, accent = 'var(--syn)', anonNote }: {
    system: string;
    starters: Starter[];
    defaultRequest: string;
    buildSnapshot: (anon: boolean) => string;
    accent?: string;
    anonNote?: string;
  } = $props();

  let anon = $state(true);
  let question = $state(defaultRequest);
  let out = $state('');
  let busy = $state(false);
  let err = $state('');
  let started = $state(false);
  let ctrl: AbortController | null = null;

  const preview = $derived(buildSnapshot(anon));

  const DEFAULT_ANON_NOTE =
    'Even anonymised, a birthplace is still computable from an exact chart’s angles — this hides the labels, not the geometry. Turn off to send real names.';

  async function run() {
    if (busy) return;
    const snapshot = buildSnapshot(anon);
    if (!snapshot) { err = 'Nothing to send yet.'; return; }
    err = ''; out = ''; started = true; busy = true;
    const c = new AbortController();
    ctrl = c;
    const q = question.trim() || defaultRequest;
    try {
      await askClaude({
        system, userContent: `${snapshot}\n\n---\n\nRequest: ${q}`,
        signal: c.signal, onDelta: t => out += t,
      });
    } catch (e) {
      if (!c.signal.aborted) err = e instanceof Error ? e.message : String(e);
    } finally {
      if (ctrl === c) ctrl = null;
      busy = false;
    }
  }
  function stop() { ctrl?.abort(); }
</script>

<details class="askai" open style="--ac: {accent}">
  <summary>Ask Claude <span class="beta">experimental</span></summary>

  <p class="priv">
    This sends the raw chart factors (shown below) to Claude through your own API proxy.
    Model: {AI_MODEL_LABEL}. Nothing is sent until you press <b>Ask Claude</b>.
  </p>

  <label class="anon">
    <input type="checkbox" bind:checked={anon} />
    Anonymise — replace names and hide place names
  </label>
  <div class="anonnote">{anonNote ?? DEFAULT_ANON_NOTE}</div>

  <div class="starters">
    {#each starters as s (s.label)}
      <button type="button" class="chip" onclick={() => question = s.text}>{s.label}</button>
    {/each}
  </div>

  <textarea bind:value={question} rows="3" placeholder="Ask a question…"></textarea>

  <div class="askrow">
    {#if busy}
      <button type="button" class="ask" onclick={stop}>Stop</button>
      <span class="spin">Claude is reading…</span>
    {:else}
      <button type="button" class="ask" onclick={run} disabled={!AI_ENABLED}>Ask Claude</button>
    {/if}
    {#if !AI_ENABLED}
      <span class="cfg">Set <code>VITE_AI_WORKER_URL</code> to enable (see worker/README.md).</span>
    {/if}
  </div>

  {#if err}<div class="aierr">{err}</div>{/if}

  {#if started && (out || busy)}
    <div class="aiout">{out}{#if busy}<span class="caret">▍</span>{/if}</div>
  {/if}

  <details class="peek">
    <summary>Preview exactly what will be sent{anon ? ' (anonymised)' : ''}</summary>
    <pre>{preview}</pre>
  </details>
</details>

<style>
  .askai {
    max-width: 760px; margin: 0 auto 14px; border: 1px solid var(--ac);
    background: var(--panel); border-radius: 10px; padding: 10px 14px;
  }
  .askai > summary { color: var(--ac); font-size: 14px; cursor: pointer; }
  .beta {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em;
    color: var(--dim); border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 6px;
  }
  .priv { font-size: 12px; color: var(--dim); line-height: 1.5; margin: 8px 0; }
  .anon { display: flex; align-items: center; gap: 7px; font-size: 13px; margin-top: 4px; }
  .anonnote { font-size: 11.5px; color: var(--dim); line-height: 1.45; margin: 4px 0 10px; }
  .starters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .chip {
    background: var(--bg2); color: var(--fg); border: 1px solid var(--line);
    border-radius: 14px; padding: 4px 11px; font-size: 12px; cursor: pointer;
  }
  .chip:hover { border-color: var(--ac); }
  textarea {
    width: 100%; box-sizing: border-box; background: var(--bg2); color: var(--fg);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
    font: inherit; font-size: 13px; resize: vertical;
  }
  .askrow { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .ask {
    background: var(--ac); color: #fff; border: none; border-radius: 14px;
    padding: 6px 16px; font-size: 13px; cursor: pointer;
  }
  .ask:disabled { opacity: .5; cursor: not-allowed; }
  .spin, .cfg { font-size: 12px; color: var(--dim); }
  .cfg code { font-size: 11px; }
  .aierr {
    margin-top: 10px; font-size: 12.5px; color: var(--mars, #d66);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
  }
  .aiout {
    margin-top: 10px; background: var(--bg2); border: 1px solid var(--line);
    border-radius: 8px; padding: 12px 14px; font-size: 13.5px; line-height: 1.6;
    white-space: pre-wrap; word-wrap: break-word;
  }
  .caret { color: var(--ac); animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .peek { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
  .peek > summary { color: var(--dim); font-size: 12px; cursor: pointer; }
  .peek pre {
    white-space: pre-wrap; word-wrap: break-word; font-size: 11px; color: var(--dim);
    max-height: 260px; overflow: auto; margin: 8px 0 0;
  }
</style>
