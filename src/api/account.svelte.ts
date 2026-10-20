/**
 * Sign-in state for the server API (api/, docs/DESIGN.md §5a). The API sits
 * beside the app (`api/` relative to the page), so it exists only where the
 * app is served with it: fairflow.co.uk/astro and the local dev setup. Where
 * there is no API, `status` is 'unavailable' and the account UI stays hidden.
 */

const API = 'api/';

/** 'unreachable': the API exists but could not answer just now (offline, server
 *  error). Not a sign-out: the session is kept and checked again later. */
export type AccountStatus = 'checking' | 'unavailable' | 'unreachable' | 'signedOut' | 'signedIn';

/** The account's state on the server (docs/DESIGN.md §5a); only active and paused accounts can be signed in. */
export type AccountState = 'active' | 'paused';

/**
 * twoStep: signing in takes an emailed code after the password (always for
 * admins). verified: this session passed that step; admin pages need it.
 */
export const account = $state<{
  status: AccountStatus; email: string; state: AccountState; admin: boolean;
  twoStep: boolean; verified: boolean; busy: boolean; error: string;
  /** The last sign-in met an account closed by its owner, still in its 30 days: offer to cancel. */
  canCancel: boolean;
  /** A message that is not an error (account closed, removal cancelled), shown until the next action. */
  notice: string;
}>({
  status: 'checking', email: '', state: 'active', admin: false, twoStep: false, verified: false, busy: false, error: '',
  canCancel: false, notice: '',
});

