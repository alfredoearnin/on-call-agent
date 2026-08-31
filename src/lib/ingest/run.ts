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
import { refreshMonitorConfigsFromDatadog } from "@/lib/ingest/refresh-monitor-configs";
import { reconcileFeedback } from "@/lib/ingest/feedback";
import { acquireLock, releaseLock } from "@/lib/ingest/lock";
import type {
  IngestBundle,
  NormalizedSchedule,
  PageCoverage,
  PageRefresh,
} from "@/lib/ingest/types";
import { serializeCoverage } from "@/lib/people/coverage";

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
  /** Non-fatal problems worth a human's attention (e.g. the handoff page no
   * longer states who is on-call). Callers are expected to surface these. */
  warnings?: string[];
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

/**
 * The rotation is free prose on the handoff page, so a reworded line parses to
 * nothing and silently blanks the Overview. Report that instead of letting the
 * run look clean.
 */
function scheduleWarnings(schedule?: NormalizedSchedule): string[] {
  const warnings: string[] = [];

  const missing = (["primary", "secondary"] as const).filter((role) => !schedule?.[role]);
  if (missing.length) {
    warnings.push(
      `on-call: no ${missing.join(" or ")} found on the handoff page — the Overview ` +
        "shows a dash. Check the rotation line against the format in the agent prompt (agents/).",
    );
  }

  if (schedule?.unverified) {
    const asOf = schedule.verifiedAsOf ? ` (last confirmed ${schedule.verifiedAsOf})` : "";
    warnings.push(
      `on-call: names carried forward unverified${asOf} — confirm the rotation in incident.io.`,
    );
  }

  return warnings;
}

/**
 * The refresh stamp is free prose too, and it is the only evidence the dashboard
 * has that the upstream health-check automation ran. Without it that automation
 * reads as "unknown" forever, so a reworded line must report itself rather than
 * decaying into a permanent shrug.
 */
function refreshWarnings(pageRefresh?: PageRefresh): string[] {
  if (!pageRefresh) {
    return [
      'handoff: no "Last refreshed" stamp on the page — the health-check ' +
        "automation's status cannot be observed. Check the wording against the agent prompt in agents/.",
    ];
  }
  if (!pageRefresh.at) {
    return [
      `handoff: refresh stamp "${pageRefresh.text}" could not be resolved to a time.`,
    ];
  }
  return [];
}

/**
 * The coverage check is free prose too, and a missing one renders as "unknown" for
 * every role — which is correct but silent. Report it, so a reworded or skipped
 * check surfaces instead of the banner quietly saying nothing forever.
 */
function coverageWarnings(coverage?: PageCoverage): string[] {
  if (!coverage) {
    return [
      'handoff: no "Coverage check" block on the page — nobody\'s availability could be ' +
        "verified. Check the wording against the agent prompt in agents/.",
    ];
  }
  if (coverage.unavailableReason) {
    return [
      `handoff: the coverage check did not complete (${coverage.unavailableReason}) — ` +
        "verify the rotation's availability manually.",
    ];
  }
  return [];
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

    let configRefreshNote = "";
    let datadogFromRefresh: (typeof SourceStatus)[keyof typeof SourceStatus] | undefined;
    if (hasDatadogRead(cfg) && source !== "demo") {
      try {
        const refresh = await refreshMonitorConfigsFromDatadog(run.id);
        const auditNote =
          refresh.audit === "forbidden"
            ? "audit forbidden — grant audit_logs_read to the Datadog app key's user"
            : `audit ${refresh.audit}`;
        configRefreshNote = `monitor-config: ${refresh.snapshots} edit(s) / ${auditNote}`;
        datadogFromRefresh = SourceStatus.OK;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        configRefreshNote = `monitor-config: unavailable (${message})`;
        datadogFromRefresh = SourceStatus.Unavailable;
      }
    }

    const feedback = await reconcileFeedback();

    const newest = items[items.length - 1].bundle;
    if (datadogFromRefresh && newest.sourceStatus.datadog === SourceStatus.Skipped) {
      newest.sourceStatus.datadog = datadogFromRefresh;
    }
    const anyUnavailable = Object.values(newest.sourceStatus).includes(
      SourceStatus.Unavailable,
    );
    const status = anyUnavailable ? RunStatus.Partial : RunStatus.Success;

    const warnings = [
      ...scheduleWarnings(newest.schedule),
      ...(source === "confluence"
        ? [
            ...refreshWarnings(newest.pageRefresh),
            ...coverageWarnings(newest.coverage),
          ]
        : []),
    ];

    const notesParts = [
      source === "confluence"
        ? `Confluence: ${items.length} week(s)`
        : newest.notes,
    ].filter(Boolean) as string[];
    notesParts.push(
      `feedback: ${feedback.applied} applied / ${feedback.validated} validated / ${feedback.regressed} regressed`,
    );
    if (configRefreshNote) notesParts.push(configRefreshNote);
    notesParts.push(...warnings);

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
        onCallUnverified: newest.schedule?.unverified ?? false,
        onCallVerifiedAsOf: newest.schedule?.verifiedAsOf,
        handoffRefreshedAt: newest.pageRefresh?.at,
        handoffRefreshedText: newest.pageRefresh?.text,
        coverageJson: newest.coverage
          ? serializeCoverage(newest.coverage)
          : null,
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

    return { ok: true, runId: run.id, status, warnings, kpis: result?.kpis };
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
