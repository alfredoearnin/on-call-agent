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
import { resolveWindow, toEpochSeconds } from "@/lib/ingest/window";
import { buildDemoBundle } from "@/lib/ingest/sources/demo";
import { buildLiveBundle } from "@/lib/ingest/sources/live";
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
    // --- Build the bundle ---------------------------------------------------
    let bundle: IngestBundle;
    if (cfg.demoMode) {
      bundle = buildDemoBundle(now);
    } else {
      bundle = await buildLiveBundle(cfg, window);
      // Live mode computes recommendations from observed signals.
      const dd = hasDatadogRead(cfg) ? new DatadogClient(cfg) : undefined;
      bundle.recommendations = await classifyRecommendations(
        bundle.monitors,
        bundle.alerts,
        cfg,
        dd,
        toEpochSeconds(window.priorStart),
        toEpochSeconds(window.end),
      );
    }

    // --- Persist + feedback -------------------------------------------------
    const result = await persistBundle(bundle, window, run.id, {
      preserveExistingConfig: cfg.demoMode,
    });
    const feedback = await reconcileFeedback();

    const anyUnavailable = Object.values(bundle.sourceStatus).includes(
      SourceStatus.Unavailable,
    );
    const status = anyUnavailable ? RunStatus.Partial : RunStatus.Success;

    const notesParts = [bundle.notes].filter(Boolean) as string[];
    notesParts.push(
      `feedback: ${feedback.applied} applied / ${feedback.validated} validated / ${feedback.regressed} regressed`,
    );

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        datadogStatus: bundle.sourceStatus.datadog,
        incidentioStatus: bundle.sourceStatus.incidentio,
        jiraStatus: bundle.sourceStatus.jira,
        notes: notesParts.join(" | "),
        primaryOnCall: bundle.schedule?.primary,
        secondaryOnCall: bundle.schedule?.secondary,
        nextPrimaryOnCall: bundle.schedule?.nextPrimary,
        nextSecondaryOnCall: bundle.schedule?.nextSecondary,
        ...result.kpis,
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

    return { ok: true, runId: run.id, status, kpis: result.kpis };
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
