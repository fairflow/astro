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
  // tags/ask are B's edits: tags present = she curated them (else slot.markers
  // stand); ask present = she reworded the question (else slot.ask stands).
  // These feed the rewrite phase alongside mark + comment.
  interface Reaction { mark: Mark | null; comment: string; tags?: string[]; ask?: string }

  let batch = $state<Batch | null>(null);
  let error = $state('');
  let idx = $state(0);
  let reactions = $state<Record<string, Reaction>>({});
  // Can this browser share a file to the OS share sheet (iPad: Messages/
  // Mail/AirDrop)? If not (desktop Safari/Chrome), we fall back to download.
  let canShareFiles = $state(false);

  const storageKey = (b: Batch) => `astro-authoring-${b.batch}`;

  onMount(async () => {
    try {
      const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
      canShareFiles = !!navigator.canShare?.({ files: [probe] });
    } catch { canShareFiles = false; }
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
  // A slot is "engaged" if she gave any signal at all — a mark, a comment,
  // a tag edit or a reworded ask. Comment-only (no mark) still counts, so a
  // pass of pure comments can still be sent (M's note: no mark = neutral-ok,
  // but the comment matters).
  function engaged(id: string): boolean {
    const r = reactions[id];
    return !!r && (r.mark !== null || r.comment.trim() !== ''
      || r.tags !== undefined || r.ask !== undefined);
  }
  const engagedCount = $derived(batch
    ? batch.slots.filter(s => engaged(s.id)).length : 0);

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

  // Effective tags for a slot: her curated set if she touched it, else the
  // proposed markers. Read-only — must not mutate during render.
  function slotTags(s: Slot): string[] {
    return reactions[s.id]?.tags ?? s.markers;
  }
  function addTag(value: string) {
    if (!slot) return;
    const t = value.trim();
    if (!t) return;
    const cur = reactions[slot.id]?.tags ?? slot.markers;
    if (cur.includes(t)) return;
    rxWrite(slot.id).tags = [...cur, t];
  }
  function removeTag(tag: string) {
    if (!slot) return;
    const cur = reactions[slot.id]?.tags ?? slot.markers;
    rxWrite(slot.id).tags = cur.filter(x => x !== tag);
  }

  // Ask box is pre-filled with the proposed question; only record an override
  // when she actually changes it (revert to default drops the override).
  function askValue(s: Slot): string {
    return reactions[s.id]?.ask ?? s.ask;
  }
  function setAsk(value: string) {
    if (!slot) return;
    if (value === slot.ask) {
      if (reactions[slot.id]) reactions[slot.id].ask = undefined;
    } else {
      rxWrite(slot.id).ask = value;
    }
  }

  function reactionsFile(b: Batch): File {
    const data = JSON.stringify({
      app: 'astrodynamics-authoring',
      batch: b.batch,
      exportedAt: new Date().toISOString(),
      reactions,
    }, null, 2);
    const name = `authoring-batch-${String(b.batch).padStart(2, '0')}-reactions.json`;
    return new File([data], name, { type: 'application/json' });
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendReactions() {
    if (!batch) return;
    const file = reactionsFile(batch);
    // Prefer the OS share sheet (iPad: Messages/Mail/AirDrop — no Downloads
    // folder, no Files app). Fall back to a plain download otherwise.
    if (canShareFiles && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Astrodynamics reactions' });
        return;
      } catch (e) {
        // User dismissed the sheet: stop, don't surprise them with a download.
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // Any other share failure: fall through to download.
      }
    }
    download(file);
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
      <span class="progress">{engagedCount}/{batch.slots.length} reacted</span>
      <button class="export" onclick={sendReactions} disabled={engagedCount === 0}
        title={canShareFiles ? 'Send your reactions (Messages, Mail or AirDrop)' : 'Download your reactions as a file to send back'}>
        {canShareFiles ? 'Send reactions' : 'Export reactions'}</button>
    </header>

    <div class="dots" role="tablist" aria-label="Batch slots">
      {#each batch.slots as s, i (s.id)}
        <button class="dot" role="tab" aria-selected={i === idx}
          class:current={i === idx} class:done={engaged(s.id)}
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
        <span class="metalabel">Tags</span>
        {#each slotTags(slot) as m (m)}
          <span class="chip">{m}<button class="tagx" title="Remove this tag"
            aria-label={`Remove tag ${m}`} onclick={() => removeTag(m)}>×</button></span>
        {/each}
        <input class="tagadd" type="text" placeholder="+ add tag" aria-label="Add a tag"
          onkeydown={e => { if (e.key === 'Enter') {
            const el = e.target as HTMLInputElement; addTag(el.value); el.value = '';
          } }}>
      </div>

      <div class="askedit">
        <span class="metalabel">Ask</span>
        <textarea class="askbox" rows="2" aria-label="Question to sit with (edit if you'd change it)"
          value={askValue(slot)}
          oninput={e => setAsk((e.target as HTMLTextAreaElement).value)}></textarea>
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
  .meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 10px 0 8px; }
  .metalabel {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .09em;
    color: var(--gold-dim);
  }
  .chip {
    display: inline-flex; align-items: center; gap: 4px;
    border: 1px solid var(--line); border-radius: 10px; padding: 1px 4px 1px 8px;
    font-size: 12px; color: var(--dim);
  }
  .tagx {
    background: none; border: none; color: var(--dim); cursor: pointer;
    font-size: 14px; line-height: 1; padding: 0 2px; border-radius: 6px;
  }
  .tagx:hover { color: var(--square); }
  .tagadd {
    background: var(--bg2); color: var(--ink); border: 1px dashed var(--line);
    border-radius: 10px; padding: 2px 8px; font-size: 12px; width: 88px;
  }
  .askedit { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 14px; }
  .askedit .metalabel { padding-top: 8px; }
  .askbox {
    flex: 1; background: var(--bg2); color: var(--ink); border: 1px solid var(--line);
    border-radius: 8px; padding: 6px 9px; font-size: 12.5px; font-style: italic;
    line-height: 1.5; resize: vertical; font-family: inherit;
  }
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
