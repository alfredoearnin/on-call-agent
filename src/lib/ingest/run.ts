import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getConfig, hasDatadogRead } from "@/lib/config";
import {
  RunStatus,
  SourceStatus,
  SyncTrigger,
  type SyncTrigger as Trigger,
} from "@/lib/constants";
import { DatadogClient } from "@/lib/clients/datadog";
import { resolveWindow, toEpochSeconds, type OpsWindow } from "@/lib/ingest/window";
import { buildDemoBundle } from "@/lib/ingest/sources/demo";
import { buildLiveBundle } from "@/lib/ingest/sources/live";
import {
  buildConfluenceBundles,
  hasConfluenceFiles,
} from "@/lib/ingest/sources/confluence";
import { classifyRecommendations } from "@/lib/ingest/tuning";
import { persistBundle } from "@/lib/ingest/persist";
import { reconcileFeedback } from "@/lib/ingest/feedback";
import { acquireLock, releaseLock } from "@/lib/ingest/lock";
import type { IngestBundle } from "@/lib/ingest/types";

export interface RunOptions {
  trigger?: Trigger;
  now?: Date;
}

export interface RunOutcome {
  ok: boolean;
  skipped?: boolean;
  runId?: string;
  status?: string;
  message?: string;
  kpis?: Awaited<ReturnType<typeof persistBundle>>["kpis"];
}

/** Ensure the singleton SyncSettings row exists. */
export async function ensureSyncSettings() {
  return prisma.syncSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/** OpsWindow for a bundle's parsed handoff window (falls back to the run window). */
function windowForBundle(
  b: { window?: { start: Date; end: Date } },
  fallback: OpsWindow,
  now: Date,
): OpsWindow {
  if (!b.window) return fallback;
  const start = b.window.start;
  const days = Math.max(
    0.04,
    Math.min(7, (now.getTime() - start.getTime()) / 86_400_000),
  );
  return {
    start,
    end: b.window.end,
    priorStart: new Date(start.getTime() - 7 * 86_400_000),
    priorEnd: start,
    daysElapsed: days,
    timezone: fallback.timezone,
  };
}

/** Minimal "next daily run" from a `m h * * *` cron; falls back to +1 day. */
function computeNextRun(cron: string, tz: string, from: Date): Date {
  const parts = cron.trim().split(/\s+/);
  if (parts.length === 5 && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
    const minute = Number.parseInt(parts[0], 10) || 0;
    const hour = Number.parseInt(parts[1], 10) || 0;
    let next = DateTime.fromJSDate(from, { zone: tz }).set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });
    if (next.toJSDate() <= from) next = next.plus({ days: 1 });
    return next.toJSDate();
  }
  return DateTime.fromJSDate(from, { zone: tz }).plus({ days: 1 }).toJSDate();
}

/**
 * The single ingestion + analysis entrypoint. Every sync trigger (manual UI,
 * CLI, scheduler, cron) calls this. Idempotent per day via natural-key upserts.
 */
export async function runSync(opts: RunOptions = {}): Promise<RunOutcome> {
  const cfg = getConfig();
  const now = opts.now ?? new Date();
  const trigger = opts.trigger ?? SyncTrigger.ManualCLI;

  if (!acquireLock()) {
    return {
      ok: false,
      skipped: true,
      message: "A sync is already running; this trigger was skipped.",
    };
  }

  const settings = await ensureSyncSettings();
  const window = resolveWindow(now);

  const run = await prisma.ingestionRun.create({
    data: {
      startedAt: now,
      windowStart: window.start,
      windowEnd: window.end,
      daysElapsed: window.daysElapsed,
      mode: settings.mode,
      trigger,
      status: RunStatus.Running,
    },
  });

  try {
    // --- Resolve source + build the bundle ----------------------------------
    let source = cfg.syncSource;
    if (source === "auto") {
      source = hasConfluenceFiles()
        ? "confluence"
        : cfg.demoMode
          ? "demo"
          : "live";
    }

    // Build the (bundle, window) list to persist. Confluence yields one per week.
    const items: { bundle: IngestBundle; win: OpsWindow }[] = [];
    if (source === "confluence") {
      for (const b of buildConfluenceBundles(now)) {
        items.push({ bundle: b, win: windowForBundle(b, window, now) });
      }
    } else if (source === "demo") {
      items.push({ bundle: buildDemoBundle(now), win: window });
    } else {
      const b = await buildLiveBundle(cfg, window);
      const dd = hasDatadogRead(cfg) ? new DatadogClient(cfg) : undefined;
      b.recommendations = await classifyRecommendations(
        b.monitors,
        b.alerts,
        cfg,
        dd,
        toEpochSeconds(window.priorStart),
        toEpochSeconds(window.end),
      );
      items.push({ bundle: b, win: window });
    }

    // Recommendations reflect the CURRENT (newest) week only, so older weeks
    // don't re-add the same monitors under slightly different classifications.
    items.forEach((it, i) => {
      if (i < items.length - 1) it.bundle.recommendations = [];
    });

    // --- Persist (one per week) + feedback ----------------------------------
    // Only live mode owns monitor config; other sources must not clobber it.
    let result: Awaited<ReturnType<typeof persistBundle>> | undefined;
    for (const { bundle, win } of items) {
      result = await persistBundle(bundle, win, run.id, {
        preserveExistingConfig: source !== "live",
      });
    }
    const feedback = await reconcileFeedback();

    const newest = items[items.length - 1].bundle;
    const anyUnavailable = Object.values(newest.sourceStatus).includes(
      SourceStatus.Unavailable,
    );
    const status = anyUnavailable ? RunStatus.Partial : RunStatus.Success;

    const notesParts = [
      source === "confluence"
        ? `Confluence: ${items.length} week(s)`
        : newest.notes,
    ].filter(Boolean) as string[];
    notesParts.push(
      `feedback: ${feedback.applied} applied / ${feedback.validated} validated / ${feedback.regressed} regressed`,
    );

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        windowStart: newest.window?.start ?? window.start,
        windowEnd: newest.window?.end ?? window.end,
        datadogStatus: newest.sourceStatus.datadog,
        incidentioStatus: newest.sourceStatus.incidentio,
        jiraStatus: newest.sourceStatus.jira,
        notes: notesParts.join(" | "),
        primaryOnCall: newest.schedule?.primary,
        secondaryOnCall: newest.schedule?.secondary,
        nextPrimaryOnCall: newest.schedule?.nextPrimary,
        nextSecondaryOnCall: newest.schedule?.nextSecondary,
        ...(result?.kpis ?? {}),
      },
    });

    const nextRunAt =
      settings.mode === "automatic"
        ? computeNextRun(settings.scheduleCron, settings.timezone, new Date())
        : null;

    await prisma.syncSettings.update({
      where: { id: "singleton" },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunId: run.id,
        nextRunAt,
      },
    });

    return { ok: true, runId: run.id, status, kpis: result?.kpis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: RunStatus.Failed, error: message },
    });
    await prisma.syncSettings.update({
      where: { id: "singleton" },
      data: { lastRunAt: new Date(), lastRunStatus: RunStatus.Failed, lastRunId: run.id },
    });
    return { ok: false, runId: run.id, status: RunStatus.Failed, message };
  } finally {
    releaseLock();
  }
}
