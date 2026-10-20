<script lang="ts">
  import { account, confirmReset, requestReset, signIn, signOut } from '../api/account.svelte';

  // Sign in to the Astrodynamics server (only where the app is served with its
  // API; see account.svelte.ts). Accounts are created by invitation.
  let email = $state('');
  let password = $state('');
  // forgotten password: 'ask' for a code, then 'set' a new password with it
  let reset = $state<'' | 'ask' | 'set'>('');
  let sentNote = $state('');
  let code = $state('');
  let newPw = $state('');
  let newPw2 = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (await signIn(email, password)) password = '';
  }
  async function askCode(e: SubmitEvent) {
    e.preventDefault();
    const note = await requestReset(email);
    if (note) { sentNote = note; reset = 'set'; }
  }
  async function setPassword(e: SubmitEvent) {
    e.preventDefault();
    if (newPw !== newPw2) { account.error = 'The two passwords differ.'; return; }
    if (await confirmReset(email, code, newPw)) { reset = ''; code = newPw = newPw2 = password = ''; }
  }
  function startReset() { reset = 'ask'; account.error = ''; }
  function cancelReset() { reset = ''; code = newPw = newPw2 = ''; account.error = ''; }
</script>

{#if account.status === 'signedIn'}
  <div class="acct">
    <p>Signed in as <b>{account.email}</b>{#if account.admin} <span class="badge">admin</span>{/if}.</p>
    {#if account.state === 'paused'}
      <p class="note">This account is paused: you can read and download your data, but not add to it.</p>
    {/if}
    <button type="button" onclick={signOut} disabled={account.busy}>Sign out</button>
    <p class="hint">Saving readings to your account comes next; for now they stay in this browser.
      <a href="privacy/" target="_blank" rel="noopener">Privacy notice</a></p>
  </div>
{:else if account.status === 'signedOut' && reset === 'ask'}
  <form class="acct" onsubmit={askCode}>
    <p>We'll email you a code to set a new password.</p>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Sending…' : 'Email me a code'}</button>
      <button type="button" class="link" onclick={cancelReset}>Back to sign in</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && reset === 'set'}
  <form class="acct" onsubmit={setPassword}>
    <p class="hint">{sentNote}</p>
    <label for="acct-code">Code from the email
      <input id="acct-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="8"
        required bind:value={code}>
    </label>
    <label for="acct-newpw">New password (at least 10 characters)
      <input id="acct-newpw" type="password" autocomplete="new-password" minlength="10" required bind:value={newPw}>
    </label>
    <label for="acct-newpw2">New password again
      <input id="acct-newpw2" type="password" autocomplete="new-password" minlength="10" required bind:value={newPw2}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Saving…' : 'Set password and sign in'}</button>
      <button type="button" class="link" onclick={() => reset = 'ask'}>Send a new code</button>
    </div>
  </form>
{:else if account.status === 'signedOut'}
  <form class="acct" onsubmit={submit}>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <label for="acct-password">Password
      <input id="acct-password" type="password" autocomplete="current-password" required bind:value={password}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Signing in…' : 'Sign in'}</button>
      <button type="button" class="link" onclick={startReset}>Forgot password?</button>
    </div>
    <p class="hint">Accounts are by invitation. <a href="privacy/" target="_blank" rel="noopener">Privacy notice</a></p>
  </form>
{:else if account.status === 'unreachable'}
  <p class="hint">Could not check your sign-in just now (offline or a server problem). You stay signed
    in; it is checked again when you come back to the page.</p>
{/if}
{#if account.error}<p class="err" role="alert">{account.error}</p>{/if}

<style>
  .acct { display: grid; gap: 8px; font-size: 13px; }
  .acct p { margin: 0; }
  label { display: grid; gap: 3px; font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .08em; }
  input {
    background: var(--bg); border: 1px solid var(--line); color: var(--ink);
    border-radius: 6px; padding: 6px 9px; font-size: 14px; text-transform: none; letter-spacing: normal;
  }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
  button {
    justify-self: start; background: var(--bg); color: var(--gold); border: 1px solid var(--gold-dim);
    border-radius: 14px; padding: 5px 14px; font-size: 12.5px;
  }
  button:disabled { opacity: .6; cursor: default; }
  .row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
  button.link { background: none; border: none; padding: 0; color: var(--dim); text-decoration: underline;
    font-size: 12.5px; }
  button.link:hover { color: var(--gold); }
  .hint { color: var(--dim); font-size: 12px; }
  .hint a { color: var(--gold); }
  .note { color: var(--ink); font-size: 12.5px; border-left: 2px solid var(--gold-dim); padding-left: 8px; }
  .badge { font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--gold);
    border: 1px solid var(--gold-dim); border-radius: 8px; padding: 0 6px; }
  .err { color: var(--square); font-size: 12.5px; margin: 6px 0 0; }
</style>
