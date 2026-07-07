<script lang="ts">
  import { onMount } from 'svelte';
  import { STYLES } from '../interpret/types';

  /** Stage 1c Phase A: B's reaction form (scope doc, "B's authoring form").
   *  Flag-gated (?author or localStorage astro-author=1); admin-only later. */

  interface Slot {
    id: string; kind: string; label: string; kernel: string;
    texts: Record<string, string>; markers: string[]; ask: string;
    strawman?: boolean;
  }
  interface Batch { batch: number; wave: number; title: string; slots: Slot[] }
  type Mark = 'yes' | 'flat' | 'no';
  interface Reaction { mark: Mark | null; comment: string }

  let batch = $state<Batch | null>(null);
  let error = $state('');
  let idx = $state(0);
  let reactions = $state<Record<string, Reaction>>({});

  const storageKey = (b: Batch) => `astro-authoring-${b.batch}`;

  onMount(async () => {
    try {
      const res = await fetch('authoring/batch-00.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      batch = await res.json() as Batch;
      try {
        const raw = localStorage.getItem(storageKey(batch));
        if (raw) reactions = JSON.parse(raw) as Record<string, Reaction>;
      } catch { /* fresh reactions */ }
    } catch (e) {
      error = `Batch failed to load: ${e instanceof Error ? e.message : e}`;
    }
  });

  $effect(() => {
    if (!batch) return;
    try {
      localStorage.setItem(storageKey(batch), JSON.stringify(reactions));
    } catch { /* private mode */ }
  });

  const slot = $derived(batch?.slots[idx] ?? null);
  const reacted = $derived(batch
    ? batch.slots.filter(s => reactions[s.id]?.mark).length : 0);

  // Reads must NOT mutate: the template calls rxRead during render and
  // Svelte throws state_unsafe_mutation if a render writes state.
  const EMPTY: Reaction = { mark: null, comment: '' };
  function rxRead(id: string): Reaction {
    return reactions[id] ?? EMPTY;
  }
  function rxWrite(id: string): Reaction {
    if (!reactions[id]) reactions[id] = { mark: null, comment: '' };
    return reactions[id];
  }

  function setMark(m: Mark) {
    if (!slot) return;
    const r = rxWrite(slot.id);
    r.mark = r.mark === m ? null : m;
  }

  function exportReactions() {
    if (!batch) return;
    const data = JSON.stringify({
      app: 'astrodynamics-authoring',
      batch: batch.batch,
      exportedAt: new Date().toISOString(),
      reactions,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `authoring-batch-${String(batch.batch).padStart(2, '0')}-reactions.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const MARKS: { m: Mark; label: string; hint: string }[] = [
    { m: 'yes', label: '✓ lands', hint: 'This one speaks true' },
    { m: 'flat', label: '~ flat', hint: 'Nothing wrong, nothing alive' },
    { m: 'no', label: '✗ wrong', hint: 'Wrong, preachy, or off-key' },
  ];
</script>

<main class="authoring">
  {#if error}
    <div class="err">{error}</div>
  {:else if !batch || !slot}
    <div class="err">Loading batch…</div>
  {:else}
    <header>
      <h2 class="serif">{batch.title}</h2>
      <span class="progress">{reacted}/{batch.slots.length} reacted</span>
      <button class="export" onclick={exportReactions} disabled={reacted === 0}
        title="Download your reactions as a file to send back">Export reactions</button>
    </header>

    <div class="dots" role="tablist" aria-label="Batch slots">
      {#each batch.slots as s, i (s.id)}
        <button class="dot" role="tab" aria-selected={i === idx}
          class:current={i === idx} class:done={!!reactions[s.id]?.mark}
          title={s.label} onclick={() => idx = i}></button>
      {/each}
    </div>

    <section class="card">
      <div class="slothead">
        <b>{slot.label}</b>
        <span class="kind">{slot.kind}</span>
        {#if slot.strawman}<span class="straw" title="Machine-generated placeholder — react to how it reads anyway">straw-man</span>{/if}
      </div>
      <div class="kernel">{slot.kernel}</div>

      {#each STYLES as st (st.id)}
        <div class="reg">
          <div class="regname">{st.label}</div>
          <p>{slot.texts[st.id]}</p>
        </div>
      {/each}

      <div class="meta">
        {#each slot.markers as m}<span class="chip">{m}</span>{/each}
        <span class="ask">Ask: {slot.ask}</span>
      </div>

      <div class="react">
        {#each MARKS as { m, label, hint } (m)}
          <button class="mark" class:on={rxRead(slot.id).mark === m}
            title={hint} onclick={() => setMark(m)}>{label}</button>
        {/each}
        <input type="text" placeholder="a phrase of reaction (optional)"
          value={rxRead(slot.id).comment}
          oninput={e => { rxWrite(slot.id).comment = (e.target as HTMLInputElement).value; }}>
      </div>

      <nav class="pager">
        <button disabled={idx === 0} onclick={() => idx -= 1}>← Back</button>
        <span>{idx + 1} / {batch.slots.length}</span>
        <button disabled={idx === batch.slots.length - 1} onclick={() => idx += 1}>Next →</button>
      </nav>
    </section>
  {/if}
</main>

<style>
  .authoring { max-width: 720px; margin: 18px auto 40px; padding: 0 20px; }
  header { display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px; }
  header h2 { color: var(--gold); font-size: 19px; flex: 1; }
  .progress { color: var(--dim); font-size: 12.5px; }
  .export {
    background: none; border: 1px solid var(--gold-dim); color: var(--gold);
    border-radius: 12px; padding: 4px 12px; font-size: 12.5px;
  }
  .export:disabled { opacity: 0.4; }
  .dots { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
  .dot {
    width: 13px; height: 13px; border-radius: 50%; padding: 0;
    background: var(--bg2); border: 1px solid var(--line);
  }
  .dot.done { background: var(--gold-dim); border-color: var(--gold-dim); }
  .dot.current { outline: 2px solid var(--gold); outline-offset: 1px; }
  .card {
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px 20px;
  }
  .slothead { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .slothead b { font-size: 16px; }
  .kind, .straw {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em;
    border: 1px solid var(--line); border-radius: 8px; padding: 1px 7px; color: var(--dim);
  }
  .straw { color: var(--square); border-color: var(--square); }
  .kernel { color: var(--dim); font-style: italic; font-size: 13.5px; margin-bottom: 12px; }
  .reg { margin-bottom: 10px; }
  .regname {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .09em;
    color: var(--gold-dim); margin-bottom: 2px;
  }
  .reg p { font-size: 14.5px; line-height: 1.55; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 10px 0 14px; }
  .chip {
    border: 1px solid var(--line); border-radius: 10px; padding: 1px 8px;
    font-size: 12px; color: var(--dim);
  }
  .ask { color: var(--dim); font-size: 12.5px; font-style: italic; }
  .react { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .mark {
    background: var(--bg2); color: var(--dim); border: 1px solid var(--line);
    border-radius: 12px; padding: 5px 13px; font-size: 13.5px;
  }
  .mark.on { color: var(--on-gold); background: var(--gold); border-color: var(--gold); font-weight: 600; }
  .react input {
    flex: 1; min-width: 180px; background: var(--bg2); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: 6px 9px; font-size: 13.5px;
  }
  .pager { display: flex; align-items: center; gap: 14px; justify-content: center; }
  .pager button {
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 12px; padding: 6px 16px; font-size: 13.5px;
  }
  .pager button:disabled { opacity: 0.35; }
  .pager span { color: var(--dim); font-size: 12.5px; }
  .err { color: var(--dim); text-align: center; margin: 40px 0; }
</style>
