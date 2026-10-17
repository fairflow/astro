<script lang="ts">
  import { account, signIn, signOut } from '../api/account.svelte';

  // Sign in to the Astrodynamics server (only where the app is served with its
  // API; see account.svelte.ts). Accounts are created by invitation.
  let email = $state('');
  let password = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (await signIn(email, password)) password = '';
  }
</script>

{#if account.status === 'signedIn'}
  <div class="acct">
    <p>Signed in as <b>{account.email}</b>.</p>
    <button type="button" onclick={signOut} disabled={account.busy}>Sign out</button>
    <p class="hint">Saving readings to your account comes next; for now they stay in this browser.</p>
  </div>
{:else if account.status === 'signedOut'}
  <form class="acct" onsubmit={submit}>
    <label for="acct-email">Email
      <input id="acct-email" type="email" autocomplete="username" required bind:value={email}>
    </label>
    <label for="acct-password">Password
      <input id="acct-password" type="password" autocomplete="current-password" required bind:value={password}>
    </label>
    <button type="submit" disabled={account.busy}>{account.busy ? 'Signing in…' : 'Sign in'}</button>
    <p class="hint">Accounts are by invitation.</p>
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
  .hint { color: var(--dim); font-size: 12px; }
  .err { color: var(--square); font-size: 12.5px; margin: 6px 0 0; }
</style>
