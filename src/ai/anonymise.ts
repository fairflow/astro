/**
 * Literal, non-regex redaction for snapshots sent to the AI.
 *
 * Caveat the user raised (2026-10-15): even with names and places removed, a
 * birthplace is still *computable* from an exact chart — the Ascendant and
 * house cusps encode latitude/longitude given the birth moment. So this is
 * not true anonymity; it removes the explicit identifiers (names, place text)
 * while leaving the astrology intact, and the reading still gets a name to
 * address (a pseudonym). Turning the toggle off sends the real names.
 */
export interface Redaction {
  /** Exact substring to remove (literal, not a pattern). Blank entries are ignored. */
  find: string;
  /** What to put in its place. */
  replace: string;
}

/**
 * Replace every occurrence of each `find` with its `replace`, as plain-string
 * substitution (no regex, so names containing regex metacharacters are safe).
 * Longest finds are applied first so a short name that is a substring of a
 * longer one cannot pre-empt it.
 */
export function redact(text: string, redactions: Redaction[]): string {
  const active = redactions
    .filter(r => r.find.trim().length > 0 && r.find !== r.replace)
    .sort((a, b) => b.find.length - a.find.length);
  let out = text;
  for (const r of active) out = out.split(r.find).join(r.replace);
  return out;
}
