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

export const account = $state<{
  status: AccountStatus; email: string; state: AccountState; admin: boolean; busy: boolean; error: string;
}>({
  status: 'checking', email: '', state: 'active', admin: false, busy: false, error: '',
});

/** What to tell the reader for a failed sign-in response. */
export function signInMessage(status: number, body: unknown): string {
  const retry = (body as { retryAfter?: unknown } | null)?.retryAfter;
  if (status === 401) return 'Wrong email or password.';
  // a correct password on an account that cannot sign in (pending, frozen, deleting): the server says why
  const message = (body as { message?: unknown } | null)?.message;
  if (status === 403 && typeof message === 'string') return message;
  if (status === 429) {
    const mins = typeof retry === 'number' ? Math.max(1, Math.ceil(retry / 60)) : 15;
    return `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
  }
  if (status === 400) return 'Enter your email and password.';
  return `Sign-in failed (HTTP ${status}). Try again later.`;
}

/** A JSON reply from the API, or null when the response is not one (no API here). */
async function jsonOf(r: Response): Promise<Record<string, unknown> | null> {
  if (!(r.headers.get('content-type') ?? '').includes('application/json')) return null;
  try { return await r.json() as Record<string, unknown>; } catch { return null; }
}

function signedInAs(user: unknown): void {
  const u = user as { email?: unknown; status?: unknown; role?: unknown } | null;
  if (typeof u?.email === 'string') {
    account.status = 'signedIn'; account.email = u.email;
    account.state = u.status === 'paused' ? 'paused' : 'active';
    account.admin = u.role === 'admin';
  } else {
    account.status = 'signedOut'; account.email = ''; account.state = 'active'; account.admin = false;
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

export async function signIn(email: string, password: string): Promise<boolean> {
  account.busy = true; account.error = '';
  try {
    const r = await post('login.php', { email, password });
    const j = await jsonOf(r);
    if (r.ok && j) { signedInAs(j.user); return true; }
    account.error = signInMessage(r.status, j);
    return false;
  } catch {
    account.error = 'Could not reach the server. Check your connection.';
    return false;
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
