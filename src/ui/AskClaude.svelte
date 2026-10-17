<script lang="ts">
  import { AI_ENABLED, AI_PRESETS, isPreset, type AiPresetId } from '../ai/config';
  import { aiPrefs, setOpen, setPreset } from '../ai/prefs.svelte';
  import { deleteReading, readings, startReading, stopReading } from '../ai/readings.svelte';
  import type { ReadingTab } from '../ai/readingstore';
  import { renderMarkdown } from '../ai/markdown';
  import { copyToClipboard } from './clipboard';
  import type { Starter } from '../interpret/prompts';

  // Reusable "Ask Claude" panel. The parent supplies the context-specific
  // system prompt, starters, default request, a buildSnapshot(anon) returning
  // the raw-factor markdown, and the reading context (key/group/title/tab).
  // Readings themselves live in the readings store, so they survive tab
  // switches (even mid-stream) and are saved in this browser automatically.
  let {
    system, starters, defaultRequest, buildSnapshot, accent = 'var(--syn)',
    intro = 'This sends the raw chart factors (shown below) to Claude.',
    anonymisable = true, tab, readingKey, readingGroup, readingTitle,
  }: {
    system: string;
    starters: Starter[];
    defaultRequest: string;
    buildSnapshot: (anon: boolean) => string;
    accent?: string;
    intro?: string;
    /** False where the snapshot carries no personal data (the orrery). */
    anonymisable?: boolean;
    tab: ReadingTab;
    /** Exact context: its latest reading is shown when you come back. */
    readingKey: string;
    /** Wider context for the Saved readings list (same tab and people). */
    readingGroup: string;
    readingTitle: string;
  } = $props();

  let anon = $state(true);
  let question = $state(defaultRequest);
  let localErr = $state('');
  let copied = $state(false);
  /** A saved reading chosen from the list (null: show live/latest). */
  let pickedId = $state<number | null>(null);
  /** Delete needs a second click within a few seconds. */
  let armedId = $state<number | null>(null);

  const sendAnon = $derived(anonymisable && anon);
  const preview = $derived(aiPrefs.open ? buildSnapshot(sendAnon) : '');
  const live = $derived(readings.live[readingKey]);
  const savedHere = $derived(readings.saved.filter(r => r.group === readingGroup));
  const busy = $derived(!!live?.busy);

  // a different chart pair / date on screen: back to its own latest reading
  $effect(() => { void readingKey; pickedId = null; });

  interface Shown {
    id: number | null; text: string; busy: boolean; err: string;
    question: string; preset: AiPresetId; createdAt: number; stopped: boolean;
  }
  const shown = $derived.by<Shown | null>(() => {
    const picked = pickedId !== null ? savedHere.find(r => r.id === pickedId) : undefined;
    if (picked) return { ...picked, busy: false, err: '' };
    if (live) {
      return {
        id: live.savedId, text: live.text, busy: live.busy, err: live.err,
        question: live.question, preset: live.preset, createdAt: live.createdAt,
        stopped: !live.busy && !!live.savedId && !!savedHere.find(r => r.id === live.savedId)?.stopped,
      };
    }
    const latest = savedHere.find(r => r.key === readingKey);
    return latest ? { ...latest, busy: false, err: '' } : null;
  });

  const presetLabel = (p: AiPresetId) => AI_PRESETS.find(x => x.id === p)?.label ?? p;
  const fmtWhen = (ms: number) => new Date(ms).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const excerpt = (s: string, n = 90) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  function run() {
    if (busy) return;
    const snapshot = buildSnapshot(sendAnon);
    if (!snapshot) { localErr = 'Nothing to send yet.'; return; }
    localErr = ''; copied = false; pickedId = null;
    startReading({
      key: readingKey, group: readingGroup, tab, title: readingTitle, system, snapshot,
      question: question.trim() || defaultRequest, preset: aiPrefs.preset, anonymised: sendAnon,
    });
  }

  async function copyReading() {
    if (!shown?.text || !await copyToClipboard(shown.text)) return;
    copied = true;
    setTimeout(() => copied = false, 2200);
  }

  function del(id: number) {
    if (armedId !== id) {
      armedId = id;
      setTimeout(() => { if (armedId === id) armedId = null; }, 3000);
      return;
    }
    armedId = null;
    if (pickedId === id) pickedId = null;
    deleteReading(id);
  }
</script>

