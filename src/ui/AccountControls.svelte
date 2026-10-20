<script lang="ts">
  import {
    account, confirmRegistration, confirmReset, register, requestReset, setTwoStep, signIn, signOut,
  } from '../api/account.svelte';
  import AdminPanel from './AdminPanel.svelte';

  // Sign in to the Astrodynamics server (only where the app is served with its
  // API; see account.svelte.ts), register, or reset a forgotten password. Every
  // emailed code goes in the same kind of field (autocomplete=one-time-code).
  type Mode = 'signin' | 'code' | 'reset-ask' | 'reset-set' | 'register' | 'register-code' | 'registered';
  let mode = $state<Mode>('signin');
  let email = $state('');
  let password = $state('');
  let password2 = $state('');
  let code = $state('');
  let sentNote = $state('');
  let adminOpen = $state(false);

  function go(m: Mode) { mode = m; code = ''; account.error = ''; if (m === 'signin') { password2 = ''; sentNote = ''; } }

  async function submitSignIn(e: SubmitEvent) {
    e.preventDefault();
    const r = await signIn(email, password, mode === 'code' ? code : undefined);
    if (r && r.result === 'code') { sentNote = r.note; code = ''; mode = 'code'; }
    else if (r) { password = code = ''; mode = 'signin'; }
  }
  async function resendSignInCode() {
    const r = await signIn(email, password);
    if (r && r.result === 'code') { sentNote = r.note; code = ''; }
  }
  async function askResetCode(e: SubmitEvent) {
    e.preventDefault();
    const note = await requestReset(email);
    if (note) { sentNote = note; mode = 'reset-set'; }
  }
  async function setPassword(e: SubmitEvent) {
    e.preventDefault();
    if (password !== password2) { account.error = 'The two passwords differ.'; return; }
    if (await confirmReset(email, code, password)) { mode = 'signin'; code = password = password2 = ''; }
  }
  async function submitRegister(e?: SubmitEvent) {
    e?.preventDefault();
    if (password !== password2) { account.error = 'The two passwords differ.'; return; }
    const note = await register(email, password);
    if (note) { sentNote = note; code = ''; mode = 'register-code'; }
  }
  async function submitRegisterCode(e: SubmitEvent) {
    e.preventDefault();
    const note = await confirmRegistration(email, password, code);
    if (note) { sentNote = note; password = password2 = code = ''; mode = 'registered'; }
  }
</script>

{#snippet codeField(label: string)}
  <label for="acct-code">{label}
    <input id="acct-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="8"
      required bind:value={code}>
  </label>
{/snippet}
{#snippet privacy()}<a href="privacy/" target="_blank" rel="noopener">Privacy notice</a>{/snippet}

{#if account.status === 'signedIn'}
  <div class="acct">
    <p>Signed in as <b>{account.email}</b>{#if account.admin}{' '}<span class="badge">admin</span>{/if}.</p>
    {#if account.state === 'paused'}
      <p class="note">This account is paused: you can read and download your data, but not add to it.</p>
    {/if}
    <label class="check">
      <input type="checkbox" checked={account.twoStep} disabled={account.admin || account.busy}
        onchange={(e) => setTwoStep(e.currentTarget.checked)}>
      <span>Ask for an emailed code each time I sign in{#if account.admin}{' '}(always on for admins){/if}</span>
    </label>
    {#if account.admin}
      {#if account.verified}
        <button type="button" onclick={() => adminOpen = true}>Admin panel</button>
        <AdminPanel bind:open={adminOpen} />
      {:else}
        <p class="note">To use the admin panel, sign out and sign in again with the emailed code.</p>
      {/if}
    {/if}
    <button type="button" onclick={signOut} disabled={account.busy}>Sign out</button>
    <p class="hint">Saving readings to your account comes next; for now they stay in this browser.
      {@render privacy()}</p>
  </div>
{:else if account.status === 'signedOut' && mode === 'code'}
  <form class="acct" onsubmit={submitSignIn}>
    <p class="hint">{sentNote}</p>
    {@render codeField('Code from the email')}
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Checking…' : 'Sign in'}</button>
      <button type="button" class="link" onclick={resendSignInCode} disabled={account.busy}>Send a new code</button>
      <button type="button" class="link" onclick={() => go('signin')}>Back</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && mode === 'reset-ask'}
  <form class="acct" onsubmit={askResetCode}>
    <p>We'll email you a code to set a new password.</p>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Sending…' : 'Email me a code'}</button>
      <button type="button" class="link" onclick={() => go('signin')}>Back to sign in</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && mode === 'reset-set'}
  <form class="acct" onsubmit={setPassword}>
    <p class="hint">{sentNote}</p>
    {@render codeField('Code from the email')}
    <label for="acct-newpw">New password (at least 10 characters)
      <input id="acct-newpw" type="password" autocomplete="new-password" minlength="10" required bind:value={password}>
    </label>
    <label for="acct-newpw2">New password again
      <input id="acct-newpw2" type="password" autocomplete="new-password" minlength="10" required bind:value={password2}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Saving…' : 'Set password and sign in'}</button>
      <button type="button" class="link" onclick={() => go('reset-ask')}>Send a new code</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && mode === 'register'}
  <form class="acct" onsubmit={submitRegister}>
    <p>Create an account. We'll email a code to confirm the address; then the site owner approves the
      account, and you'll get an email when that is done.</p>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <label for="acct-newpw">Password (at least 10 characters)
      <input id="acct-newpw" type="password" autocomplete="new-password" minlength="10" required bind:value={password}>
    </label>
    <label for="acct-newpw2">Password again
      <input id="acct-newpw2" type="password" autocomplete="new-password" minlength="10" required bind:value={password2}>
    </label>
    <p class="hint">Passwords found in known data breaches are refused. Before registering, read the {@render privacy()}.</p>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Sending…' : 'Register'}</button>
      <button type="button" class="link" onclick={() => go('signin')}>Back to sign in</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && mode === 'register-code'}
  <form class="acct" onsubmit={submitRegisterCode}>
    <p class="hint">{sentNote}</p>
    {@render codeField('Code from the email')}
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Checking…' : 'Confirm address'}</button>
      <button type="button" class="link" onclick={() => submitRegister()} disabled={account.busy}>Send a new code</button>
      <button type="button" class="link" onclick={() => go('signin')}>Back</button>
    </div>
  </form>
{:else if account.status === 'signedOut' && mode === 'registered'}
  <div class="acct">
    <p class="note">{sentNote}</p>
    <button type="button" class="link" onclick={() => go('signin')}>Back to sign in</button>
  </div>
{:else if account.status === 'signedOut'}
  <form class="acct" onsubmit={submitSignIn}>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <label for="acct-password">Password
      <input id="acct-password" type="password" autocomplete="current-password" required bind:value={password}>
    </label>
    <div class="row">
      <button type="submit" disabled={account.busy}>{account.busy ? 'Signing in…' : 'Sign in'}</button>
      <button type="button" class="link" onclick={() => go('reset-ask')}>Forgot password?</button>
      <button type="button" class="link" onclick={() => { go('register'); password = ''; }}>Create an account</button>
    </div>
    <p class="hint">New accounts are approved by the site owner. {@render privacy()}</p>
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
  label.check { display: flex; gap: 8px; align-items: flex-start; text-transform: none; letter-spacing: normal;
    font-size: 12.5px; color: var(--ink); }
  label.check input { margin: 2px 0 0; }
</style>
