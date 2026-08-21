/**
 * Non-secret metadata for the two Cursor Automations, plus every pure decision the
 * re-run feature makes.
 *
 * Nothing here imports config, prisma, node:fs, or a secret. That is deliberate:
 * the house testing convention keeps the DB and mocking libraries out of tests, so
 * every judgement worth testing lives in this module and takes `now` as an
 * argument rather than reading the clock itself.
 */

import { AutomationKey } from "@/lib/constants";
import { HttpError } from "@/lib/clients/http";

export interface AutomationMeta {
  key: AutomationKey;
  /** 1-based run order. #1 must finish before #2, or #2 parses a stale page. */
  step: number;
  /** The name exactly as it reads in Cursor, so the user can find the run. */
  label: string;
  /** What the automation's output actually is — the thing health detection looks for. */
  produces: string;
  /** The repo file holding this automation's prompt. */
  promptFile: string;
}

export const AUTOMATIONS: readonly AutomationMeta[] = [
  {
    key: AutomationKey.HealthCheck,
    step: 1,
    label: "Growth Engineering Health Check",
    produces: "the Confluence handoff page",
    promptFile: "the agent prompt in agents/",
  },
  {
    key: AutomationKey.DashboardRefresh,
    step: 2,
    label: "On-call dashboard — daily refresh",
    produces: "a Daily refresh commit on main",
    promptFile: "agents/OnCall dashboard.md",
  },
] as const;

export function automationMeta(key: AutomationKey): AutomationMeta {
  const found = AUTOMATIONS.find((a) => a.key === key);
  if (!found) throw new Error(`unknown automation: ${key}`);
  return found;
}

/**
 * A server action is a public HTTP endpoint, so its arguments are untrusted. Same
 * reason applyRecommendationAction takes `scope: string` and normalizes it.
 */
export function isAutomationKey(value: unknown): value is AutomationKey {
  return (
    typeof value === "string" &&
    AUTOMATIONS.some((a) => a.key === (value as AutomationKey))
  );
}

/**
 * How long after #1 is triggered its Confluence page may still be stale. A guess,
 * not a measurement: a real Health Check run takes several minutes. Tune it once a
 * few re-runs have been timed.
 */
/**
 * How long a triggered Health Check may stay "in flight" before the warning starts
 * telling the operator to go look at the run instead of just waiting.
 *
 * This is NOT a settle timer any more. The warning clears on evidence — a handoff
 * page stamped later than the trigger — because Cursor gives us no completion
 * signal: the webhook returns no run id, there is no run-status API for
 * automations, and no callback on finish. A fixed window silently declared the run
 * finished whether or not anything had happened.
 */
export const HEALTH_CHECK_OVERDUE_MS = 20 * 60 * 1000;

/**
 * The warning shown on #2's button after #1 was fired from here.
 *
 * Clears only when `pageRefreshedAt` is newer than the trigger — that is the one
 * piece of proof available locally that the Health Check actually produced a page.
 * Note the proof only becomes visible once #2 has run and been pulled, so the
 * warning can legitimately outlive the run itself. That is the honest shape of it:
 * the dashboard cannot see Confluence, so it reports what it has not yet seen
 * rather than guessing from a clock.
 *
 * #2 is never disabled by this — two deliberate clicks means the user decides.
 * Minutes are computed arithmetically rather than via luxon's toRelative() so the
 * tests can pin the exact copy.
 */
export function staleHealthCheckWarning(
  lastHealthCheckTriggeredAt: Date | null,
  /** "Last refreshed" from the newest ingested page, if any. */
  pageRefreshedAt: Date | null,
  now: Date,
  overdueAfterMs: number = HEALTH_CHECK_OVERDUE_MS,
): string | null {
  if (!lastHealthCheckTriggeredAt) return null;
  const elapsed = now.getTime() - lastHealthCheckTriggeredAt.getTime();
  if (elapsed < 0) return null;

  // Proof the run landed: a page stamped after we asked for it.
  if (
    pageRefreshedAt &&
    pageRefreshedAt.getTime() > lastHealthCheckTriggeredAt.getTime()
  ) {
    return null;
  }

  const minutes = Math.floor(elapsed / 60_000);
  const when = minutes < 1 ? "just now" : `${minutes} min ago`;

  if (elapsed >= overdueAfterMs) {
    return `Health Check triggered ${when} and no newer page has reached the dashboard yet — check the run in Cursor.`;
  }
  return `Health Check triggered ${when} — its Confluence page may not be updated yet.`;
}

export const TRIGGER_DEBOUNCE_MS = 30_000;

/**
 * Whether a past attempt should block an immediate retry.
 *
 * The distinction is what we know about whether a run STARTED:
 *   - triggered            → a run started. Retrying duplicates it.
 *   - failed, with status  → Cursor answered and rejected it, so no run started.
 *                            Safe to retry at once (e.g. after fixing the header).
 *   - failed, no status    → a timeout or network error. The request may well have
 *                            landed, so treat it like a success and debounce.
 *   - blocked              → nothing was ever sent.
 */
export function blocksRetry(attempt: {
  status: string;
  httpStatus: number | null;
}): boolean {
  if (attempt.status === "triggered") return true;
  return attempt.status === "failed" && attempt.httpStatus === null;
}

export function shouldDebounceTrigger(
  lastTriggeredAt: Date | null,
  now: Date,
  windowMs: number = TRIGGER_DEBOUNCE_MS,
): boolean {
  if (!lastTriggeredAt) return false;
  const elapsed = now.getTime() - lastTriggeredAt.getTime();
  return elapsed >= 0 && elapsed < windowMs;
}

/**
 * Map a transport failure to safe user-facing text.
 *
 * SECURITY: this is a chokepoint, not a formatter. HttpError embeds the full
 * request URL in `.message` and `.url`, and the response body in `.body` — and the
 * webhook URL is a secret. So this function never interpolates any of them.
 * Do NOT replace it with the `err instanceof Error ? err.message : String(err)`
 * shortcut used in apply-actions.ts: there the URL is public Datadog, here it
 * would publish a private endpoint to the browser and write it permanently into a
 * never-deleted audit table.
 */
export function triggerFailureMessage(err: unknown, label: string): string {
  if (err instanceof HttpError) {
    if (err.status === 401 || err.status === 403) {
      return `Cursor rejected the trigger for ${label} (HTTP ${err.status}). The webhook key, or the header it is sent in, may be wrong — check CURSOR_WEBHOOK_AUTH_HEADER.`;
    }
    if (err.status === 404) {
      return `Cursor could not find a webhook for ${label} (HTTP 404). Re-copy the URL from the automation's trigger settings.`;
    }
    if (err.status === 429) {
      return `Cursor is rate-limiting triggers for ${label}. Wait a minute, then try again.`;
    }
    if (err.status >= 500) {
      return `Cursor's webhook endpoint is failing for ${label} (HTTP ${err.status}). Try again shortly, or run it from cursor.com.`;
    }
    return `Could not trigger ${label} (HTTP ${err.status}).`;
  }
  if (err instanceof Error && err.name === "AbortError") {
    return `Timed out reaching Cursor while triggering ${label}. The run may have started anyway — check its history in Cursor before retrying.`;
  }
  return `Could not reach Cursor to trigger ${label}.`;
}
