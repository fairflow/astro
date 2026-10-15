<script lang="ts">
  import { askClaude } from '../ai/ask';
  import { AI_ENABLED, AI_PRESETS, isPreset } from '../ai/config';
  import { aiPrefs, setOpen, setPreset } from '../ai/prefs.svelte';
  import { copyToClipboard } from './clipboard';
  import type { Starter } from '../interpret/prompts';

  // Reusable "Ask Claude" panel. The parent supplies the context-specific
  // system prompt, starter prompts, default request, and a buildSnapshot(anon)
  // that returns the raw-factor markdown (optionally redacted). This component
  // owns only the UI + streaming, so every tab stays in sync.
  let {
    system, starters, defaultRequest, buildSnapshot, accent = 'var(--syn)',
    intro = 'This sends the raw chart factors (shown below) to Claude.',
    anonymisable = true,
  }: {
    system: string;
    starters: Starter[];
    defaultRequest: string;
    buildSnapshot: (anon: boolean) => string;
    accent?: string;
    intro?: string;
    /** False where the snapshot carries no personal data (the orrery). */
    anonymisable?: boolean;
  } = $props();

  let anon = $state(true);
  let question = $state(defaultRequest);
  let out = $state('');
  let busy = $state(false);
  let err = $state('');
  let started = $state(false);
  let copied = $state(false);
  let ctrl: AbortController | null = null;

  const sendAnon = $derived(anonymisable && anon);
  const preview = $derived(aiPrefs.open ? buildSnapshot(sendAnon) : '');

  async function run() {
    if (busy) return;
    const snapshot = buildSnapshot(sendAnon);
    if (!snapshot) { err = 'Nothing to send yet.'; return; }
    err = ''; out = ''; started = true; busy = true; copied = false;
    const c = new AbortController();
    ctrl = c;
    const q = question.trim() || defaultRequest;
    try {
      await askClaude({
        system, userContent: `${snapshot}\n\n---\n\nRequest: ${q}`,
        preset: aiPrefs.preset, signal: c.signal, onDelta: t => out += t,
      });
    } catch (e) {
      if (!c.signal.aborted) err = e instanceof Error ? e.message : String(e);
    } finally {
      if (ctrl === c) ctrl = null;
      busy = false;
    }
  }
  function stop() { ctrl?.abort(); }

  async function copyReading() {
    if (!out || !await copyToClipboard(out)) return;
    copied = true;
    setTimeout(() => copied = false, 2200);
  }
</script>

<details class="askai" style="--ac: {accent}" bind:open={aiPrefs.open}
  ontoggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
  <summary>Ask Claude <span class="beta">experimental</span></summary>

  <p class="priv">{intro}</p>

  {#if anonymisable}
    <label class="anon">
      <input type="checkbox" bind:checked={anon} />
      Hide names and places <span class="dim">(untick to send real names)</span>
    </label>
  {/if}

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
    <select class="model" aria-label="Model" disabled={busy}
      title={AI_PRESETS.find(p => p.id === aiPrefs.preset)?.hint}
      value={aiPrefs.preset}
      onchange={e => { const v = (e.currentTarget as HTMLSelectElement).value; if (isPreset(v)) setPreset(v); }}>
      {#each AI_PRESETS as p (p.id)}
        <option value={p.id} title={p.hint}>{p.label}</option>
      {/each}
    </select>
    {#if out && !busy}
      <button type="button" class="chip" onclick={copyReading}>{copied ? 'Copied ✓' : 'Copy reading'}</button>
    {/if}
    {#if !AI_ENABLED}
      <span class="cfg">Not available in this build.</span>
    {/if}
  </div>

  {#if err}<div class="aierr">{err}</div>{/if}

  {#if started && (out || busy)}
    <div class="aiout">{out}{#if busy}<span class="caret">▍</span>{/if}</div>
  {/if}

  <details class="peek">
    <summary>Preview exactly what will be sent{sendAnon ? ' (names hidden)' : ''}</summary>
    <pre>{preview}</pre>
  </details>
</details>

<style>
  .askai {
    max-width: 760px; margin: 0 auto 10px; border: 1px solid var(--ac);
    background: var(--panel); border-radius: 10px; padding: 6px 14px;
  }
  .askai[open] { padding-bottom: 12px; }
  .askai > summary { color: var(--ac); font-size: 14px; cursor: pointer; padding: 2px 0; }
  .beta {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em;
    color: var(--dim); border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 6px;
  }
  .priv { font-size: 12.5px; color: var(--dim); line-height: 1.5; margin: 8px 0; }
  .anon { display: flex; align-items: center; gap: 7px; font-size: 13px; margin: 4px 0 10px; flex-wrap: wrap; }
  .dim { color: var(--dim); font-size: 12px; }
  .starters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .chip {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 14px; padding: 4px 11px; font-size: 12px; cursor: pointer;
  }
  .chip:hover { border-color: var(--ac); }
  textarea {
    width: 100%; box-sizing: border-box; background: var(--bg2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
    font: inherit; font-size: 13px; resize: vertical;
  }
  .askrow { display: flex; align-items: center; gap: 8px 10px; margin-top: 8px; flex-wrap: wrap; }
  .ask {
    background: var(--ac); color: #fff; border: none; border-radius: 14px;
    padding: 6px 16px; font-size: 13px; cursor: pointer;
  }
  .ask:disabled { opacity: .5; cursor: not-allowed; }
  .model {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 14px; padding: 4px 8px; font-size: 12px;
  }
  .spin, .cfg { font-size: 12px; color: var(--dim); }
  .aierr {
    margin-top: 10px; font-size: 12.5px; color: var(--square, #d66);
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
