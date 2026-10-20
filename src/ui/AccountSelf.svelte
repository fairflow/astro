<script lang="ts">
  import { account, changePassword, closeAccount, exportData } from '../api/account.svelte';
  import { readingsMarkdown } from '../api/exportmd';

  // "Your account and data" (astro-tbb.5): download everything stored for the
  // account, change the password, close the account (removed after 30 days,
  // cancellable by signing in again). The server checks every step.
  let current = $state('');
  let pw = $state('');
  let pw2 = $state('');
  let closePw = $state('');
  let armed = $state(false);
  let note = $state('');

  function save(name: string, type: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function download(kind: 'json' | 'md') {
    note = '';
    const d = await exportData();
    if (!d) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'json') save(`astrodynamics-account-${stamp}.json`, 'application/json', JSON.stringify(d, null, 2));
    else {
      const acc = d.account as { email?: string } | undefined;
      save(`astrodynamics-readings-${stamp}.md`, 'text/markdown',
        readingsMarkdown(acc?.email ?? account.email, String(d.exportedAt ?? ''), (d.readings ?? []) as never[]));
    }
  }

  async function submitPassword(e: SubmitEvent) {
    e.preventDefault(); note = '';
    if (pw !== pw2) { account.error = 'The two new passwords differ.'; return; }
    const m = await changePassword(current, pw);
    if (m) { note = m; current = pw = pw2 = ''; }
  }

  async function submitClose(e: SubmitEvent) {
    e.preventDefault(); note = '';
    if (!armed) { armed = true; return; }
    armed = false;
    await closeAccount(closePw);
    closePw = '';
  }
</script>

<details class="self">
  <summary>Your account and data</summary>
  <div class="body">
    <section>
      <h4>Download my data</h4>
      <p class="hint">Everything stored for your account on our server.</p>
      <div class="row">
        <button type="button" disabled={account.busy} onclick={() => download('json')}>All data (JSON)</button>
        <button type="button" disabled={account.busy} onclick={() => download('md')}>Readings (Markdown)</button>
      </div>
    </section>

    <form onsubmit={submitPassword}>
      <h4>Change password</h4>
      <input type="text" autocomplete="username" value={account.email} hidden readonly>
      <label>Current password
        <input type="password" autocomplete="current-password" required bind:value={current}>
      </label>
      <label>New password (at least 10 characters)
        <input type="password" autocomplete="new-password" minlength="10" required bind:value={pw}>
      </label>
      <label>New password again
        <input type="password" autocomplete="new-password" minlength="10" required bind:value={pw2}>
      </label>
      <button type="submit" disabled={account.busy}>Change password</button>
      <p class="hint">Your other devices are signed out; this one stays signed in.</p>
    </form>

    {#if !account.admin}
      <form onsubmit={submitClose}>
        <h4>Close my account</h4>
        <p class="hint">Download your data first if you want a copy. The account is signed out everywhere at once and
          removed, with everything stored for it, after 30 days. Until then you can cancel by signing in again.</p>
        <label>Password
          <input type="password" autocomplete="current-password" required bind:value={closePw}>
        </label>
        {#if armed}<p class="warn">Close the account? Press again to confirm.</p>{/if}
        <div class="row">
          <button type="submit" class:danger={armed} disabled={account.busy}>{armed ? 'Yes, close my account' : 'Close my account'}</button>
          {#if armed}<button type="button" class="link" onclick={() => armed = false}>Keep it</button>{/if}
        </div>
      </form>
    {/if}
    {#if note}<p class="ok" role="status">{note}</p>{/if}
  </div>
</details>

<style>
  .self { font-size: 13px; }
  summary { cursor: pointer; color: var(--dim); font-size: 12.5px; }
  summary:hover { color: var(--gold); }
  .body { display: grid; gap: 14px; padding-top: 8px; }
  section, form { display: grid; gap: 7px; }
  h4 { margin: 0; font-size: 12px; font-weight: 600; color: var(--ink); }
  p { margin: 0; }
  .hint { color: var(--dim); font-size: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  label { display: grid; gap: 3px; font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .08em; }
  input {
    background: var(--bg); border: 1px solid var(--line); color: var(--ink);
    border-radius: 6px; padding: 6px 9px; font-size: 14px; text-transform: none; letter-spacing: normal;
  }
  button {
    justify-self: start; background: var(--bg); color: var(--gold); border: 1px solid var(--gold-dim);
    border-radius: 14px; padding: 5px 14px; font-size: 12.5px;
  }
  button.danger { color: var(--square); border-color: var(--square); }
  button.link { background: none; border: none; padding: 0; color: var(--dim); text-decoration: underline; }
  button:disabled { opacity: .6; cursor: default; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
  .warn { color: var(--square); font-size: 12.5px; }
  .ok { color: var(--ink); border-left: 2px solid var(--gold); padding-left: 8px; font-size: 12.5px; }
</style>
