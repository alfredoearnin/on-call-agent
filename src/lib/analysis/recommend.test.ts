import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IssueType } from "@/lib/constants";
import type { MonitorEvidence } from "./evidence";
import {
  analyzeAggregation,
  analyzeWarnRouting,
  parseMonitorQuery,
  thresholdsFrom,
} from "./monitor-query";
import { recommendFromEvidence } from "./recommend";

/**
 * The acceptance test for the whole feature, with no model involved.
 *
 * The bundle below is monitor 243692163 as Datadog and incident.io actually
 * reported it: 14 firings over 60 days, five of them at the warning threshold,
 * zero incidents, a 0.11s baseline against a 1.0s threshold, and a 99.95s
 * single-interval p90 spike driven by Kubernetes probes stalling alongside the
 * business endpoint.
 *
 * What must come out is the two P0 changes with applicable patches. The
 * previous system, reading the same monitor, concluded "raise the threshold to
 * 2s" — a change these numbers show could not have suppressed a single one of
 * those pages.
 */
const QUERY =
  "avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences} > 1";
const MESSAGE =
  "`svc-notification-preferences` 90th percentile latency is too high.\n\n@webhook-incidentio-high";
const OPTIONS = {
  thresholds: { critical: 1, warning: 0.8 },
  require_full_window: false,
};

function evidence(overrides: Partial<MonitorEvidence> = {}): MonitorEvidence {
  const parsed = parseMonitorQuery(QUERY);
  const thresholds = thresholdsFrom(OPTIONS, parsed);

  const base: MonitorEvidence = {
    collectedAtIso: "2026-09-14T00:00:00.000Z",
    window: {
      fromIso: "2026-07-16T00:00:00.000Z",
      toIso: "2026-09-14T00:00:00.000Z",
      days: 60,
    },
    timezone: "America/Mexico_City",
    sources: {
      pageHistory: "available",
      metric: "available",
      perResource: "available",
      infra: "available",
    },
    monitor: {
      id: "243692163",
      name: "Service svc-notification-preferences has a high p90 latency on env:prod",
      query: QUERY,
      message: MESSAGE,
      state: "OK",
      service: "svc-notification-preferences",
      thresholds,
      options: OPTIONS,
      parsed,
    },
    pages: {
      historyAvailable: true,
      escalationsAvailable: true,
      firings: [],
      totalFirings: 14,
      byLevel: { Triggered: 9, Warn: 5 },
      withIncident: 0,
      autoResolvedPct: 100,
      selfResolveMinutes: { count: 14, min: 9, p50: 10, p90: 15, max: 17 },
      escalations: [],
      totalPages: 14,
      pagesOutsideWorkHours: 8,
      pagesOvernight: 1,
      ackSeconds: { count: 13, min: 1, p50: 15, p90: 93, max: 108 },
    },
    metric: {
      query: "p90:trace.aspnet_core.request{env:prod,service:svc-notification-preferences}",
      baseline: { count: 180, min: 0.085, p50: 0.11, p90: 0.13, max: 0.149 },
      byResource: [
        {
          scope: "env:prod,resource_name:get_/control/healthy,service:svc-notification-preferences",
          baseline: { count: 150, min: 0.0004, p50: 0.0005, p90: 0.0006, max: 111.41 },
          peak: 111.41,
          peakOverMedian: 222820,
        },
        {
          scope: "env:prod,resource_name:get_/control/ready,service:svc-notification-preferences",
          baseline: { count: 150, min: 0.0004, p50: 0.0005, p90: 0.0006, max: 20.23 },
          peak: 20.23,
          peakOverMedian: 40460,
        },
        {
          scope: "env:prod,resource_name:get_/external/preferences,service:svc-notification-preferences",
          baseline: { count: 150, min: 0.069, p50: 0.1, p90: 0.15, max: 29.82 },
          peak: 29.82,
          peakOverMedian: 298.2,
        },
      ],
      volume: {
        perInterval: { count: 180, min: 8, p50: 15, p90: 24, max: 31 },
        intervalSeconds: 20,
      },
    },
    infra: {
      cpuThrottledPeriods: { count: 180, min: 0, p50: 0, p90: 0.05, max: 0.357 },
      containerRestarts: { count: 180, min: 0, p50: 0, p90: 0, max: 0 },
      memoryUsagePct: { count: 180, min: 0.119, p50: 0.129, p90: 0.132, max: 0.134 },
    },
    findings: {
      warnRouting: analyzeWarnRouting(MESSAGE, thresholds),
      aggregation: analyzeAggregation(parsed, OPTIONS, 99.954327, 20),
      percentileStability: {
        percentile: 90,
        samplesPerInterval: 15,
        samplesAbovePercentile: 2,
        behavesAsExtreme: true,
      },
      probeContamination: {
        probeScopes: [
          "env:prod,resource_name:get_/control/healthy,service:svc-notification-preferences",
          "env:prod,resource_name:get_/control/ready,service:svc-notification-preferences",
        ],
        stalledProbeScopes: [
          "env:prod,resource_name:get_/control/healthy,service:svc-notification-preferences",
          "env:prod,resource_name:get_/control/ready,service:svc-notification-preferences",
        ],
        allEndpointsDegradedTogether: true,
      },
    },
  };

  return { ...base, ...overrides };
}