<!-- not shown where the Worker would refuse the page's requests (see AI_ENABLED) -->
{#if AI_ENABLED}
<details class="askai" style="--ac: {accent}" bind:open={aiPrefs.open}
  ontoggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
  <summary>
    Ask Claude <span class="beta">experimental</span>
    {#if busy}<span class="count">reading…</span>
    {:else if savedHere.length}<span class="count">{savedHere.length} saved</span>{/if}
  </summary>

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
      <button type="button" class="ask" onclick={() => stopReading(readingKey)}>Stop</button>
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
    {#if shown?.text && !shown.busy}
      <button type="button" class="chip" onclick={copyReading}>{copied ? 'Copied ✓' : 'Copy reading'}</button>
    {/if}
  </div>

  {#if localErr}<div class="aierr">{localErr}</div>{/if}
  {#if shown?.err}<div class="aierr">{shown.err}</div>{/if}

  {#if shown && (shown.text || shown.busy)}
    <div class="meta">
      {shown.busy ? 'Reading now' : `Saved ${fmtWhen(shown.createdAt)}`}{shown.stopped ? ' (stopped early)' : ''}
      · {presetLabel(shown.preset)} · “{excerpt(shown.question)}”
    </div>
    <!-- renderMarkdown escapes everything and emits only a fixed tag set (see src/ai/markdown.ts) -->
    <div class="aiout">{@html renderMarkdown(shown.text)}{#if shown.busy}<span class="caret">▍</span>{/if}</div>
  {/if}

  {#if savedHere.length}
    <details class="past">
      <summary>Saved readings ({savedHere.length}) <span class="dim">· kept in this browser only</span></summary>
      <ul>
        {#each savedHere as r (r.id)}
          <li class:on={shown?.id === r.id}>
            <button type="button" class="pick" onclick={() => pickedId = r.id}>
              <span class="when">{fmtWhen(r.createdAt)}</span>
              <span class="ttl">{r.title}{r.stopped ? ' (stopped early)' : ''}</span>
              <span class="q">{excerpt(r.question, 120)}</span>
            </button>
            <button type="button" class="del" class:armed={armedId === r.id}
              aria-label="Delete this reading" onclick={() => del(r.id)}>
              {armedId === r.id ? 'Delete?' : '×'}
            </button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <details class="peek">
    <summary>Preview exactly what will be sent{sendAnon ? ' (names hidden)' : ''}</summary>
    <pre>{preview}</pre>
  </details>
</details>
{/if}

<style>
  .askai {
    max-width: 760px; margin: 0 auto 10px; border: 1px solid var(--ac);
    background: var(--panel); border-radius: 10px; padding: 6px 14px;
  }
  .askai[open] { padding-bottom: 12px; }
  .askai > summary { color: var(--ac); font-size: 14px; cursor: pointer; padding: 2px 0; }
  .beta, .count {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em;
    color: var(--dim); border: 1px solid var(--line); border-radius: 8px;
    padding: 0 6px; margin-left: 6px;
  }
  .count { color: var(--ac); border-color: var(--ac); }
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
  .spin { font-size: 12px; color: var(--dim); }
  .aierr {
    margin-top: 10px; font-size: 12.5px; color: var(--square, #d66);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px;
  }
  .meta { margin-top: 10px; font-size: 11.5px; color: var(--dim); line-height: 1.4; }
  .aiout {
    margin-top: 4px; background: var(--bg2); border: 1px solid var(--line);
    border-radius: 8px; padding: 14px 18px; font-size: 14px; line-height: 1.6;
    word-wrap: break-word;
  }
  /* rendered Markdown (the elements come from {@html}, hence :global) */
  .aiout :global(h2) { font-size: 17px; color: var(--ac); margin: 4px 0 10px; font-weight: 600; }
  .aiout :global(h3) { font-size: 15px; color: var(--gold); margin: 18px 0 6px; font-weight: 600; }
  .aiout :global(h4) { font-size: 14px; color: var(--ink); margin: 14px 0 4px; font-weight: 600; }
  .aiout :global(p) { margin: 0 0 10px; }
  .aiout :global(ul), .aiout :global(ol) { margin: 0 0 10px; padding-left: 22px; }
  .aiout :global(li) { margin: 4px 0; }
  .aiout :global(li.sub) { margin-left: 20px; list-style-type: circle; }
  .aiout :global(strong) { color: var(--ink); font-weight: 650; }
  .aiout :global(blockquote) {
    margin: 0 0 10px; padding: 2px 12px; border-left: 3px solid var(--ac); color: var(--dim);
  }
  .aiout :global(hr) { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
  .aiout :global(code) { font-size: 12.5px; background: var(--panel); padding: 0 4px; border-radius: 4px; }
  .aiout :global(a) { color: var(--ac); }
  .aiout :global(:last-child) { margin-bottom: 0; }
  .caret { color: var(--ac); animation: blink 1s steps(2) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .past, .peek { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; }
  .past > summary, .peek > summary { color: var(--dim); font-size: 12px; cursor: pointer; }
  .past > summary { color: var(--ac); }
  .past ul { list-style: none; margin: 8px 0 2px; padding: 0; display: grid; gap: 4px; max-height: 280px; overflow-y: auto; }
  .past li { display: flex; gap: 6px; align-items: stretch; }
  .past li.on .pick { border-color: var(--ac); }
  .pick {
    flex: 1; min-width: 0; text-align: left; background: var(--bg2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: 5px 9px; cursor: pointer;
    display: grid; gap: 1px; font-size: 12px;
  }
  .pick .when { color: var(--dim); font-size: 11px; }
  .pick .ttl { font-weight: 600; }
  .pick .q { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .del {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 8px; padding: 0 9px; cursor: pointer; font-size: 13px;
  }
  .del:hover, .del.armed { color: var(--square, #d66); border-color: var(--square, #d66); }
  .del.armed { font-size: 11.5px; }
  .peek pre {
    white-space: pre-wrap; word-wrap: break-word; font-size: 11px; color: var(--dim);
    max-height: 260px; overflow: auto; margin: 8px 0 0;
  }
</style>
