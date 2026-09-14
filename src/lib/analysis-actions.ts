"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import {
  AnalysisStatus,
  RecommendationStatus,
  isTerminalAnalysisStatus,
} from "@/lib/constants";
import {
  AnalysisUnavailableError,
  collectMonitorEvidence,
} from "@/lib/analysis/collect";
import {
  evaluateCounterfactual,
  syntheticSustainedBreach,
  type Episode,
  type ProposedRule,
  type WindowFn,
} from "@/lib/analysis/counterfactual";
import type { MonitorEvidence } from "@/lib/analysis/evidence";
import { parseMonitorQuery } from "@/lib/analysis/monitor-query";
import {
  recommendFromEvidence,
  type RuleRecommendation,
} from "@/lib/analysis/recommend";
import { triggerAutomationAction } from "@/lib/automation-actions";
import { AutomationKey } from "@/lib/constants";
import { canTriggerAutomation } from "@/lib/automations/secrets";

/**
 * Running one on-demand monitor analysis.
 *
 * The recommendations come from deterministic rules over evidence gathered from
 * Datadog and incident.io — no model, no third-party credential beyond the
 * reads the dashboard already does. Every proposed change is then replayed
 * against the monitor's own firing history, so what reaches the Apply button is
 * a patch plus the arithmetic that justifies it.
 *
 * The work happens inside the action rather than behind a queue: it is a
 * handful of parallel reads and some arithmetic. The `MonitorAnalysis` row
 * exists for history and for the case the platform kills a long request — a row
 * left in flight is reconciled to `expired` on the next read, never to `done`.
 */

/** A run still in flight after this long is presumed lost. */
const STALE_AFTER_MINUTES = 10;
/** Refuse a repeat request this soon after the last one. */
const DEBOUNCE_SECONDS = 30;

export interface AnalysisActionResult {
  ok: boolean;
  analysisId?: string;
  recommendationIds?: string[];
  message?: string;
  /** Whether the cause-investigation agent was asked to look at this monitor. */
  investigationRequested?: boolean;
}

/**
 * Hand this monitor to the cause-investigation agent, if it is configured.
 *
 * The rules and the agent answer different questions about the same monitor —
 * what to change, and why the service misbehaved — so one click asks both. The
 * agent half is best-effort: it runs in Cursor, takes minutes, and its output
 * lands in Jira and Slack rather than here, so a failure to reach it must not
 * fail the analysis that already succeeded.
 */
async function requestCauseInvestigation(
  monitorId: string,
  monitorName: string,
  service: string | undefined,
): Promise<boolean> {
  if (!canTriggerAutomation(AutomationKey.CauseInvestigation)) return false;
  const res = await triggerAutomationAction(AutomationKey.CauseInvestigation, {
    monitorId,
    monitorName,
    service: service ?? null,
    requestedBy: "on-call dashboard",
    // Named so the prompt can key off it rather than guessing at the shape.
    intent: "investigate_monitor_cause",
  });
  return res.ok;
}

/**
 * Failure text safe to show an operator.
 *
 * A chokepoint, not a formatter: HttpError puts the full request URL in
 * `.message`, so it is never interpolated. The error's class is enough to say
 * whether to retry or to go and look at the configuration.
 */
function sanitizeFailure(err: unknown): string {
  if (err instanceof AnalysisUnavailableError) return err.message;
  if (err instanceof Error) {
    if (err.name === "HttpError") {
      return "A source system rejected the request. Check the Datadog and incident.io credentials.";
    }
    return `Analysis failed (${err.name}).`;
  }
  return "Analysis failed.";
}

/** Move any run that has been in flight too long to a terminal, honest state. */
export async function reconcileStaleAnalyses(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);
  await prisma.monitorAnalysis.updateMany({
    where: {
      status: { in: [AnalysisStatus.Queued, AnalysisStatus.Running] },
      requestedAt: { lt: cutoff },
    },
    data: {
      status: AnalysisStatus.Expired,
      observedAt: new Date(),
      error: `No result observed within ${STALE_AFTER_MINUTES} minutes.`,
    },
  });
}

/** A monitor id safe to use as a database key and a request path segment. */
function isMonitorId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,20}$/.test(value);
}

function ruleFrom(query: string, threshold?: number): ProposedRule | undefined {
  const p = parseMonitorQuery(query);
  const t = threshold ?? p.queryThreshold;
  if (!p.windowFn || !p.windowSeconds || t == null) return undefined;
  return {
    windowFn: p.windowFn as WindowFn,
    windowSeconds: p.windowSeconds,
    comparator: (p.comparator ?? ">") as ProposedRule["comparator"],
    threshold: t,
  };
}

