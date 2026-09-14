"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import {
  AnalysisStatus,
  Confidence,
  RecommendationStatus,
  isTerminalAnalysisStatus,
} from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";
import {
  AnalysisUnavailableError,
  collectMonitorEvidence,
} from "@/lib/analysis/collect";
import {
  evaluateCounterfactual,
  syntheticSustainedBreach,
  type ProposedRule,
  type WindowFn,
} from "@/lib/analysis/counterfactual";
import {
  interpretEvidence,
  patchProblem,
  type AnalysisPatch,
  type AnalysisResult,
} from "@/lib/analysis/interpret";
import { canInterpret } from "@/lib/analysis/secrets";
import { parseMonitorQuery } from "@/lib/analysis/monitor-query";

/**
 * Running one on-demand monitor analysis.
 *
 * The work happens inside the action rather than behind a queue: evidence
 * collection is a handful of parallel reads and the interpretation is a single
 * call, so the whole thing is seconds, not minutes. That keeps the repo free of
 * its first polling loop. The `MonitorAnalysis` row exists for history and for
 * the case the platform kills a long request — a row left in flight is
 * reconciled to `expired` on the next read, never to `done`.
 */

/** A run still in flight after this long is presumed lost. */
const STALE_AFTER_MINUTES = 10;
/** Refuse a repeat request this soon after the last one. */
const DEBOUNCE_SECONDS = 30;

export interface AnalysisActionResult {
  ok: boolean;
  analysisId?: string;
  recommendationId?: string;
  message?: string;
}

/**
 * Failure text safe to show an operator.
 *
 * A chokepoint, not a formatter: HttpError puts the full request URL in
 * `.message`, and an Anthropic error can echo request content, so neither is
 * ever interpolated. The error's class name is enough to tell an operator
 * whether to retry or to go and look at the configuration.
 */
function sanitizeFailure(err: unknown): string {
  if (err instanceof AnalysisUnavailableError) return err.message;
  if (err instanceof Error) {
    if (err.name === "HttpError") {
      return "A source system rejected the request. Check the Datadog and incident.io credentials.";
    }
    if (err.name === "ZodError") {
      return "The interpretation did not match the expected shape and was discarded.";
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

/**
 * The proposed rule a patch implies, for the counterfactual.
 *
 * Derived by applying the patch to the monitor's own query text and re-parsing
 * the result, so the replayed rule is the one the Apply button would actually
 * install rather than a paraphrase of it.
 */
function proposedRuleFrom(
  currentQuery: string,
  patch: AnalysisPatch | null,
  criticalThreshold: number | undefined,
): { current?: ProposedRule; proposed?: ProposedRule } {
  const parsedCurrent = parseMonitorQuery(currentQuery);
  const threshold = criticalThreshold ?? parsedCurrent.queryThreshold;
  if (
    !parsedCurrent.windowFn ||
    !parsedCurrent.windowSeconds ||
    threshold == null
  ) {
    return {};
  }

  const comparator = (parsedCurrent.comparator ?? ">") as ProposedRule["comparator"];
  const current: ProposedRule = {
    windowFn: parsedCurrent.windowFn as WindowFn,
    windowSeconds: parsedCurrent.windowSeconds,
    comparator,
    threshold,
  };

  if (!patch) return { current };

  let nextQuery = currentQuery;
  let requireFullWindow: boolean | undefined;

  if (patch.target === "query") {
    const branch = patch.prod ?? patch.dev;
    if (branch) nextQuery = currentQuery.split(branch.find).join(branch.replace);
  } else if (patch.target === "options") {
    const full = patch.options?.find((o) => o.key === "require_full_window");
    if (typeof full?.value === "boolean") requireFullWindow = full.value;
  }

  const parsedNext = parseMonitorQuery(nextQuery);
  if (!parsedNext.windowFn || !parsedNext.windowSeconds) return { current };

  return {
    current,
    proposed: {
      windowFn: parsedNext.windowFn as WindowFn,
      windowSeconds: parsedNext.windowSeconds,
      comparator: (parsedNext.comparator ?? comparator) as ProposedRule["comparator"],
      threshold: parsedNext.queryThreshold ?? threshold,
      requireFullWindow,
    },
  };
}

/** A monitor id safe to use as a database key and a request path segment. */
function isMonitorId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,20}$/.test(value);
}

export async function requestMonitorAnalysisAction(
  rawMonitorId: string,
): Promise<AnalysisActionResult> {
  // A server action is a public endpoint, so the argument is untrusted.
  if (!isMonitorId(rawMonitorId)) {
    return { ok: false, message: "Unrecognised monitor." };
  }
  const monitorId = rawMonitorId;

  try {
    return await runAnalysis(monitorId);
  } catch (err) {
    // Never throw out of a server action: a raw 500 leaves the operator unable
    // to tell whether any of the work happened.
    return { ok: false, message: sanitizeFailure(err) };
  }
}

async function runAnalysis(monitorId: string): Promise<AnalysisActionResult> {
  const cfg = getConfig();

  if (!canInterpret()) {
    return {
      ok: false,
      message:
        "Analysis is not configured. Set ANTHROPIC_API_KEY to enable interpretation.",
    };
  }

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

    const { result, cacheReadTokens } = await interpretEvidence(evidence);

    const problem = result.patch
      ? patchProblem(result.patch, {
          query: monitor.query,
          message: monitor.message,
        })
      : null;

    const rules = proposedRuleFrom(
      monitor.query ?? "",
      problem ? null : result.patch,
      evidence.monitor.thresholds.critical,
    );

    let counterfactual: string | undefined;
    if (rules.current && rules.proposed && episodes.length > 0) {
      const report = evaluateCounterfactual(
        [
          ...episodes,
          {
            label: "synthetic: 20m sustained breach",
            points: syntheticSustainedBreach(
              rules.proposed.threshold * 1.5,
              20,
            ),
          },
        ],
        rules.current,
        rules.proposed,
      );
      counterfactual = report.summary;
    }

    const recommendationId = await persistRecommendation({
      monitorId,
      monitorName: monitor.name,
      service: evidence.monitor.service,
      result,
      patchProblemText: problem,
      counterfactual,
      evidence,
    });

    await prisma.monitorAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: AnalysisStatus.Done,
        observedAt: new Date(),
        evidenceJson: JSON.stringify(evidence),
        resultSummary: result.title,
        recommendationId,
        cacheReadTokens,
      },
    });

    revalidatePath(`/monitors/${monitorId}`);
    revalidatePath("/recommendations");
    revalidatePath("/", "layout");

    return { ok: true, analysisId: analysis.id, recommendationId };
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
  result: AnalysisResult;
  patchProblemText: string | null;
  counterfactual?: string;
  evidence: Awaited<ReturnType<typeof collectMonitorEvidence>>["evidence"];
}

