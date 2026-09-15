import type { MetricPoint } from "@/lib/clients/datadog";

/**
 * Replaying a proposed monitor rule against what actually happened.
 *
 * A recommendation to change a monitor is a claim about the future, and the
 * only honest way to check it is against the past: would this rule have
 * suppressed the pages that wasted someone's evening, and would it still have
 * caught a real degradation? Without that, approving a generated patch is an
 * act of trust. With it, it is a review.
 *
 * Deliberately deterministic and dependency-free. The numbers a reviewer is
 * asked to act on must not come from a model.
 */

export type WindowFn = "avg" | "min" | "max" | "sum";
export type Comparator = ">" | ">=" | "<" | "<=";

export interface ProposedRule {
  windowFn: WindowFn;
  windowSeconds: number;
  comparator: Comparator;
  threshold: number;
  /** `require_full_window`: refuse to evaluate a partially-filled window. */
  requireFullWindow?: boolean;
}

export interface ReplayResult {
  fired: boolean;
  firstBreachAtIso?: string;
  /** The most extreme value the window statistic reached. */
  peakStatistic?: number;
  /** Windows actually evaluated. Zero means the replay proved nothing. */
  evaluations: number;
}

function compare(value: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
  }
}

function statistic(values: number[], fn: WindowFn): number {
  switch (fn) {
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "sum":
      return values.reduce((a, b) => a + b, 0);
  }
}

/**
 * Slide the rule's window over a series and report whether it would have fired.
 *
 * The window is evaluated at every sample, closing on that sample, which is how
 * Datadog evaluates a rolling window. `requireFullWindow` skips windows that
 * the series does not cover — the same guard the monitor option provides, and
 * the reason a replay over a short series can legitimately evaluate nothing.
 */
export function replayRule(
  points: MetricPoint[],
  rule: ProposedRule,
): ReplayResult {
  if (points.length === 0) return { fired: false, evaluations: 0 };

  const sorted = [...points].sort((a, b) => a.at - b.at);
  const windowMs = rule.windowSeconds * 1000;
  const seriesStart = sorted[0].at;

  let evaluations = 0;
  let firstBreachAt: number | undefined;
  let peak: number | undefined;

  for (let i = 0; i < sorted.length; i++) {
    const closeAt = sorted[i].at;
    const openAt = closeAt - windowMs;

    // A window the series does not fully cover is not evidence either way.
    if (rule.requireFullWindow && openAt < seriesStart) continue;

    const values: number[] = [];
    for (let j = i; j >= 0 && sorted[j].at > openAt; j--) {
      values.push(sorted[j].value);
    }
    if (values.length === 0) continue;

    evaluations++;
    const stat = statistic(values, rule.windowFn);

    const moreExtreme =
      peak == null ||
      (rule.comparator === ">" || rule.comparator === ">="
        ? stat > peak
        : stat < peak);
    if (moreExtreme) peak = stat;

    if (firstBreachAt == null && compare(stat, rule.comparator, rule.threshold)) {
      firstBreachAt = closeAt;
    }
  }

  return {
    fired: firstBreachAt != null,
    firstBreachAtIso:
      firstBreachAt != null ? new Date(firstBreachAt).toISOString() : undefined,
    peakStatistic: peak,
    evaluations,
  };
}

/** One historical window to replay against — typically a past firing. */
export interface Episode {
  label: string;
  points: MetricPoint[];
  /** What the monitor actually did at the time, when known. */
  actuallyFired?: boolean;
}

export interface EpisodeOutcome {
  label: string;
  current: ReplayResult;
  proposed: ReplayResult;
  /** The current rule fires and the proposed one does not. */
  suppressed: boolean;
  /** Both fire — coverage is unchanged for this episode. */
  stillFires: boolean;
  /** Neither fires, so this episode says nothing about the change. */
  inconclusive: boolean;
}

export interface CounterfactualReport {
  episodes: EpisodeOutcome[];
  /** Episodes where the current rule fired. The pages actually paid for. */
  currentFiredCount: number;
  /** Of those, how many the proposed rule would have suppressed. */
  suppressedCount: number;
  /** Of those, how many would still fire. */
  stillFiringCount: number;
  /**
   * Episodes the replay could not evaluate — no data, or a window the series
   * did not cover. Reported rather than counted as a suppression, because
   * "we have no evidence" and "it would not have fired" are different claims.
   */
  inconclusiveCount: number;
  /**
   * A one-line claim safe to put in front of a reviewer, phrased only from what
   * the replay actually established.
   */
  summary: string;
}

/**
 * Replay both rules over every episode and count the outcomes.
 *
 * The headline a reviewer needs is two numbers, not one: how many real pages
 * this change would have removed, and whether anything that should have fired
 * still does. A change that suppresses everything is not obviously good — it
 * might just be blind.
 */
export function evaluateCounterfactual(
  episodes: Episode[],
  current: ProposedRule,
  proposed: ProposedRule,
): CounterfactualReport {
  const outcomes: EpisodeOutcome[] = episodes.map((ep) => {
    const c = replayRule(ep.points, current);
    const p = replayRule(ep.points, proposed);
    return {
      label: ep.label,
      current: c,
      proposed: p,
      suppressed: c.fired && !p.fired,
      stillFires: c.fired && p.fired,
      inconclusive: !c.fired,
    };
  });

  const currentFired = outcomes.filter((o) => o.current.fired).length;
  const suppressed = outcomes.filter((o) => o.suppressed).length;
  const stillFiring = outcomes.filter((o) => o.stillFires).length;
  const inconclusive = outcomes.filter((o) => o.inconclusive).length;

  return {
    episodes: outcomes,
    currentFiredCount: currentFired,
    suppressedCount: suppressed,
    stillFiringCount: stillFiring,
    inconclusiveCount: inconclusive,
    summary: summarize(currentFired, suppressed, stillFiring, inconclusive),
  };
}

function summarize(
  currentFired: number,
  suppressed: number,
  stillFiring: number,
  inconclusive: number,
): string {
  if (currentFired === 0) {
    return inconclusive > 0
      ? `Inconclusive: the current rule did not fire in any of the ${inconclusive} replayed window(s), so there is nothing to compare against.`
      : "Inconclusive: no episodes were replayed.";
  }

  const parts = [
    `Suppresses ${suppressed} of ${currentFired} replayed firing(s)`,
  ];
  if (stillFiring > 0) parts.push(`${stillFiring} would still fire`);
  if (inconclusive > 0) {
    parts.push(`${inconclusive} window(s) could not be evaluated`);
  }
  return `${parts.join("; ")}.`;
}

/**
 * A synthetic episode where the metric stays over the threshold for `minutes`.
 *
 * The other half of the check. Showing that a rule suppresses past noise is
 * only half an argument: it must still fire on the thing the monitor exists to
 * catch. Replaying against a made-up sustained breach is the cheapest way to
 * demonstrate that the change narrowed the trigger rather than removing it.
 */
export function syntheticSustainedBreach(
  value: number,
  minutes: number,
  intervalSeconds = 20,
  startMs = Date.UTC(2026, 0, 1),
): MetricPoint[] {
  const count = Math.max(1, Math.round((minutes * 60) / intervalSeconds));
  return Array.from({ length: count }, (_, i) => ({
    at: startMs + i * intervalSeconds * 1000,
    value,
  }));
}
