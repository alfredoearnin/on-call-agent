/**
 * Moving a monitor's pager: parsing the notify handles out of a Datadog monitor
 * message and substituting one for another.
 *
 * This is the only remediation the dashboard can actually carry out — Cortex
 * ownership is not writable from here, so retagging stays manual, but the
 * monitor is what wakes somebody up at 3am and that we can move.
 *
 * Kept pure and free of Prisma, config, and Datadog so the substitution rules
 * can be tested directly. The guarded write lives in monitor-routing-actions.
 */

/**
 * A Datadog notification handle: `@slack-team-alerts`, `@teams-oncall`,
 * `@webhook-incidentio-high`, or an email `@alice@earnin.com`.
 *
 * Every quantifier is bounded. This runs against monitor bodies fetched from
 * Datadog on a render path, and an unbounded alternation over attacker-shaped
 * text is how a regex stalls the event loop.
 */
const HANDLE_GLOBAL =
  /@[A-Za-z0-9][A-Za-z0-9._-]{0,62}(?:@[A-Za-z0-9][A-Za-z0-9.-]{0,62}\.[A-Za-z]{2,24})?/g;

/**
 * Anchored form of the same grammar, for validating operator input.
 *
 * The handle is substituted into a monitor message that Datadog then renders
 * and routes, so this is an allowlist and not a denylist: no whitespace, no
 * newline, and nothing that could open a `{{...}}` template or a second
 * directive.
 */
const HANDLE_EXACT =
  /^@[A-Za-z0-9][A-Za-z0-9._-]{0,62}(?:@[A-Za-z0-9][A-Za-z0-9.-]{0,62}\.[A-Za-z]{2,24})?$/;

export function isValidHandle(candidate: string): boolean {
  return HANDLE_EXACT.test(candidate);
}

/**
 * A Datadog monitor id, which is always a positive integer.
 *
 * The id is interpolated into the request path, and `fetch` resolves dot
 * segments before sending, so `../../../api/v2/team` would aim a PUT carrying
 * the write key at an endpoint nobody chose. The id arrives from a server
 * action, meaning any caller that can reach the origin can set it — so it is
 * checked against the grammar rather than assumed well-formed.
 */
export function isValidMonitorId(id: string): boolean {
  return /^[1-9][0-9]{0,19}$/.test(id);
}

/** Distinct handles in a monitor message, in the order they appear. */
export function extractHandles(message: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of message.matchAll(HANDLE_GLOBAL)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push(m[0]);
  }
  return out;
}

export interface RerouteResult {
  message: string;
  /** How many occurrences were substituted. Zero means nothing to write. */
  replaced: number;
}

/**
 * Replace every standalone occurrence of `from` with `to`.
 *
 * "Standalone" is the whole point, and it has two sides. A plain replace of
 * `@slack-growth` would corrupt `@slack-growth-alerts` into
 * `@slack-cashout-alerts`; checking only that side still lets `@earnin.com`
 * match inside `@alice@earnin.com` and rewrite a handle the operator never
 * selected. Both are the same failure — silently redirecting a page nobody
 * asked about — so a match counts only when neither neighbouring character
 * could continue a handle.
 */
export function rerouteMessage(
  message: string,
  from: string,
  to: string,
): RerouteResult {
  if (!isValidHandle(from) || !isValidHandle(to)) {
    return { message, replaced: 0 };
  }
  if (from === to) return { message, replaced: 0 };

  let replaced = 0;
  let out = "";
  let i = 0;

  while (i < message.length) {
    if (
      message.startsWith(from, i) &&
      !continuesHandle(message[i - 1]) &&
      !continuesHandle(message[i + from.length])
    ) {
      out += to;
      i += from.length;
      replaced += 1;
      continue;
    }
    out += message[i];
    i += 1;
  }

  return { message: out, replaced };
}

/** True when `ch` could extend a handle, so a match here is really a prefix. */
function continuesHandle(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return /[A-Za-z0-9._@-]/.test(ch);
}

/**
 * True when Datadog records `teamTag` on the monitor.
 *
 * `listMonitors` scopes its query with `monitor_tags`, but a read or write by
 * id bypasses that filter entirely — nothing else stops this app from
 * rerouting another team's pager. Tag comparison is case-insensitive because
 * Datadog lowercases tags on ingest but not always on read.
 */
export function isTeamMonitor(
  tags: string[] | undefined,
  teamTag: string,
): boolean {
  if (!tags || tags.length === 0) return false;
  const want = teamTag.trim().toLowerCase();
  if (want === "") return false;
  return tags.some((t) => t.trim().toLowerCase() === want);
}

/** Datadog priorities are 1 (highest) to 5. */
export function isValidPriority(p: number): boolean {
  return Number.isInteger(p) && p >= 1 && p <= 5;
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 — highest",
  2: "P2 — high",
  3: "P3 — moderate",
  4: "P4 — low",
  5: "P5 — lowest",
};
