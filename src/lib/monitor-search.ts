/**
 * Narrowing the monitor index by a typed query.
 *
 * Sorting alone stops helping once you know which monitor you want: no
 * ordering of 279 rows puts *that* one on top. Search answers a different
 * question — "where is this one" rather than "what needs attention".
 *
 * Matched against name, monitor id and service together, because those are the
 * three things a person has in hand when they arrive here: a name from an
 * alert, an id from a Datadog URL, a service from a Slack thread. All three are
 * already shown on the row, so nothing matches invisibly.
 *
 * Substring matching on the id is right here, unlike in cause-report.ts, where
 * `titleMatchesMonitor` insists on whole tokens: there the id decides which
 * monitor a page of findings belongs to, and `1435` claiming `143509449` would
 * attach one monitor's investigation to another. A search that surfaces both
 * for `1435` costs a glance; a lookup that picks the wrong one costs a wrong
 * conclusion.
 */

export interface SearchableMonitor {
  id: string;
  name: string;
  service: string | null;
}

/**
 * Query terms, lowercased. Empty when nothing was typed.
 *
 * Split on whitespace and required to *all* match, so "notification p90" finds
 * a monitor whose name contains both, in either order. A single substring
 * would fail on it: the words are ten characters apart in the real name, and
 * a hyphen sits where the space was typed.
 */
export function searchTerms(query: string | undefined): string[] {
  return (query ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function haystack(m: SearchableMonitor): string {
  return `${m.name} ${m.id} ${m.service ?? ""}`.toLowerCase();
}

/** Rows matching every term. Returns the input's order, and never mutates it. */
export function filterMonitors<T extends SearchableMonitor>(
  rows: T[],
  query: string | undefined,
): T[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return rows;
  return rows.filter((m) => {
    const text = haystack(m);
    return terms.every((t) => text.includes(t));
  });
}