/**
 * Replay one recommendation's patch against the monitor's own history.
 *
 * Only meaningful for a patch that changes the query's window or scope — a
 * routing change does not alter when the monitor fires, only who hears it, and
 * claiming a suppression count for it would be false.
 */
function replayFor(
  rec: RuleRecommendation,
  evidence: MonitorEvidence,
  episodes: Episode[],
): string | undefined {
  if (rec.patch?.target !== "query" || !rec.patch.prod) return undefined;
  if (episodes.length === 0) return undefined;

  const critical = evidence.monitor.thresholds.critical;
  const current = ruleFrom(evidence.monitor.query, critical);
  const patched = evidence.monitor.query
    .split(rec.patch.prod.find)
    .join(rec.patch.prod.replace);
  const proposed = ruleFrom(patched, critical);
  if (!current || !proposed) return undefined;

  // A scope change alters which requests the metric covers, which this replay
  // cannot simulate from the series it already fetched. Saying so is better
  // than reporting a number that means something else.
  if (
    current.windowFn === proposed.windowFn &&
    current.windowSeconds === proposed.windowSeconds &&
    current.threshold === proposed.threshold
  ) {
    return "Not replayed: this change narrows the metric's scope, which the recorded series cannot simulate.";
  }

  const report = evaluateCounterfactual(
    [
      ...episodes,
      {
        label: "synthetic: 20m sustained breach",
        points: syntheticSustainedBreach(proposed.threshold * 1.5, 20),
      },
    ],
    current,
    proposed,
  );
  return report.summary;
}

export async function requestMonitorAnalysisAction(
  rawMonitorId: string,
): Promise<AnalysisActionResult> {
  // A server action is a public endpoint, so the argument is untrusted.
  if (!isMonitorId(rawMonitorId)) {
    return { ok: false, message: "Unrecognised monitor." };
  }
  try {
    return await runAnalysis(rawMonitorId);
  } catch (err) {
    // Never throw out of a server action: a raw 500 leaves the operator unable
    // to tell whether any of the work happened.
    return { ok: false, message: sanitizeFailure(err) };
  }
}

async function runAnalysis(monitorId: string): Promise<AnalysisActionResult> {
  const cfg = getConfig();
  await reconcileStaleAnalyses();

  const last = await prisma.monitorAnalysis.findFirst({
    where: { monitorId },
    orderBy: { requestedAt: "desc" },
  });
  if (last && !isTerminalAnalysisStatus(last.status)) {
    return {
      ok: false,
      analysisId: last.id,
      message: "An analysis for this monitor is already running.",
    };
  }
  if (
    last &&
    Date.now() - last.requestedAt.getTime() < DEBOUNCE_SECONDS * 1000
  ) {
    return {
      ok: false,
      analysisId: last.id,
      message: `Just analysed. Wait ${DEBOUNCE_SECONDS}s before running it again.`,
    };
  }

  const analysis = await prisma.monitorAnalysis.create({
    data: {
      monitorId,
      status: AnalysisStatus.Running,
      operator: cfg.apply.operator,
    },
  });

  try {
    const { evidence, episodes, monitor } =
      await collectMonitorEvidence(monitorId);

    // Keep the live config locally: the options patch needs a before-state to
    // merge into, and Monitor.options is where the apply path looks for it.
    await prisma.monitor.updateMany({
      where: { id: monitorId },
      data: {
        query: monitor.query ?? null,
        message: monitor.message ?? null,
        options: monitor.options ? JSON.stringify(monitor.options) : null,
      },
    });

    const recs = recommendFromEvidence(evidence);

    const ids: string[] = [];
    for (const rec of recs) {
      ids.push(
        await persistRecommendation({
          monitorId,
          monitorName: monitor.name,
          service: evidence.monitor.service,
          rec,
          replay: replayFor(rec, evidence, episodes),
          evidence,
        }),
      );
    }

    // Fired after the rules have run and been stored, so the local result is
    // never lost to a webhook failure.
    const investigationRequested = await requestCauseInvestigation(
      monitorId,
      monitor.name,
      evidence.monitor.service,
    );

    const summary =
      recs.length === 0
        ? "No mechanical defect found."
        : recs.map((r) => r.title).join("; ");

    await prisma.monitorAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: AnalysisStatus.Done,
        observedAt: new Date(),
        evidenceJson: JSON.stringify(evidence),
        resultSummary: summary,
        recommendationId: ids[0] ?? null,
      },
    });

    revalidatePath(`/monitors/${monitorId}`);
    revalidatePath("/recommendations");
    revalidatePath("/", "layout");

    const agentNote = investigationRequested
      ? " Cause investigation requested in Cursor — findings arrive as Jira tickets."
      : "";

    return {
      ok: true,
      analysisId: analysis.id,
      recommendationIds: ids,
      investigationRequested,
      message:
        (recs.length === 0
          ? "Analysed: no mechanical defect found in this monitor's configuration."
          : `Analysed: ${recs.length} recommendation(s) — see below.`) + agentNote,
    };
  } catch (err) {
    await prisma.monitorAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: AnalysisStatus.Failed,
        observedAt: new Date(),
        error: sanitizeFailure(err),
      },
    });
    revalidatePath(`/monitors/${monitorId}`);
    return {
      ok: false,
      analysisId: analysis.id,
      message: sanitizeFailure(err),
    };
  }
}

