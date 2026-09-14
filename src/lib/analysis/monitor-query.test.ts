import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeAggregation,
  analyzeWarnRouting,
  parseMonitorQuery,
  thresholdsFrom,
} from "./monitor-query";

/**
 * The fixtures are monitors 243692163 and 243692043 on
 * `svc-notification-preferences`, verbatim from Datadog.
 *
 * Between 2026-06-12 and 2026-09-12 that pair paged the Growth rotation 23
 * times, resolved itself every time in 9-17 minutes, and produced no incident
 * and no customer impact. Five of the fourteen p90 pages fired at the *warning*
 * threshold. Both defects below are visible in these two strings alone, which is
 * why they belong in rules rather than in a prompt.
 */
const P90 = {
  query:
    "avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 1",
  message:
    "`svc-notification-preferences` 90th percentile latency is too high.\n\nReview [Runbook](https://example.invalid/runbook)\n\n@webhook-incidentio-high",
  options: { thresholds: { critical: 1, warning: 0.8 }, require_full_window: false },
};

const AVG = {
  query:
    "avg(last_10m):avg:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 0.7",
  message:
    "`svc-notification-preferences` average latency is too high.\n\n@webhook-incidentio-low",
  options: { thresholds: { critical: 0.7 } },
};

describe("parseMonitorQuery", () => {
  it("reads the window function, aggregation and threshold of a percentile monitor", () => {
    const p = parseMonitorQuery(P90.query);

    assert.equal(p.windowFn, "avg");
    assert.equal(p.window, "last_10m");
    assert.equal(p.windowSeconds, 600);
    assert.equal(p.spaceAgg, "p90");
    assert.equal(p.metric, "trace.aspnet_core.request");
    assert.equal(p.comparator, ">");
    assert.equal(p.queryThreshold, 1);
    assert.equal(p.isPercentile, true);
  });

  it("does not mistake a mean for a percentile", () => {
    assert.equal(parseMonitorQuery(AVG.query).isPercentile, false);
  });

  it("reads a percentile() window function", () => {
    const p = parseMonitorQuery(
      "percentile(last_5m):p90:trace.amazonsqs.receive{env:prod, service:job-x} > 20",
    );

    assert.equal(p.windowFn, "percentile");
    assert.equal(p.windowSeconds, 300);
    assert.equal(p.queryThreshold, 20);
  });

  it("keeps the scope but leaves the metric unset on a ratio expression", () => {
    const p = parseMonitorQuery(
      "avg(last_10m):( sum:trace.grpc.server.duration{env:prod,service:s}.rollup(sum).fill(zero) / sum:trace.grpc.server.hits{env:prod,service:s} ) > 0.5",
    );

    assert.equal(p.windowFn, "avg");
    assert.equal(p.queryThreshold, 0.5);
    assert.equal(p.metric, undefined);
    assert.ok(p.scope?.includes("service:s"));
  });

  /**
   * A composite or formula monitor must leave the window function unset rather
   * than guess one. "We could not read it" and "it is an average" lead to
   * opposite recommendations.
   */
  it("returns nothing it cannot read", () => {
    const p = parseMonitorQuery("1234 && 5678");

    assert.equal(p.windowFn, undefined);
    assert.equal(p.windowSeconds, undefined);
    assert.equal(p.isPercentile, false);
  });

  it("survives an empty query", () => {
    assert.deepEqual(parseMonitorQuery(""), { isPercentile: false });
  });
});

describe("thresholdsFrom", () => {
  it("reads both tiers from options", () => {
    const t = thresholdsFrom(P90.options, parseMonitorQuery(P90.query));

    assert.equal(t.critical, 1);
    assert.equal(t.warning, 0.8);
  });

  it("falls back to the query comparison when options carry no thresholds", () => {
    const t = thresholdsFrom(undefined, parseMonitorQuery(AVG.query));

    assert.equal(t.critical, 0.7);
    assert.equal(t.warning, undefined);
  });
});

