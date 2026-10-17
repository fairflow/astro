/**
 * Sign-in state for the server API (api/, docs/DESIGN.md §5a). The API sits
 * beside the app (`api/` relative to the page), so it exists only where the
 * app is served with it: fairflow.co.uk/astro and the local dev setup. Where
 * there is no API, `status` is 'unavailable' and the account UI stays hidden.
 */

const API = 'api/';

export type AccountStatus = 'checking' | 'unavailable' | 'signedOut' | 'signedIn';

export const account = $state<{ status: AccountStatus; email: string; busy: boolean; error: string }>({
  status: 'checking', email: '', busy: false, error: '',
});

/** What to tell the reader for a failed sign-in response. */
export function signInMessage(status: number, body: unknown): string {
  const retry = (body as { retryAfter?: unknown } | null)?.retryAfter;
  if (status === 401) return 'Wrong email or password.';
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
  const email = (user as { email?: unknown } | null)?.email;
  if (typeof email === 'string') { account.status = 'signedIn'; account.email = email; }
  else { account.status = 'signedOut'; account.email = ''; }
}

export async function refreshAccount(): Promise<void> {
  try {
    const r = await fetch(`${API}me.php`, { credentials: 'same-origin', cache: 'no-store' });
    const j = r.ok ? await jsonOf(r) : null;
    if (!j || !('user' in j)) { account.status = 'unavailable'; return; }
    signedInAs(j.user);
  } catch {
    account.status = 'unavailable';
  }
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

export async function signOut(): Promise<void> {
  account.busy = true; account.error = '';
  try {
    const r = await post('logout.php', {});
    if (r.ok) { account.status = 'signedOut'; account.email = ''; }
    else account.error = `Sign-out failed (HTTP ${r.status}).`;
  } catch {
    account.error = 'Could not reach the server.';
  } finally {
    account.busy = false;
  }
}
