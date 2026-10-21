/**
 * The admin panel's calls (api/admin_*.php, astro-tbb.4). The server checks
 * on every request that the session belongs to an active admin and passed the
 * email-code step; nothing here is trusted for that.
 */

const API = 'api/';

export interface AdminUser {
  id: string; email: string; status: 'pending' | 'active' | 'paused' | 'frozen' | 'deleting'; role: 'user' | 'admin';
  created: number; lastSeen: number | null; deleteAfter: number | null;
  twoStep: boolean; confirmed: boolean; sessions: number;
}

export interface AdminLogEntry { admin: string; action: string; target: string | null; detail: string | null; at: number }

export type AdminAction = 'approve' | 'reject' | 'pause' | 'unpause' | 'freeze' | 'unfreeze' | 'delete'
  | 'cancel_delete' | 'set_password' | 'sign_out' | 'make_admin' | 'make_user';

/** The actions that fit an account in this state, in the order the panel shows them. */
export function actionsFor(u: AdminUser): AdminAction[] {
  const role: AdminAction[] = u.role === 'admin' ? ['make_user'] : u.status === 'active' ? ['make_admin'] : [];
  switch (u.status) {
    case 'pending': return u.confirmed ? ['approve', 'reject'] : ['reject'];
    case 'active': return ['pause', 'freeze', 'set_password', 'sign_out', 'delete', ...role];
    case 'paused': return ['unpause', 'freeze', 'set_password', 'sign_out', 'delete', ...role];
    case 'frozen': return ['unfreeze', 'set_password', 'delete', ...role];
    case 'deleting': return ['cancel_delete'];
  }
}

/** Button labels, and which actions ask "are you sure?" first. */
export const ACTION_LABEL: Record<AdminAction, string> = {
  approve: 'Approve', reject: 'Reject', pause: 'Pause', unpause: 'Unpause', freeze: 'Freeze', unfreeze: 'Unfreeze',
  delete: 'Delete', cancel_delete: 'Cancel deletion', set_password: 'Set password…', sign_out: 'Sign out everywhere',
  make_admin: 'Make admin', make_user: 'Remove admin',
};
export const CONFIRM: Partial<Record<AdminAction, string>> = {
  reject: 'Remove this registration now?',
  freeze: 'Freeze the account? It is signed out at once and cannot sign in.',
  delete: 'Delete the account? It is signed out, and removed with all its data after 30 days unless cancelled.',
  sign_out: 'End every session of this account?',
  make_admin: 'Give this account admin rights?',
  make_user: 'Take away admin rights?',
};

async function json(r: Response): Promise<Record<string, unknown>> {
  try { return await r.json() as Record<string, unknown>; } catch { return {}; }
}

function failure(r: Response, j: Record<string, unknown>): Error {
  return new Error(typeof j.message === 'string' ? j.message : `Failed (HTTP ${r.status}).`);
}

export async function listUsers(): Promise<AdminUser[]> {
  const r = await fetch(`${API}admin_users.php`, { credentials: 'same-origin', cache: 'no-store' });
  const j = await json(r);
  if (!r.ok || !Array.isArray(j.users)) throw failure(r, j);
  return j.users as AdminUser[];
}

export async function adminLog(): Promise<AdminLogEntry[]> {
  const r = await fetch(`${API}admin_log.php`, { credentials: 'same-origin', cache: 'no-store' });
  const j = await json(r);
  if (!r.ok || !Array.isArray(j.log)) throw failure(r, j);
  return j.log as AdminLogEntry[];
}

/** Usage for the admin panel (admin_usage.php): counts only. */
export interface AdminUsage {
  today: string;
  days: { day: string; preset: string; n: number }[];
  users: { id: string; email: string; ask24: number; ask7: number; ask30: number; models: Record<string, number>; readings: number; charts: number }[];
  states: Record<string, number>;
  presets: string[];
  limit: number;
}

export async function adminUsage(): Promise<AdminUsage> {
  const r = await fetch(`${API}admin_usage.php`, { credentials: 'same-origin', cache: 'no-store' });
  const j = await json(r);
  if (!r.ok || !Array.isArray(j.users)) throw failure(r, j);
  return j as unknown as AdminUsage;
}

/** Add an account by invitation; resolves to the server's message, or throws with its reason. */
export async function inviteUser(email: string): Promise<string> {
  const r = await fetch(`${API}admin_invite.php`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-astro': '1' }, body: JSON.stringify({ email }),
  });
  const j = await json(r);
  if (!r.ok) throw failure(r, j);
  return typeof j.message === 'string' ? j.message : 'Invitation sent.';
}

/** Run one action; resolves to the server's message, or throws with its reason. */
export async function adminAction(userId: string, action: AdminAction, password?: string): Promise<string> {
  const r = await fetch(`${API}admin_action.php`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-astro': '1' },
    body: JSON.stringify(password === undefined ? { userId, action } : { userId, action, password }),
  });
  const j = await json(r);
  if (!r.ok) throw failure(r, j);
  return typeof j.message === 'string' ? j.message : 'Done.';
}
