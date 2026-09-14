import { Confidence, IssueType } from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";
import { baselineFor } from "@/lib/ingest/patch-state";
import type { MonitorEvidence } from "./evidence";

/**
 * Turning an evidence bundle into recommendations, deterministically.
 *
 * Most of what makes a monitor page for nothing is mechanical, and a rule that
 * can be unit-tested is worth more than a judgement that has to be trusted —
 * especially when the output ends up one click away from a production monitor.
 * Nothing here calls a model or needs a credential beyond the Datadog and
 * incident.io reads that produced the bundle.
 *
 * What rules cannot do is explain *why* a service misbehaved: reading a trace,
 * separating a retry storm from a slow dependency, deciding whether a firing is
 * noise or a real defect worth a ticket. That judgement is the job of the
 * optional interpretation step, and its absence costs coverage of the causal
 * story, not of the remedy.
 */

export interface RuleRecommendation {
  issueType: string;
  title: string;
  summary: string;
  /** Undefined when the firing history was unavailable, so neither is claimed. */
  isNoise?: boolean;
  confidence: string;
  coveragePreserved: string;
  expectedImpact: string;
  before: string;
  after: string;
  patch?: ProposedPatch;
  followUps: { kind: string; summary: string }[];
}

/** Auto-resolution rate at or above which self-recovery is the norm. */
const SELF_RESOLVING_PCT = 80;

/**
 * Whether this monitor is over-reporting, or undefined when we cannot tell.
 *
 * Undefined is the important case. Without the firing history there is no
 * evidence either way, and returning false would assert "this is a real
 * signal" about a monitor nobody has looked at. The counts are zero in that
 * situation only because nothing was read.
 */
function isNoise(evidence: MonitorEvidence): boolean | undefined {
  const { pages } = evidence;
  if (!pages.historyAvailable) return undefined;
  return (
    pages.totalFirings > 0 &&
    pages.withIncident === 0 &&
    (pages.autoResolvedPct ?? 0) >= SELF_RESOLVING_PCT
  );
}

/** Why the firing history is missing, in one clause for an operator. */
function historyCaveat(evidence: MonitorEvidence): string {
  return evidence.sources.pageHistory === "not_configured"
    ? "Firing history unavailable (incident.io is not configured), so the page counts below are unknown rather than zero."
    : "Firing history could not be read, so the page counts below are unknown rather than zero.";
}

/** Firings at a sub-critical transition, which a gated page would not send. */
function warnFiringCount(evidence: MonitorEvidence): number {
  return Object.entries(evidence.pages.byLevel)
    .filter(([level]) => /warn/i.test(level))
    .reduce((sum, [, n]) => sum + n, 0);
}

/**
 * Gate a warning transition out of the pager.
 *
 * Datadog sends the whole message on every transition, so an ungated paging
 * handle turns the warning threshold into a second, lower paging threshold —
 * the opposite of what setting a warning threshold signals. The remedy touches
 * neither threshold, which is why it is safe to propose from config alone.
 */
function warnRoutingRecommendation(
  evidence: MonitorEvidence,
): RuleRecommendation | undefined {
  const f = evidence.findings.warnRouting;
  if (!f.warnPagesLikeCritical) return undefined;

  const warnFirings = warnFiringCount(evidence);
  const handles = f.pagingHandles;

  // One find/replace edits one handle. With several, the patch would fix only
  // the first and read as though it had fixed them all, so it is withheld and
  // the recommendation says what to do by hand.
  // The baseline is the message this patch was derived from. It matters most
  // for this rule: the replacement contains the `find`, so once applied the
  // transform matches its own output and nests. See patch-state.ts.
  const patch: ProposedPatch | undefined =
    handles.length === 1
      ? {
          target: "message",
          baseline: baselineFor("message", { message: evidence.monitor.message }),
          prod: {
            find: handles[0],
            replace: `{{#is_alert}}${handles[0]}{{/is_alert}}`,
          },
        }
      : undefined;

  const threshold = evidence.monitor.thresholds.warning;
  const critical = evidence.monitor.thresholds.critical;

  return {
    issueType: IssueType.WarnPagingLikeCritical,
    title: "Gate the page to the alert transition",
    summary:
      `A warning threshold${threshold != null ? ` (${threshold})` : ""} is configured, and ` +
      `${handles.join(", ")} is not wrapped in {{#is_alert}}, so a sub-critical ` +
      `breach pages exactly like a critical one` +
      (critical != null ? ` (critical is ${critical})` : "") +
      `.` +
      (patch
        ? ""
        : ` ${handles.length} paging handles are routed, so wrap each one by hand — a single find/replace would fix only the first.`),
    isNoise: isNoise(evidence),
    // The defect is visible in the configuration alone, so a missing history
    // lowers confidence in the impact estimate, not in the finding.
    confidence: warnFirings > 0 ? Confidence.High : Confidence.Medium,
    coveragePreserved:
      "A breach of the critical threshold still pages, unchanged.",
    expectedImpact: !evidence.pages.historyAvailable
      ? `Stops warning-level breaches paging. ${historyCaveat(evidence)}`
      : warnFirings > 0
        ? `Removes ${warnFirings} of ${evidence.pages.totalFirings} firing(s) from the pager.`
        : "No warning-level firing in the window; prevents future ones.",
    before: evidence.monitor.message ?? "",
    after: `the paging handle wrapped in {{#is_alert}}`,
    patch,
    followUps: [],
  };
}