describe("recommendFromEvidence", () => {
  it("reaches all three findings for monitor 243692163", () => {
    const recs = recommendFromEvidence(evidence());

    assert.deepEqual(
      recs.map((r) => r.issueType),
      [
        IssueType.WarnPagingLikeCritical,
        IssueType.AggregationWindowMismatch,
        IssueType.VolatileDenominator,
      ],
    );
  });

  /**
   * The single most valuable rule in the codebase, and one that needs no metric
   * data at all: five of the fourteen pages came from a 0.8s warning threshold
   * reaching a High-priority handle.
   */
  it("emits an applicable patch that gates the pager to the alert transition", () => {
    const rec = recommendFromEvidence(evidence()).find(
      (r) => r.issueType === IssueType.WarnPagingLikeCritical,
    );

    assert.equal(rec?.patch?.target, "message");
    assert.equal(rec?.patch?.prod?.find, "@webhook-incidentio-high");
    assert.equal(
      rec?.patch?.prod?.replace,
      "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}",
    );
    // The find string must occur in the monitor's real message, or the apply
    // path would treat the patch as a drift no-op.
    assert.ok(MESSAGE.includes(rec!.patch!.prod!.find));
    assert.match(rec!.expectedImpact, /Removes 5 of 14/);
  });

  /**
   * The rule that stops the team being sent to do work that cannot help. The
   * summary has to carry the number, because "raise the threshold" is the
   * intuitive fix and only the arithmetic rules it out.
   */
  it("emits a patch that requires persistence, and says why the threshold cannot work", () => {
    const rec = recommendFromEvidence(evidence()).find(
      (r) => r.issueType === IssueType.AggregationWindowMismatch,
    );

    assert.equal(rec?.patch?.target, "query");
    assert.equal(rec?.patch?.prod?.find, "avg(last_10m)");
    assert.equal(rec?.patch?.prod?.replace, "min(last_10m)");
    assert.ok(QUERY.includes(rec!.patch!.prod!.find));

    assert.match(rec!.summary, /threshold is not the defect/i);
    assert.match(rec!.summary, /3\.33/);
    assert.match(rec!.summary, /no threshold below 3\.33 can suppress it/);
    assert.match(rec!.summary, /15 samples per interval/);
  });

  it("emits a patch that scopes the probes out, and an infrastructure follow-up", () => {
    const rec = recommendFromEvidence(evidence()).find(
      (r) => r.issueType === IssueType.VolatileDenominator,
    );

    assert.equal(rec?.patch?.target, "query");
    assert.equal(
      rec?.patch?.prod?.find,
      "{env:prod,service:svc-notification-preferences}",
    );
    assert.match(rec!.patch!.prod!.replace, /!resource_name:get_\/control\/healthy/);
    assert.match(rec!.patch!.prod!.replace, /!resource_name:get_\/control\/ready/);
    assert.ok(QUERY.includes(rec!.patch!.prod!.find));

    // The regression from the first real run. Datadog labels a grouped series
    // with its whole scope in an arbitrary tag order, so anything that assumes
    // the grouped tag comes first produced
    // `!resource_name:prod,resource_name:get_/control/healthy,service:...`.
    assert.doesNotMatch(
      rec!.patch!.prod!.replace,
      /!resource_name:(prod|env|service)/,
      `exclusion was built from the wrong part of the scope: ${rec!.patch!.prod!.replace}`,
    );
    // A mangled exclusion carries a second tag inside its value, which shows
    // up as a colon where only a resource name should be.
    assert.doesNotMatch(
      rec!.patch!.prod!.replace,
      /!resource_name:[^,}]*:/,
      `an exclusion value swallowed another tag: ${rec!.patch!.prod!.replace}`,
    );

    const infra = rec!.followUps.find((f) => f.kind === "infra");
    assert.match(infra!.summary, /stopped process rather than slow code/);
    assert.match(infra!.summary, /0\.357/);
    assert.match(infra!.summary, /CPU limit/);
  });

  it("marks the monitor as noise, since nothing it reported became an incident", () => {
    for (const rec of recommendFromEvidence(evidence())) {
      assert.equal(rec.isNoise, true, rec.issueType);
    }
  });

  /**
   * The restraint cases. A rules engine that always finds something is not
   * detecting anything.
   */
  it("withholds the aggregation change once the monitor has caught a real incident", () => {
    const withIncident = evidence();
    withIncident.pages = { ...withIncident.pages, withIncident: 2 };

    const recs = recommendFromEvidence(withIncident);

    assert.equal(
      recs.some((r) => r.issueType === IssueType.AggregationWindowMismatch),
      false,
    );
    // The routing defect is independent of whether the monitor catches real
    // problems, so it survives.
    assert.equal(
      recs.some((r) => r.issueType === IssueType.WarnPagingLikeCritical),
      true,
    );
  });

  it("says nothing about an averaged window when no signal justifies it", () => {
    const healthy = evidence();
    healthy.findings = {
      ...healthy.findings,
      aggregation: analyzeAggregation(
        parseMonitorQuery(QUERY),
        OPTIONS,
        // A peak that does not clear the threshold on its own.
        0.4,
        20,
      ),
      percentileStability: {
        percentile: 90,
        samplesPerInterval: 500,
        samplesAbovePercentile: 50,
        behavesAsExtreme: false,
      },
    };

    assert.equal(
      recommendFromEvidence(healthy).some(
        (r) => r.issueType === IssueType.AggregationWindowMismatch,
      ),
      false,
    );
  });

  it("withholds the routing patch when several handles would need wrapping", () => {
    const twoHandles = evidence();
    const message = `${MESSAGE}\n@pagerduty-growth`;
    twoHandles.monitor = { ...twoHandles.monitor, message };
    twoHandles.findings = {
      ...twoHandles.findings,
      warnRouting: analyzeWarnRouting(message, twoHandles.monitor.thresholds),
    };

    const rec = recommendFromEvidence(twoHandles).find(
      (r) => r.issueType === IssueType.WarnPagingLikeCritical,
    );

    assert.equal(rec?.patch, undefined);
    assert.match(rec!.summary, /wrap each one by hand/);
  });

  it("returns nothing for a monitor with no mechanical defect", () => {
    const clean = evidence();
    const query =
      "min(last_15m):avg:trace.aspnet_core.request{env:prod,service:x} > 1";
    const parsed = parseMonitorQuery(query);
    clean.monitor = {
      ...clean.monitor,
      query,
      message: "`x` latency is too high.\n\n@slack-team",
      parsed,
      thresholds: { critical: 1 },
    };
    clean.metric = { ...clean.metric, byResource: undefined };
    clean.findings = {
      warnRouting: analyzeWarnRouting(clean.monitor.message, { critical: 1 }),
      aggregation: analyzeAggregation(parsed, {}, 0.3, 20),
      percentileStability: undefined,
      probeContamination: undefined,
    };

    assert.deepEqual(recommendFromEvidence(clean), []);
  });
});

