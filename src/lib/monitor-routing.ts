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
 * "Standalone" is the whole point: a plain string replace of `@slack-growth`
 * would corrupt `@slack-growth-alerts` into `@slack-cashout-alerts`, silently
 * redirecting a channel nobody asked about. A match only counts when the next
 * character cannot continue a handle.
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