/**
 * Replace a spike-sensitive window function with one that requires persistence.
 *
 * Only proposed when the evidence shows the threshold cannot be the remedy:
 * either one interval already clears it on its own, or the percentile is
 * computed over so few samples that it tracks the extreme tail. In both cases
 * the monitor is reporting "one request was slow", and any threshold below that
 * single-interval contribution leaves it firing.
 */
function aggregationRecommendation(
  evidence: MonitorEvidence,
): RuleRecommendation | undefined {
  const { aggregation, percentileStability } = evidence.findings;
  const parsed = evidence.monitor.parsed;
  if (!aggregation.singlePointSensitive) return undefined;
  if (!parsed.windowFn || !parsed.window) return undefined;

  const critical = evidence.monitor.thresholds.critical;
  const contribution = aggregation.singleIntervalContribution;
  const oneIntervalIsEnough =
    contribution != null && critical != null && contribution > critical;
  const thinPercentile = percentileStability?.behavesAsExtreme === true;

  // Without either signal this is just an averaged window, which is normal.
  if (!oneIntervalIsEnough && !thinPercentile) return undefined;
  // A monitor that has produced incidents is catching something real. With no
  // history this guard cannot be evaluated, so the finding still stands on the
  // metric evidence but the recommendation says the history is unknown.
  if (evidence.pages.historyAvailable && evidence.pages.withIncident > 0) {
    return undefined;
  }

  const find = `${parsed.windowFn}(${parsed.window})`;
  const replace = `min(${parsed.window})`;

  const reasons: string[] = [];
  if (oneIntervalIsEnough) {
    reasons.push(
      `one ${evidence.metric.volume?.intervalSeconds ?? 20}s interval at the observed peak adds ` +
        `${contribution!.toFixed(2)} to the window average on its own, against a threshold of ${critical} — ` +
        `so no threshold below ${contribution!.toFixed(2)} can suppress it`,
    );
  }
  if (thinPercentile) {
    reasons.push(
      `the p${percentileStability!.percentile} is computed over about ` +
        `${percentileStability!.samplesPerInterval} samples per interval, which makes it the ` +
        `${percentileStability!.samplesAbovePercentile === 1 ? "slowest" : `${percentileStability!.samplesAbovePercentile}nd slowest`} ` +
        `request rather than a percentile`,
    );
  }

  return {
    issueType: IssueType.AggregationWindowMismatch,
    title: "Require a sustained breach, not a spike",
    summary:
      `The threshold is not the defect: ${reasons.join("; and ")}. ` +
      `Changing ${find} to ${replace} requires every sample in the window to breach, ` +
      `so a transient spike cannot fire it.`,
    isNoise: isNoise(evidence),
    confidence: oneIntervalIsEnough ? Confidence.High : Confidence.Medium,
    coveragePreserved:
      "A breach that persists for the whole evaluation window still pages; " +
      "only spikes shorter than the window stop firing.",
    expectedImpact: evidence.pages.historyAvailable
      ? `Addresses ${evidence.pages.totalFirings} firing(s) over ${evidence.window.days}d that produced ${evidence.pages.withIncident} incident(s).`
      : `Stops spikes shorter than the evaluation window from firing. ${historyCaveat(evidence)}`,
    before: evidence.monitor.query,
    after: evidence.monitor.query.split(find).join(replace),
    patch: {
      target: "query",
      baseline: baselineFor("query", { query: evidence.monitor.query }),
      prod: { find, replace },
    },
    followUps: [
      {
        kind: "investigation",
        summary:
          "Consider require_full_window alongside this, so a partially-filled window cannot fire either.",
      },
    ],
  };
}