/** What to tell the reader for a failed sign-in response. */
export function signInMessage(status: number, body: unknown): string {
  const retry = (body as { retryAfter?: unknown } | null)?.retryAfter;
  if (status === 401) return 'Wrong email or password.';
  // a correct password on an account that cannot sign in (pending, frozen, deleting): the server says why
  const message = (body as { message?: unknown } | null)?.message;
  if (status === 403 && typeof message === 'string') return message;
  if (status === 429 && typeof message === 'string') return message;
  if (status === 429) {
    const mins = typeof retry === 'number' ? Math.max(1, Math.ceil(retry / 60)) : 15;
    return `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
  }
  if (status === 400 && typeof message === 'string') return message;
  if (status === 400) return 'Enter your email and password.';
  return `Sign-in failed (HTTP ${status}). Try again later.`;
}

/** A JSON reply from the API, or null when the response is not one (no API here). */
async function jsonOf(r: Response): Promise<Record<string, unknown> | null> {
  if (!(r.headers.get('content-type') ?? '').includes('application/json')) return null;
  try { return await r.json() as Record<string, unknown>; } catch { return null; }
}

function signedInAs(user: unknown): void {
  const u = user as { email?: unknown; status?: unknown; role?: unknown; twoStep?: unknown; verified?: unknown } | null;
  if (typeof u?.email === 'string') {
    account.status = 'signedIn'; account.email = u.email;
    account.state = u.status === 'paused' ? 'paused' : 'active';
    account.admin = u.role === 'admin';
    account.twoStep = u.twoStep === true; account.verified = u.verified === true;
  } else {
    account.status = 'signedOut'; account.email = ''; account.state = 'active'; account.admin = false;
    account.twoStep = false; account.verified = false;
  }
}

export async function refreshAccount(): Promise<void> {
  try {
    const r = await fetch(`${API}me.php`, { credentials: 'same-origin', cache: 'no-store' });
    const j = await jsonOf(r);
    if (r.ok && j && 'user' in j) { signedInAs(j.user); return; }
    // a JSON error means the API is here but failing; anything else, no API here
    account.status = j ? 'unreachable' : (account.status === 'checking' ? 'unavailable' : 'unreachable');
  } catch {
    // offline or the request failed: keep any known sign-in, check again later
    if (account.status !== 'checking' && account.status !== 'unavailable') account.status = 'unreachable';
    else account.status = 'unavailable';
  }
}

// check again when the page comes back into view (phones suspend pages; the
// connection may have returned)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && account.status !== 'unavailable' && account.status !== 'checking') void refreshAccount();
  });
}

const post = (path: string, body: unknown) => fetch(API + path, {
  method: 'POST', credentials: 'same-origin', cache: 'no-store',
  headers: { 'content-type': 'application/json', 'x-astro': '1' },
  body: JSON.stringify(body),
});

/**
 * Sign in. 'code': the password was right and a code has been emailed; call
 * again with the same email and password and the code (`code` holds the
 * server's note). 'done': signed in. false: refused (see account.error).
 */
export async function signIn(email: string, password: string, code?: string): Promise<{ result: 'done' | 'code'; note: string } | false> {
  account.busy = true; account.error = ''; account.canCancel = false; account.notice = '';
  try {
    const r = await post('login.php', code === undefined ? { email, password } : { email, password, code });
    const j = await jsonOf(r);
    if (r.ok && j?.step === 'code') return { result: 'code', note: typeof j.message === 'string' ? j.message : '' };
    if (r.ok && j) { signedInAs(j.user); return { result: 'done', note: '' }; }
    account.error = signInMessage(r.status, j);
    account.canCancel = r.status === 403 && j?.canCancel === true;
    return false;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return false;
  } finally {
    account.busy = false;
  }
}

/** A POST whose success carries {message}; returns it, or null with account.error set. */
async function messageCall(path: string, body: unknown): Promise<string | null> {
  account.busy = true; account.error = '';
  try {
    const r = await post(path, body);
    const j = await jsonOf(r);
    if (r.ok && j && typeof j.message === 'string') return j.message;
    account.error = typeof j?.message === 'string' ? j.message : `Failed (HTTP ${r.status}). Try again later.`;
    return null;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return null;
  } finally {
    account.busy = false;
  }
}

/** Register: a code is emailed to the address (or, if it has an account, a notice). Returns the server's note. */
export const register = (email: string, password: string) => messageCall('register.php', { email, password });

/** Confirm a registration with the emailed code (and the password just chosen); the account then waits for approval. */
export const confirmRegistration = (email: string, password: string, code: string) =>
  messageCall('register_confirm.php', { email, password, code });

/** Change this account's password (needs the current one); other sessions end. Returns the server's note. */
export const changePassword = (current: string, password: string) =>
  messageCall('account_password.php', { current, password });

/** Close this account: removed in 30 days, signed out now. Returns the server's note. */
export async function closeAccount(password: string): Promise<string | null> {
  const note = await messageCall('account_close.php', { password });
  if (note) { signedInAs(null); account.notice = note; }
  return note;
}

/** Cancel the removal of a closed account during its 30 days. Returns the server's note. */
export async function reopenAccount(email: string, password: string): Promise<string | null> {
  const note = await messageCall('account_reopen.php', { email, password });
  if (note) { account.canCancel = false; account.notice = note; }
  return note;
}

/** Everything stored for the account (account_export.php), or null with account.error set. */
export async function exportData(): Promise<Record<string, unknown> | null> {
  account.busy = true; account.error = '';
  try {
    const r = await fetch(`${API}account_export.php`, { credentials: 'same-origin', cache: 'no-store' });
    const j = await jsonOf(r);
    if (r.ok && j) return j;
    account.error = `Download failed (HTTP ${r.status}).`;
    return null;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return null;
  } finally {
    account.busy = false;
  }
}

/** Turn two-step sign-in on or off for this account. */
export async function setTwoStep(on: boolean): Promise<void> {
  account.busy = true; account.error = '';
  try {
    const r = await post('two_step.php', { on });
    const j = await jsonOf(r);
    if (r.ok && j) signedInAs(j.user);
    else account.error = typeof j?.message === 'string' ? j.message : `Failed (HTTP ${r.status}).`;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
  } finally {
    account.busy = false;
  }
}

/** Ask for a password-reset code. The answer is the same whether or not the address has an account. */
export async function requestReset(email: string): Promise<string | null> {
  account.busy = true; account.error = '';
  try {
    const r = await post('reset_request.php', { email });
    const j = await jsonOf(r);
    if (r.ok && j && typeof j.message === 'string') return j.message;
    account.error = typeof j?.error === 'string' && r.status === 400 ? 'Enter your email address.' : `Request failed (HTTP ${r.status}).`;
    return null;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return null;
  } finally {
    account.busy = false;
  }
}

/** Set a new password with the emailed code; on success the browser is signed in. */
export async function confirmReset(email: string, code: string, password: string): Promise<boolean> {
  account.busy = true; account.error = '';
  try {
    const r = await post('reset_confirm.php', { email, code, password });
    const j = await jsonOf(r);
    if (r.ok && j) { signedInAs(j.user); return true; }
    account.error = typeof j?.message === 'string' ? j.message : `Failed (HTTP ${r.status}).`;
    return false;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return false;
  } finally {
    account.busy = false;
  }
}

export async function signOut(): Promise<void> {
  account.busy = true; account.error = '';
  try {
    const r = await post('logout.php', {});
    if (r.ok) signedInAs(null);
    else account.error = `Sign-out failed (HTTP ${r.status}).`;
  } catch {
    account.error = 'Could not reach the server.';
  } finally {
    account.busy = false;
  }
}