describe("analyzeWarnRouting", () => {
  /**
   * The finding behind 5 of the 14 pages: a 0.8s warning threshold reaching
   * `@webhook-incidentio-high`, which routes to the High priority alert source
   * and pages the on-call engineer.
   */
  it("flags a warning threshold that reaches an ungated pager", () => {
    const f = analyzeWarnRouting(
      P90.message,
      thresholdsFrom(P90.options, parseMonitorQuery(P90.query)),
    );

    assert.equal(f.hasWarningThreshold, true);
    assert.equal(f.routesToPager, true);
    assert.equal(f.pagerGatedToAlert, false);
    assert.equal(f.warnPagesLikeCritical, true);
    assert.deepEqual(f.pagingHandles, ["@webhook-incidentio-high"]);
  });

  it("clears the finding once the handle is gated to the alert transition", () => {
    const fixed = P90.message.replace(
      "@webhook-incidentio-high",
      "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}",
    );

    const f = analyzeWarnRouting(
      fixed,
      thresholdsFrom(P90.options, parseMonitorQuery(P90.query)),
    );

    assert.equal(f.pagerGatedToAlert, true);
    assert.equal(f.warnPagesLikeCritical, false);
  });

  /**
   * Partial gating is the dangerous middle case: one handle wrapped, another
   * left bare still pages on warn, so it must not read as fixed.
   */
  it("does not treat partial gating as gated", () => {
    const f = analyzeWarnRouting(
      "{{#is_alert}}@pagerduty-team{{/is_alert}} @webhook-incidentio-high",
      { critical: 1, warning: 0.8 },
    );

    assert.equal(f.pagerGatedToAlert, false);
    assert.equal(f.warnPagesLikeCritical, true);
  });

  it("does not flag a monitor with no warning threshold", () => {
    const f = analyzeWarnRouting(P90.message, { critical: 1 });

    assert.equal(f.hasWarningThreshold, false);
    assert.equal(f.warnPagesLikeCritical, false);
  });

  /** A Slack-only route is not a page, whatever its thresholds do. */
  it("does not flag a monitor that only routes to a channel", () => {
    const f = analyzeWarnRouting(AVG.message, { critical: 0.7, warning: 0.5 });

    assert.equal(f.routesToPager, false);
    assert.equal(f.warnPagesLikeCritical, false);
  });
});

describe("analyzeAggregation", () => {
  /**
   * The finding that invalidates raising the threshold.
   *
   * At the metric's 20-second resolution a 10-minute window holds 30 intervals.
   * On 2026-09-12 the p90 reached 99.95s in a single interval, which by itself
   * adds 99.95/30 = 3.33s to the averaged window — already 3x the 1.0s
   * threshold. Raising the threshold to 2s, as was proposed at the time, would
   * not have suppressed that page, and neither would 3s.
   */
  it("shows one interval clearing the threshold on its own", () => {
    const parsed = parseMonitorQuery(P90.query);
    const f = analyzeAggregation(parsed, P90.options, 99.954327, 20);

    assert.equal(f.singlePointSensitive, true);
    assert.equal(f.requiresFullWindow, false);
    assert.equal(f.intervalsInWindow, 30);
    assert.ok(f.singleIntervalContribution != null);
    assert.ok(
      f.singleIntervalContribution > 3.3 && f.singleIntervalContribution < 3.4,
      `expected ~3.33, got ${f.singleIntervalContribution}`,
    );
    // The point of the number: it exceeds the configured critical threshold.
    assert.ok(f.singleIntervalContribution > (P90.options.thresholds.critical ?? 0));
  });

  /** `min` is the remedy: every interval must breach, so a spike cannot fire it. */
  it("does not flag a min() window as single-point sensitive", () => {
    const parsed = parseMonitorQuery(
      "min(last_15m):p90:trace.aspnet_core.request{env:prod,service:x} > 1",
    );
    const f = analyzeAggregation(parsed, { require_full_window: true }, 99.95, 20);

    assert.equal(f.singlePointSensitive, false);
    assert.equal(f.requiresFullWindow, true);
    assert.equal(f.singleIntervalContribution, undefined);
  });

  it("reports no contribution when the peak is unknown", () => {
    const f = analyzeAggregation(parseMonitorQuery(P90.query), P90.options);

    assert.equal(f.singlePointSensitive, true);
    assert.equal(f.singleIntervalContribution, undefined);
  });

  it("says nothing about a window function it could not read", () => {
    const f = analyzeAggregation(parseMonitorQuery("1234 && 5678"), undefined, 50);

    assert.equal(f.singlePointSensitive, false);
    assert.equal(f.intervalsInWindow, undefined);
  });
});