/**
 * The `resource_name` value inside a Datadog series scope.
 *
 * A grouped query labels each series with its whole scope, not just the tag it
 * grouped by — `env:prod,resource_name:get_/control/ready,service:svc-x`, with
 * the tags in an order the caller does not choose. Anything that assumes the
 * group tag comes first, or that the scope holds one tag, builds an exclusion
 * out of the wrong substring: the first real run produced
 * `!resource_name:prod,resource_name:get_/control/healthy,service:...`, which
 * Datadog would have rejected or, worse, quietly matched nothing.
 */
function resourceNameFrom(scope: string): string | undefined {
  const m = /(?:^|,)\s*resource_name:([^,]+)/.exec(scope);
  return m?.[1]?.trim() || undefined;
}

/**
 * Take infrastructure probes out of a customer-latency metric.
 *
 * Liveness and readiness probes answer in well under a millisecond and run
 * constantly, so they are a large share of the request count and contribute
 * nothing about customer experience — until the process stalls, when they stall
 * with it. A probe going from half a millisecond to a hundred seconds is not
 * latency, and a monitor that cannot tell the two apart is a liveness check
 * wearing a latency threshold.
 */
function probeContaminationRecommendation(
  evidence: MonitorEvidence,
): RuleRecommendation | undefined {
  const c = evidence.findings.probeContamination;
  if (!c || c.probeScopes.length === 0) return undefined;

  const parsed = evidence.monitor.parsed;
  if (!parsed.scope) return undefined;

  const resources = c.probeScopes
    .map(resourceNameFrom)
    .filter((r): r is string => r !== undefined);
  if (resources.length === 0) return undefined;

  const exclusions = resources.map((r) => `!resource_name:${r}`).join(",");
  const sharedStall = c.allEndpointsDegradedTogether;

  const followUps: { kind: string; summary: string }[] = [];
  if (sharedStall) {
    const throttled = evidence.infra?.cpuThrottledPeriods;
    const restarts = evidence.infra?.containerRestarts;
    followUps.push({
      kind: "infra",
      summary:
        "Every endpoint stalled together, including the probes, which is a stopped process rather than slow code. " +
        (throttled
          ? `CPU throttled periods peaked at ${throttled.max.toFixed(3)}` +
            (restarts ? ` with ${restarts.max} restart(s)` : "") +
            " — review the container CPU limit."
          : "Review the container CPU limit and restart history."),
    });
  }

  return {
    issueType: IssueType.VolatileDenominator,
    title: "Exclude infrastructure probes from the latency metric",
    summary:
      `${resources.join(" and ")} sit in the same metric as customer traffic but answer in ` +
      `under a millisecond, so they shape the percentile without saying anything about ` +
      `customer experience` +
      (sharedStall
        ? ", and they spiked alongside the business endpoint — which is a stalled process, not latency."
        : ".") +
      " Scoping them out makes the metric measure what the monitor claims to measure.",
    isNoise: isNoise(evidence),
    confidence: sharedStall ? Confidence.High : Confidence.Medium,
    coveragePreserved:
      "Customer-facing endpoints stay in scope; probe failures are a liveness concern and belong in their own monitor.",
    expectedImpact: sharedStall
      ? "Removes process-stall firings from a latency monitor; the underlying stall needs the infrastructure follow-up below."
      : "Makes the percentile reflect customer traffic only.",
    // No history caveat here: this finding rests on the metric breakdown, and
    // its impact statement makes no claim about page counts.
    before: parsed.scope,
    after: `${parsed.scope},${exclusions}`,
    patch: {
      target: "query",
      baseline: baselineFor("query", { query: evidence.monitor.query }),
      prod: { find: `{${parsed.scope}}`, replace: `{${parsed.scope},${exclusions}}` },
    },
    followUps,
  };
}

/**
 * Every recommendation the rules can reach for this monitor, most actionable
 * first.
 *
 * Returns an empty array when nothing mechanical is wrong — which is a real
 * answer, not a failure. A monitor with a defensible threshold, a sustained
 * window and no probe contamination needs either a causal investigation or
 * nothing at all, and inventing a change for it would be worse than saying so.
 */
export function recommendFromEvidence(
  evidence: MonitorEvidence,
): RuleRecommendation[] {
  return [
    warnRoutingRecommendation(evidence),
    aggregationRecommendation(evidence),
    probeContaminationRecommendation(evidence),
  ].filter((r): r is RuleRecommendation => r !== undefined);
}