/**
 * Store the finding as a recommendation the Apply button can act on.
 *
 * Upserts on (monitorKey, issueType) like the ingest ledger merge, so
 * re-analysing a monitor refreshes its recommendation instead of accumulating
 * duplicates. A patch that failed `patchProblem` is deliberately stored as no
 * patch at all: the UI then says there is no monitor edit, which is true, and
 * offers no button that would quietly do nothing.
 */
async function persistRecommendation(input: PersistInput): Promise<string> {
  const { result, evidence } = input;

  const patch: ProposedPatch | undefined =
    result.patch && !input.patchProblemText
      ? {
          target: result.patch.target,
          prod: result.patch.prod ?? undefined,
          dev: result.patch.dev ?? undefined,
          priorityValue: result.patch.priorityValue ?? undefined,
          options: result.patch.options ?? undefined,
        }
      : undefined;

  const evidenceLines = [
    `${evidence.pages.totalFirings} firing(s) and ${evidence.pages.totalPages} page(s) over ${evidence.window.days}d;`,
    `${evidence.pages.withIncident} incident(s);`,
    `${evidence.pages.pagesOutsideWorkHours} outside work hours, ${evidence.pages.pagesOvernight} overnight.`,
  ];
  if (evidence.pages.ackSeconds) {
    evidenceLines.push(`Median ack ${evidence.pages.ackSeconds.p50}s.`);
  }
  if (evidence.metric.baseline) {
    evidenceLines.push(
      `Baseline p90 ${evidence.metric.baseline.p90.toFixed(3)}, max ${evidence.metric.baseline.max.toFixed(3)}.`,
    );
  }
  if (input.counterfactual) evidenceLines.push(`Replay: ${input.counterfactual}`);
  if (input.patchProblemText) {
    evidenceLines.push(`Patch withheld: ${input.patchProblemText}.`);
  }

  const confidence =
    result.confidence === "high"
      ? Confidence.High
      : result.confidence === "med"
        ? Confidence.Medium
        : Confidence.Low;

  const data = {
    monitorId: input.monitorId,
    monitorKey: input.monitorId,
    monitorName: input.monitorName,
    service: input.service ?? null,
    issueType: result.issueType,
    title: result.title,
    before: result.before ?? evidence.monitor.query,
    after: result.after ?? result.summary,
    changeSummary: result.summary,
    coveragePreserved: result.coveragePreserved,
    expectedImpact: input.counterfactual
      ? `${result.expectedImpact} (${input.counterfactual})`
      : result.expectedImpact,
    evidence: evidenceLines.join(" "),
    confidence,
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
    patchJson: patch ? JSON.stringify(patch) : null,
  };

  const row = await prisma.tuningRecommendation.upsert({
    where: {
      monitorKey_issueType: {
        monitorKey: input.monitorId,
        issueType: result.issueType,
      },
    },
    create: data,
    update: data,
  });
  return row.id;
}