/**
 * The case that actually happened on the first real run: Datadog was
 * configured, incident.io was not, and the bundle came back with every page
 * count at zero.
 *
 * Zero firings and an unknown firing history are different claims. Reporting
 * the first when the second is true is how "this monitor never pages" gets
 * asserted about a monitor that paged fourteen times — the exact failure this
 * whole feature exists to correct, so it must not be reintroduced here.
 */
describe("recommendFromEvidence without a firing history", () => {
  function noHistory(): MonitorEvidence {
    const e = evidence();
    e.sources = { ...e.sources, pageHistory: "not_configured" };
    e.pages = {
      ...e.pages,
      historyAvailable: false,
      escalationsAvailable: false,
      firings: [],
      totalFirings: 0,
      byLevel: {},
      withIncident: 0,
      autoResolvedPct: undefined,
      selfResolveMinutes: undefined,
      escalations: [],
      totalPages: 0,
      pagesOutsideWorkHours: 0,
      pagesOvernight: 0,
      ackSeconds: undefined,
    };
    return e;
  }

  it("still finds the config defects, which need no history", () => {
    const recs = recommendFromEvidence(noHistory());

    assert.ok(
      recs.some((r) => r.issueType === IssueType.WarnPagingLikeCritical),
      "the warning-routing defect is visible in the message alone",
    );
    assert.ok(
      recs.some((r) => r.issueType === IssueType.AggregationWindowMismatch),
      "the aggregation defect is visible in the metric alone",
    );
  });

  it("never claims a page count it does not have", () => {
    for (const rec of recommendFromEvidence(noHistory())) {
      assert.doesNotMatch(
        rec.expectedImpact,
        /\b0 (firing|page|incident)/,
        `${rec.issueType} reported a zero count as though it were measured: ${rec.expectedImpact}`,
      );
    }
  });

  it("says the history is unknown rather than staying silent", () => {
    const withCaveat = recommendFromEvidence(noHistory()).filter((r) =>
      /unknown rather than zero/.test(r.expectedImpact),
    );

    assert.ok(
      withCaveat.length >= 2,
      "the recommendations whose impact depends on history must name the gap",
    );
    assert.match(withCaveat[0].expectedImpact, /incident\.io is not configured/);
  });

  it("leaves the noise verdict undefined instead of guessing", () => {
    for (const rec of recommendFromEvidence(noHistory())) {
      assert.equal(rec.isNoise, undefined, rec.issueType);
    }
  });
});
