<script lang="ts">
  import { account } from '../api/account.svelte';
  import {
    ACTION_LABEL, CONFIRM, actionsFor, adminAction, adminLog, listUsers,
    type AdminAction, type AdminLogEntry, type AdminUser,
  } from '../api/admin';

  // The admin panel (astro-tbb.4): accounts with their state, and the actions
  // that fit each state. A modal <dialog>, so it sits above the settings menu.
  // The server re-checks every request; this only arranges the buttons.
  let { open = $bindable(false) }: { open: boolean } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let users = $state<AdminUser[]>([]);
  let log = $state<AdminLogEntry[]>([]);
  let loading = $state(false);
  let note = $state('');
  let error = $state('');
  // the action waiting for "are you sure?" (or a password), as `${userId}:${action}`
  let pending = $state('');
  let newPw = $state('');
  let working = $state(false);

  const pendingCount = $derived(users.filter(u => u.status === 'pending' && u.confirmed).length);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); void load(); }
    else if (!open && dialog.open) dialog.close();
  });

  async function load() {
    loading = true; error = '';
    try { [users, log] = await Promise.all([listUsers(), adminLog()]); }
    catch (e) { error = (e as Error).message; }
    finally { loading = false; }
  }

  function ask(u: AdminUser, a: AdminAction) {
    note = ''; error = ''; newPw = '';
    if (CONFIRM[a] || a === 'set_password') pending = `${u.id}:${a}`;
    else void run(u, a);
  }

  async function run(u: AdminUser, a: AdminAction) {
    if (a === 'set_password' && newPw.length < 10) { error = 'Use at least 10 characters.'; return; }
    working = true; error = '';
    try {
      note = await adminAction(u.id, a, a === 'set_password' ? newPw : undefined);
      pending = ''; newPw = '';
      await load();
    } catch (e) { error = (e as Error).message; }
    finally { working = false; }
  }

  const day = (t: number | null) => t === null ? '—'
    : new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const when = (t: number) => new Date(t * 1000).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
</script>

<dialog bind:this={dialog} class="admin" onclose={() => { open = false; pending = ''; note = ''; error = ''; }}
  aria-labelledby="admin-title">
  <header>
    <h2 id="admin-title">Accounts{#if pendingCount}{' '}<span class="count">{pendingCount} awaiting approval</span>{/if}</h2>
    <div class="row">
      <button type="button" onclick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      <button type="button" onclick={() => open = false} aria-label="Close">✕</button>
    </div>
  </header>

  {#if note}<p class="ok" role="status">{note}</p>{/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <ul class="users">
    {#each users as u (u.id)}
      {@const self = u.email === account.email}
      <li class:attention={u.status === 'pending' && u.confirmed}>
        <div class="who">
          <b>{u.email}</b>
          <span class="badge state-{u.status}">{u.status}</span>
          {#if u.role === 'admin'}<span class="badge">admin</span>{/if}
          {#if u.status === 'pending' && !u.confirmed}<span class="badge dim">address not confirmed</span>{/if}
          {#if u.twoStep}<span class="badge dim">two-step</span>{/if}
          {#if self}<span class="badge dim">you</span>{/if}
        </div>
        <div class="facts">
          registered {day(u.created)} · last seen {day(u.lastSeen)} · {u.sessions} session{u.sessions === 1 ? '' : 's'}
          {#if u.deleteAfter} · <span class="warn">removed on {day(u.deleteAfter)}</span>{/if}
        </div>
        {#if !self}
          {#if pending.startsWith(u.id + ':')}
            {@const a = pending.slice(u.id.length + 1) as AdminAction}
            <div class="confirm">
              {#if a === 'set_password'}
                <label>New password for {u.email} (its sessions end)
                  <input type="password" autocomplete="new-password" minlength="10" bind:value={newPw}>
                </label>
              {:else}
                <span>{CONFIRM[a]}</span>
              {/if}
              <div class="row">
                <button type="button" class="strong" disabled={working} onclick={() => run(u, a)}>
                  {working ? 'Working…' : `Yes, ${ACTION_LABEL[a].replace('…', '').toLowerCase()}`}</button>
                <button type="button" class="link" onclick={() => { pending = ''; newPw = ''; }}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="row actions">
              {#each actionsFor(u) as a}
                <button type="button" disabled={working} class:strong={a === 'approve'} onclick={() => ask(u, a)}>
                  {ACTION_LABEL[a]}</button>
              {/each}
            </div>
          {/if}
        {/if}
      </li>
    {:else}
      {#if !loading}<li class="facts">No accounts.</li>{/if}
    {/each}
  </ul>

  <details class="log">
    <summary>Admin log ({log.length})</summary>
    {#if log.length}
      <ol>
        {#each log as e}
          <li><span class="t">{when(e.at)}</span> {e.admin}: <b>{e.action.replace('_', ' ')}</b>
            {e.target ?? '(removed account)'}{#if e.detail}{' '}<span class="dim">({e.detail})</span>{/if}</li>
        {/each}
      </ol>
    {:else}
      <p class="facts">No admin actions yet.</p>
    {/if}
  </details>
</dialog>

<style>
  dialog.admin {
    margin: auto; /* the app's reset zeroes it, which would pin the dialog top-left */
    width: min(760px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto;
    background: var(--bg2); color: var(--ink); border: 1px solid var(--line); border-radius: 10px;
    padding: 14px 16px; box-shadow: 0 12px 36px #000a; font-size: 13px;
  }
  dialog.admin::backdrop { background: #0008; }
  header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; text-wrap: balance; }
  .count { font-size: 12px; font-weight: normal; color: var(--gold); margin-left: 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  button {
    background: var(--bg); color: var(--gold); border: 1px solid var(--gold-dim);
    border-radius: 14px; padding: 4px 12px; font-size: 12px;
  }
  button.strong { background: var(--gold-dim); color: var(--bg); border-color: var(--gold); }
  button:disabled { opacity: .6; cursor: default; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
  button.link { background: none; border: none; padding: 0; color: var(--dim); text-decoration: underline; }
  ul.users { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
  ul.users > li {
    display: grid; gap: 5px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--bg); min-width: 0;
  }
  ul.users > li.attention { border-color: var(--gold-dim); }
  .who { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; overflow-wrap: anywhere; }
  .facts { color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
  .warn { color: var(--square); }
  .badge { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold);
    border: 1px solid var(--gold-dim); border-radius: 8px; padding: 0 6px; }
  .badge.dim { color: var(--dim); border-color: var(--line); }
  .badge.state-pending { color: var(--ink); border-color: var(--gold); }
  .badge.state-frozen, .badge.state-deleting { color: var(--square); border-color: var(--square); }
  .confirm { display: grid; gap: 6px; padding: 6px 0 0; }
  label { display: grid; gap: 3px; font-size: 11px; color: var(--dim); }
  input {
    background: var(--bg2); border: 1px solid var(--line); color: var(--ink);
    border-radius: 6px; padding: 5px 8px; font-size: 14px; max-width: 320px;
  }
  .ok { color: var(--ink); border-left: 2px solid var(--gold); padding-left: 8px; margin: 10px 0 0; }
  .err { color: var(--square); margin: 10px 0 0; }
  details.log { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; }
  summary { cursor: pointer; color: var(--dim); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  ol { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 4px; font-size: 12px; }
  .t { color: var(--dim); font-variant-numeric: tabular-nums; margin-right: 4px; }
  .dim { color: var(--dim); }
</style>
