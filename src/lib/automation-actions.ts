"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { AutomationKey, TriggerStatus } from "@/lib/constants";
import { CursorAutomationsClient } from "@/lib/clients/cursor";
import {
  automationMeta,
  blocksRetry,
  isAutomationKey,
  shouldDebounceTrigger,
  staleHealthCheckWarning,
  appendAuditNote,
} from "@/lib/automations/meta";
import { canTriggerAutomation, automationEnvNames } from "@/lib/automations/secrets";

export interface TriggerResult {
  ok: boolean;
  /** The webhook is not configured for this automation. */
  blocked?: boolean;
  /** A trigger for this automation landed seconds ago; this click was dropped. */
  debounced?: boolean;
  message?: string;
}

/**
 * Re-run one Cursor Automation via its webhook trigger.
 *
 * Cursor returns no run id and no status, so a successful result means the
 * request was ACCEPTED — never that the run succeeded. The copy below is written
 * to keep that distinction visible to the operator.
 *
 * Never throws; always returns { ok, message }.
 */
export async function triggerAutomationAction(
  rawKey: string,
): Promise<TriggerResult> {
  // The docstring promises this never throws, so make that true rather than nearly
  // true. Every DB read below can fail — and a thrown server action shows the
  // operator a raw 500 with no indication of whether the agent started.
  try {
    return await sendTrigger(rawKey);
  } catch {
    return {
      ok: false,
      message:
        "The trigger could not be completed. Check the automation in Cursor before retrying — it may or may not have started.",
    };
  }
}

async function sendTrigger(rawKey: string): Promise<TriggerResult> {
  // A server action is a public endpoint, so the argument is untrusted — same
  // reason applyRecommendationAction takes `scope: string` and normalizes it.
  if (!isAutomationKey(rawKey)) {
    return { ok: false, message: "Unknown automation." };
  }
  const key = rawKey;
  const cfg = getConfig();
  const meta = automationMeta(key);
  const now = new Date();

  // Re-checked server-side on purpose: the client's `mode` prop is presentation
  // only and cannot be trusted to have gated anything.
  if (!canTriggerAutomation(key)) {
    await prisma.automationTrigger.create({
      data: {
        automationKey: key,
        status: TriggerStatus.Blocked,
        operator: cfg.apply.operator,
      },
    });
    return {
      ok: false,
      blocked: true,
      message: `Re-run is not configured for ${meta.label}. Add ${automationEnvNames(key).join(" and ")} to .env.local — see the README.`,
    };
  }

  // Any status, not just Triggered: a timed-out attempt may have started a run
  // even though it was recorded as failed. blocksRetry() decides which ones count.
  const last = await prisma.automationTrigger.findFirst({
    where: { automationKey: key },
    orderBy: { triggeredAt: "desc" },
    select: { triggeredAt: true, status: true, httpStatus: true },
  });

  // A webhook POST is not idempotent, so a double-click or an impatient reload
  // would start a second concurrent agent. No audit row here: the row written
  // seconds ago already records the intent, and AutomationTrigger is never
  // deleted, so a user hammering the button would flood it.
  const blocking = last && blocksRetry(last) ? last.triggeredAt : null;
  if (shouldDebounceTrigger(blocking, now)) {
    return {
      ok: false,
      debounced: true,
      message: `${meta.label} was already triggered a few seconds ago — give Cursor a moment.`,
    };
  }

  // Re-checked here rather than trusting the render: the page may have been
  // rendered before automation #1 was fired.
  let warning: string | null = null;
  let precededById: string | null = null;
  if (key === AutomationKey.DashboardRefresh) {
    const lastHealthCheck = await prisma.automationTrigger.findFirst({
      where: {
        automationKey: AutomationKey.HealthCheck,
        status: TriggerStatus.Triggered,
      },
      orderBy: { triggeredAt: "desc" },
      select: { id: true, triggeredAt: true },
    });
    // The page stamp is the only local proof that #1's run actually produced a
    // page, so the warning clears on that rather than on a timer.
    const latestRun = await prisma.ingestionRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { handoffRefreshedAt: true },
    });
    warning = staleHealthCheckWarning(
      lastHealthCheck?.triggeredAt ?? null,
      latestRun?.handoffRefreshedAt ?? null,
      now,
    );
    if (warning) precededById = lastHealthCheck?.id ?? null;
  }

  const outcome = await new CursorAutomationsClient(cfg).triggerAutomation(
    key,
    meta.label,
  );

  // The POST has already happened, so an audit failure must not destroy the result:
  // throwing here would show the operator a raw 500 while the agent was already
  // running, leaving them unable to tell whether it fired. Worse, the 30-second
  // debounce reads this table, so a missing row makes it blind and a retry could
  // start a second agent — the exact double-fire `retries: 0` exists to prevent.
  // Observed for real: a `git stash` of prisma/oncall.db under a live connection
  // made SQLite report "attempt to write a readonly database" right here.
  let audited = true;
  try {
    await prisma.automationTrigger.create({
      data: {
        automationKey: key,
        status: outcome.ok ? TriggerStatus.Triggered : TriggerStatus.Failed,
        httpStatus: outcome.status ?? null,
        // Already sanitized by triggerFailureMessage — no URL, key, or body.
        error: outcome.ok ? null : outcome.message,
        operator: cfg.apply.operator,
        staleWarning: Boolean(warning),
        precededById,
      },
    });
  } catch {
    audited = false;
  }

  // Only the panel and the header change now. The trigger's real effects arrive
  // minutes later via Confluence → PR → git pull, so no data page has new
  // content to revalidate.
  revalidatePath("/settings");
  revalidatePath("/", "layout");

  if (!outcome.ok) {
    return { ok: false, message: appendAuditNote(outcome.message, audited) };
  }

  const nextStep =
    key === AutomationKey.HealthCheck
      ? "It rewrites the Confluence page in the background. Cursor reports no status back, so check the run there, then re-run the daily refresh."
      : "Once it merges to main, click Refresh from source to pull it.";

  return {
    ok: true,
    message: appendAuditNote(
      [`${meta.label} triggered.`, nextStep, warning].filter(Boolean).join(" "),
      audited,
    ),
  };
}
