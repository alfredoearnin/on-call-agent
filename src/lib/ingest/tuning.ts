import type { AppConfig } from "@/lib/config";
import { Confidence, IssueType, Priority, RecommendationStatus } from "@/lib/constants";
import type { DatadogClient } from "@/lib/clients/datadog";
import type {
  NormalizedAlert,
  NormalizedMonitor,
  NormalizedRecommendation,
  ProposedPatch,
} from "@/lib/ingest/types";
import { toEpochSeconds } from "@/lib/ingest/window";

/** Simple percentile over a numeric sample (linear interpolation). */
export function percentile(points: number[], p: number): number | undefined {
  if (points.length === 0) return undefined;
  const sorted = [...points].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface MonitorSignals {
  monitor: NormalizedMonitor;
  fires: number;
  autoResolvedNoAck: number;
  nightPages: number;
  lastFiredAt?: Date;
  hasIncident: boolean;
}

function aggregate(
  monitors: NormalizedMonitor[],
  alerts: NormalizedAlert[],
  cfg: AppConfig,
): MonitorSignals[] {
  const byMonitor = new Map<string, MonitorSignals>();
  for (const m of monitors) {
    byMonitor.set(m.id, {
      monitor: m,
      fires: 0,
      autoResolvedNoAck: 0,
      nightPages: 0,
      hasIncident: false,
    });
  }
  const { nightStartHour, nightEndHour } = cfg.thresholds;
  for (const a of alerts) {
    if (!a.monitorId) continue;
    const sig = byMonitor.get(a.monitorId);
    if (!sig) continue;
    sig.fires += a.timesFired;
    if (a.disposition === "auto_resolved") sig.autoResolvedNoAck += 1;
    const hour = a.firedAt.getHours();
    const isNight =
      nightStartHour > nightEndHour
        ? hour >= nightStartHour || hour < nightEndHour
        : hour >= nightStartHour && hour < nightEndHour;
    if (isNight && a.priority === Priority.High) sig.nightPages += 1;
    if (!sig.lastFiredAt || a.firedAt > sig.lastFiredAt) sig.lastFiredAt = a.firedAt;
  }
  return [...byMonitor.values()];
}

function tripsNoiseBar(sig: MonitorSignals, cfg: AppConfig): boolean {
  const t = cfg.thresholds;
  if (sig.fires >= t.noiseMinFiresPerWeek) return true;
  if (t.flagAutoresolvedNoAck && sig.autoResolvedNoAck > 0) return true;
  if (t.flagNightPages && sig.nightPages > 0) return true;
  if (sig.monitor.state === "No Data") return true;
  return false;
}

function classifyIssue(m: NormalizedMonitor): IssueType {
  const hay = `${m.name} ${m.query ?? ""}`.toLowerCase();
  if (/hpa|utilization|cpu|memory|throttl|replica/.test(hay)) {
    if (m.cluster?.includes("dev") || m.envScope === "mixed")
      return IssueType.DevNoisePagingProd;
    return IssueType.InfraSaturationAutoscaled;
  }
  if (/apdex|anomal|ratio|error rate|deviation/.test(hay))
    return IssueType.VolatileDenominator;
  if (m.state === "No Data") {
    if (/duplicate|dup |bug|more than one/.test(hay))
      return IssueType.RecurringRealFailure;
    return IssueType.DeadMetricNoData;
  }
  const hasEnvScope = /env:prod|cluster_flavor:prod/.test(m.query ?? "");
  if (!hasEnvScope) return IssueType.ThresholdTooLoose;
  return IssueType.OwnershipReview;
}

function buildChange(
  issue: IssueType,
  m: NormalizedMonitor,
): {
  before: string;
  after: string;
  summary: string;
  coverage: string;
  patch?: ProposedPatch;
} {
  const routesHigh = (m.message ?? "").includes("incidentio-high");
  switch (issue) {
    case IssueType.InfraSaturationAutoscaled:
      return {
        before: m.message ?? "routes to the prod High page",
        after: "route the sustained-utilization branch -> @webhook-incidentio-low; keep OOM / pod-not-ready at HIGH",
        summary: "Route HIGH -> LOW (autoscaling handles it).",
        coverage: "A genuine capacity pin still pages HIGH.",
        patch: routesHigh
          ? {
              target: "message",
              prod: { find: "@webhook-incidentio-high", replace: "@webhook-incidentio-low" },
            }
          : undefined,
      };
    case IssueType.DevNoisePagingProd:
      return {
        before: m.query ?? "grouped without an env scope",
        after: "add cluster_flavor:prod / exclude dev-eks-cluster; route any dev branch to a dev Slack",
        summary: "Scope out dev + clear the orphan.",
        coverage: "Prod still pages High.",
        patch: m.query?.includes("kube_cluster_name")
          ? {
              target: "query",
              prod: {
                find: "kube_cluster_name}",
                replace: "kube_cluster_name} , cluster_flavor:prod",
              },
            }
          : undefined,
      };
    case IssueType.VolatileDenominator:
      return {
        before: m.query ?? "short evaluation window, no min-volume guard",
        after: "lengthen the window (last_5m -> last_15m / last_2h -> last_4h) and/or add a min-volume guard",
        summary: "Debounce and/or add a volume guard.",
        coverage: "A sustained real degradation still pages.",
        patch: m.query?.includes("last_5m")
          ? { target: "query", prod: { find: "last_5m", replace: "last_15m" } }
          : m.query?.includes("last_2h")
            ? { target: "query", prod: { find: "last_2h", replace: "last_4h" } }
            : undefined,
      };
    case IssueType.ThresholdTooLoose:
      return {
        before: m.query ?? "no env scope / no sustain",
        after: "add env:prod scope + a sustain window; tighten to a value grounded in the observed baseline",
        summary: "Add scope + sustain (baseline-grounded).",
        coverage: "A sustained real breach still alerts.",
      };
    case IssueType.DeadMetricNoData:
      return {
        before: "HIGH monitor stuck in No Data",
        after: "fix the metric name / re-point, or deprecate; note which live monitor already covers it",
        summary: "Fix or deprecate the dead metric.",
        coverage: "Live coverage remains via the surviving monitor.",
      };
    case IssueType.RecurringRealFailure:
      return {
        before: "monitor left as-is (catching a real condition)",
        after: "open/track a Jira code fix; once shipped, resolve or mute the stale alert",
        summary: "Do NOT tune — route to a Jira code fix.",
        coverage: "Monitor unchanged, so it keeps catching the failure.",
      };
    default:
      return {
        before: "current ownership / routing",
        after: "verify team ownership and whether non-prod should alert; re-tag or scope to env:prod",
        summary: "Verify ownership / scope.",
        coverage: "Prod paths still page.",
      };
  }
}

/**
 * Classify tuning candidates into concrete before -> after recommendations
 * (on-call.md Step 4/4b). Threshold-type changes are grounded in the metric's
 * observed baseline when a Datadog client is available.
 */
export async function classifyRecommendations(
  monitors: NormalizedMonitor[],
  alerts: NormalizedAlert[],
  cfg: AppConfig,
  dd?: DatadogClient,
  windowFromEpoch?: number,
  windowToEpoch?: number,
): Promise<NormalizedRecommendation[]> {
  const signals = aggregate(monitors, alerts, cfg).filter((s) =>
    tripsNoiseBar(s, cfg),
  );
  const out: NormalizedRecommendation[] = [];

  for (const sig of signals) {
    const m = sig.monitor;
    const issue = classifyIssue(m);
    const change = buildChange(issue, m);

    let evidence = `${sig.fires} fire(s) this wk; ${sig.autoResolvedNoAck} auto-resolved-no-ack; ${sig.nightPages} night page(s); state ${m.state}.`;

    // Baseline grounding for threshold changes (on-call.md Step 4b rule).
    if (
      issue === IssueType.ThresholdTooLoose &&
      dd &&
      m.query &&
      windowFromEpoch &&
      windowToEpoch
    ) {
      try {
        const pts = await dd.queryMetric(m.query, windowFromEpoch, windowToEpoch);
        const p90 = percentile(pts, 90);
        const max = pts.length ? Math.max(...pts) : undefined;
        if (p90 !== undefined && max !== undefined) {
          evidence += ` Baseline: p90 ~${p90.toFixed(2)}, max ${max.toFixed(2)}.`;
        } else {
          change.after += " (needs baseline — verify before applying)";
        }
      } catch {
        change.after += " (needs baseline — verify before applying)";
      }
    }

    const confidence =
      sig.fires >= cfg.thresholds.noiseMinFiresPerWeek
        ? Confidence.High
        : sig.nightPages > 0 || sig.autoResolvedNoAck > 0
          ? Confidence.Medium
          : Confidence.Low;

    out.push({
      monitorId: m.id,
      monitorKey: m.id,
      monitorName: m.name,
      service: m.service,
      issueType: issue,
      title: change.summary,
      before: change.before,
      after: change.after,
      changeSummary: change.summary,
      coveragePreserved: change.coverage,
      evidence,
      confidence,
      status: RecommendationStatus.Proposed, // escalated by streak in persist
      firesThisWeek: sig.fires,
      autoResolvedPct:
        sig.fires > 0
          ? Math.round((sig.autoResolvedNoAck / sig.fires) * 100)
          : undefined,
      nightPages: sig.nightPages,
      lastFiredAt: sig.lastFiredAt,
      patch: change.patch,
    });
  }

  return out;
}