interface PersistInput {
  monitorId: string;
  monitorName: string;
  service?: string;
  rec: RuleRecommendation;
  replay?: string;
  evidence: MonitorEvidence;
}

/**
 * Store one finding as a recommendation the Apply button can act on.
 *
 * Upserts on (monitorKey, issueType) like the ingest ledger merge, so
 * re-analysing a monitor refreshes its recommendations instead of accumulating
 * duplicates — and a monitor with two distinct defects gets two rows rather
 * than one that overwrites the other.
 */
async function persistRecommendation(input: PersistInput): Promise<string> {
  const { rec, evidence } = input;

  // Only state what was actually read. A count of zero and an unread source
  // are different claims, and printing the first for the second is how "this
  // monitor never woke anyone" gets asserted about a monitor nobody measured.
  const lines: string[] = [];
  if (evidence.pages.historyAvailable) {
    lines.push(
      `${evidence.pages.totalFirings} firing(s) over ${evidence.window.days}d;`,
      `${evidence.pages.withIncident} incident(s);`,
    );
  } else {
    lines.push(
      evidence.sources.pageHistory === "not_configured"
        ? "Firing history unavailable (incident.io not configured)."
        : "Firing history could not be read.",
    );
  }
  if (evidence.pages.escalationsAvailable) {
    lines.push(
      `${evidence.pages.totalPages} page(s), ${evidence.pages.pagesOutsideWorkHours} outside work hours, ${evidence.pages.pagesOvernight} overnight.`,
    );
    if (evidence.pages.ackSeconds) {
      lines.push(`Median ack ${evidence.pages.ackSeconds.p50}s.`);
    }
  } else if (evidence.sources.pageHistory === "datadog_only") {
    // Datadog's alert events say when a monitor fired, never who it woke.
    lines.push(
      "Page and ack detail unavailable (from Datadog events; incident.io not configured).",
    );
  }
  if (evidence.metric.baseline) {
    lines.push(
      `Baseline p90 ${evidence.metric.baseline.p90.toFixed(3)}, max ${evidence.metric.baseline.max.toFixed(3)}.`,
    );
  }
  if (input.replay) lines.push(`Replay: ${input.replay}`);
  for (const f of rec.followUps) lines.push(`Follow-up (${f.kind}): ${f.summary}`);

  const data = {
    monitorId: input.monitorId,
    monitorKey: input.monitorId,
    monitorName: input.monitorName,
    service: input.service ?? null,
    issueType: rec.issueType,
    title: rec.title,
    before: rec.before,
    after: rec.after,
    changeSummary: rec.summary,
    coveragePreserved: rec.coveragePreserved,
    expectedImpact: input.replay
      ? `${rec.expectedImpact} ${input.replay}`
      : rec.expectedImpact,
    evidence: lines.join(" "),
    confidence: rec.confidence,
    status: RecommendationStatus.Recommend,
    firesThisWeek: evidence.pages.totalFirings,
    autoResolvedPct: evidence.pages.autoResolvedPct ?? null,
    nightPages: evidence.pages.pagesOvernight,
    lastFiredAt:
      evidence.pages.firings.length > 0
        ? new Date(
            evidence.pages.firings[evidence.pages.firings.length - 1].atIso,
          )
        : null,
    lastUpdated: new Date(),
    patchJson: rec.patch ? JSON.stringify(rec.patch) : null,
  };

  const row = await prisma.tuningRecommendation.upsert({
    where: {
      monitorKey_issueType: {
        monitorKey: input.monitorId,
        issueType: rec.issueType,
      },
    },
    create: data,
    update: data,
  });
  return row.id;
}
