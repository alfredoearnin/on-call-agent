import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MetricPoint } from "@/lib/clients/datadog";
import type {
  IncidentIoAlert,
  IncidentIoEscalation,
} from "@/lib/clients/incidentio";
import { parseMonitorQuery } from "./monitor-query";
import {
  analyzePercentileStability,
  analyzeProbeContamination,
  levelFromTitle,
  shapeFirings,
  shapePageFacts,
  shapePages,
  shapeResourceSeries,
  summarize,
} from "./evidence";

/**
 * Every fixture here is a real observation from monitors 243692163/243692043 on
 * `svc-notification-preferences` between June and September 2026.
 *
 * These tests are the load-bearing ones for the whole analysis feature. The
 * interpretation step can only be as good as this bundle: if the per-resource
 * breakdown or the sample-size signal is missing, a model reading the bundle
 * will conclude the threshold is too loose, because that is the only conclusion
 * the remaining data supports. That is precisely the wrong answer the previous
 * system produced.
 */
const TZ = "America/Mexico_City";

describe("summarize", () => {
  it("reports the distribution of a series", () => {
    const s = summarize([0.1, 0.2, 0.3, 0.4, 100]);

    assert.equal(s?.count, 5);
    assert.equal(s?.min, 0.1);
    assert.equal(s?.max, 100);
    assert.equal(s?.p50, 0.3);
  });

  it("returns nothing for an empty series rather than zeroes", () => {
    // Zeroes would read as "the metric is flat at zero", which is a finding.
    assert.equal(summarize([]), undefined);
  });

  it("handles a single sample", () => {
    const s = summarize([0.42]);
    assert.equal(s?.p50, 0.42);
    assert.equal(s?.p90, 0.42);
  });
});

describe("levelFromTitle", () => {
  it("separates a warning transition from an alert", () => {
    assert.equal(
      levelFromTitle(
        "[Warn] Service svc-notification-preferences has a high p90 latency on env:prod",
      ),
      "Warn",
    );
    assert.equal(
      levelFromTitle(
        "[Triggered] Service svc-notification-preferences has a high p90 latency on env:prod",
      ),
      "Triggered",
    );
  });

  it("does not guess a level it cannot read", () => {
    assert.equal(levelFromTitle("no bracket here"), "Unknown");
    assert.equal(levelFromTitle(undefined), "Unknown");
  });
});

/**
 * Six of the fourteen p90 firings, spanning the interesting cases: the warning
 * transitions that paged anyway, and the 02:36 local page on 2026-09-09 that
 * started the whole review.
 */
const ALERTS: IncidentIoAlert[] = [
  {
    id: "01M22MYNW6PNG20TZDS1Y8XPTB",
    title: "[Warn] Service svc-notification-preferences has a high p90 latency on env:prod",
    created_at: "2026-09-09T08:36:04Z",
    resolved_at: "2026-09-09T08:46:04Z",
    priority: { name: "High" },
  },
  {
    id: "01M26V4GQNVTQ2HSV66DY5TC46",
    title: "[Triggered] Service svc-notification-preferences has a high p90 latency on env:prod",
    created_at: "2026-09-10T23:41:05Z",
    resolved_at: "2026-09-10T23:56:05Z",
    priority: { name: "High" },
  },
  {
    id: "01M27C9V4PA6GJGSBFNPZGFVQX",
    title: "[Triggered] Service svc-notification-preferences has a high p90 latency on env:prod",
    created_at: "2026-09-11T04:41:05Z",
    resolved_at: "2026-09-11T04:50:05Z",
    priority: { name: "High" },
  },
  {
    id: "01M1WWW6KY2QXKP0EWE0TEN5Y4",
    title: "[Warn] Service svc-notification-preferences has a high p90 latency on env:prod",
    created_at: "2026-09-07T02:59:05Z",
    resolved_at: "2026-09-07T03:16:04Z",
    priority: { name: "High" },
  },
];

describe("shapeFirings", () => {
  /**
   * The hour must be local, not UTC. 08:36 UTC on 2026-09-09 is 02:36 in Mexico
   * City, which is what makes it an overnight page — the single most expensive
   * kind, and invisible if the timestamp is left in UTC.
   */
  it("converts each firing to the team's local hour", () => {
    const firings = shapeFirings(ALERTS, TZ);
    const overnight = firings.find((f) => f.atIso === "2026-09-09T08:36:04.000Z");

    assert.equal(overnight?.localHour, 2);
    assert.equal(overnight?.level, "Warn");
  });

  it("measures how long each firing took to resolve itself", () => {
    const firings = shapeFirings(ALERTS, TZ);
    const f = firings.find((x) => x.atIso === "2026-09-09T08:36:04.000Z");

    assert.equal(f?.minutesToResolve, 10);
  });

  it("returns firings oldest first", () => {
    const firings = shapeFirings(ALERTS, TZ);
    const times = firings.map((f) => f.atIso);

    assert.deepEqual(times, [...times].sort());
  });

  it("drops an alert with no usable timestamp instead of anchoring it to now", () => {
    const firings = shapeFirings([{ id: "x", title: "[Warn] x" }], TZ);
    assert.equal(firings.length, 0);
  });
});

const ESCALATIONS: IncidentIoEscalation[] = [
  {
    id: "01M22MYP5DGP1G08GG588HC26E",
    created_at: "2026-09-09T08:36:04Z",
    status: "cancelled",
    paged_users: [{ name: "Edder Nunez" }],
    escalation_path: { name: "L2-PENG-Growth" },
  },
  {
    id: "01M26V4GZ8G4ZC9GKQH3TCTEJJ",
    created_at: "2026-09-10T23:41:05Z",
    acked_at: "2026-09-10T23:41:18Z",
    status: "resolved",
    paged_users: [{ name: "Edder Nunez" }],
    escalation_path: { name: "L2-PENG-Growth" },
  },
  {
    id: "01M27C9VCAEQ75PX95F9VRJBJK",
    created_at: "2026-09-11T04:41:05Z",
    acked_at: "2026-09-11T04:41:14Z",
    status: "resolved",
    paged_users: [{ name: "Edder Nunez" }],
    escalation_path: { name: "L2-PENG-Growth" },
  },
  {
    id: "01M1WWW6X5YYKXZ98KVAMSWT9A",
    created_at: "2026-09-07T02:59:05Z",
    acked_at: "2026-09-07T03:00:38Z",
    status: "resolved",
    paged_users: [{ name: "aiden.ramgoolam" }],
    escalation_path: { name: "L2-PENG-Growth" },
  },
];

describe("shapePages and shapePageFacts", () => {
  /**
   * A median ack of seconds is the strongest noise signal there is: the
   * responder looked, saw nothing wrong, and closed it. It cannot be derived
   * from alerts alone, which is why escalations are fetched separately.
   */
  it("measures ack latency", () => {
    const pages = shapePages(ESCALATIONS, TZ);
    const facts = shapePageFacts(shapeFirings(ALERTS, TZ), pages);

    assert.equal(facts.ackSeconds?.count, 3);
    assert.equal(facts.ackSeconds?.min, 9);
    assert.equal(facts.ackSeconds?.max, 93);
    assert.equal(facts.ackSeconds?.p50, 13);
  });

  it("counts pages outside working hours and overnight separately", () => {
    const facts = shapePageFacts(
      shapeFirings(ALERTS, TZ),
      shapePages(ESCALATIONS, TZ),
    );

    // 02:36, 17:41, 22:41, 20:59 local -> three outside 09:00-18:00, one of
    // them overnight.
    assert.equal(facts.pagesOutsideWorkHours, 3);
    assert.equal(facts.pagesOvernight, 1);
    assert.equal(facts.totalPages, 4);
  });

  it("splits firings by transition level", () => {
    const facts = shapePageFacts(shapeFirings(ALERTS, TZ), []);

    assert.equal(facts.byLevel.Warn, 2);
    assert.equal(facts.byLevel.Triggered, 2);
  });

  /**
   * Zero incidents across every firing is the finding that makes the whole
   * monitor a noise case rather than a detection case.
   */
  it("reports that no firing produced an incident", () => {
    const facts = shapePageFacts(shapeFirings(ALERTS, TZ), []);

    assert.equal(facts.withIncident, 0);
    assert.equal(facts.autoResolvedPct, 100);
    assert.equal(facts.selfResolveMinutes?.max, 17);
  });
});

/**
 * The 2026-09-12 18:44-18:47 UTC window, per-resource. A liveness probe that
 * normally answers in half a millisecond took 111 seconds; the readiness probe
 * took 20; the business endpoint took 30. Every endpoint stalled at once, which
 * is a stopped process, not slow code.
 */
/** Samples every 20s from 2026-09-12T18:44:00Z, so index 3 is 18:45:00Z. */
function series(values: number[], startMs = 1789238640000): MetricPoint[] {
  return values.map((value, i) => ({ at: startMs + i * 20_000, value }));
}

const BY_RESOURCE = new Map<string, MetricPoint[]>([
  [
    "resource_name:get_/control/healthy",
    series([0.0005, 0.0005, 0.0006, 111.412849, 0.0005, 0.0005]),
  ],
  [
    "resource_name:get_/control/ready",
    series([0.0005, 0.0005, 0.0005, 20.236243, 0.0006, 0.0005]),
  ],
  [
    "resource_name:get_/external/preferences",
    series([0.1, 0.1, 0.11, 29.826188, 0.1, 0.1]),
  ],
]);

describe("shapeResourceSeries", () => {
  it("keeps each resource's own baseline and peak", () => {
    const shaped = shapeResourceSeries(BY_RESOURCE);
    const probe = shaped.find((s) => s.scope.endsWith("get_/control/healthy"));

    assert.equal(probe?.peak, 111.412849);
    assert.ok(probe != null && probe.baseline.p50 < 0.001);
    assert.equal(probe?.peakAtIso, "2026-09-12T18:45:00.000Z");
  });

  it("orders resources by peak so the worst is first", () => {
    const shaped = shapeResourceSeries(BY_RESOURCE);
    assert.equal(shaped[0].scope, "resource_name:get_/control/healthy");
  });
});

describe("analyzeProbeContamination", () => {
  it("identifies sub-millisecond probes sharing the metric", () => {
    const c = analyzeProbeContamination(shapeResourceSeries(BY_RESOURCE));

    assert.deepEqual(c?.probeScopes.sort(), [
      "resource_name:get_/control/healthy",
      "resource_name:get_/control/ready",
    ]);
  });

  /**
   * The distinction the whole modo-B diagnosis rests on. When the probes stall
   * alongside the business endpoint, the monitor is reporting a stopped process
   * and the remedy is CPU limits, not a latency threshold.
   */
  it("reports that every endpoint degraded together", () => {
    const c = analyzeProbeContamination(shapeResourceSeries(BY_RESOURCE));

    assert.equal(c?.stalledProbeScopes.length, 2);
    assert.equal(c?.allEndpointsDegradedTogether, true);
  });

  /**
   * The contrasting case: on 2026-09-09 only the business endpoint spiked (50s)
   * while the probes stayed at 0.04s. That is a genuine slow request, and must
   * not be reported as an infrastructure stall.
   */
  it("does not claim a shared stall when only the business endpoint spiked", () => {
    const sep9 = new Map<string, MetricPoint[]>([
      ["resource_name:get_/control/healthy", series([0.0005, 0.0005, 0.042])],
      ["resource_name:get_/control/ready", series([0.0005, 0.0005, 0.049])],
      ["resource_name:get_/external/preferences", series([0.09, 0.1, 50.528076])],
    ]);

    const c = analyzeProbeContamination(shapeResourceSeries(sep9));

    assert.equal(c?.probeScopes.length, 2);
    assert.equal(c?.allEndpointsDegradedTogether, false);
  });

  it("returns nothing when the query did not group", () => {
    const single = new Map([["*", series([0.1, 0.2])]]);
    assert.equal(analyzeProbeContamination(shapeResourceSeries(single)), undefined);
  });
});

describe("analyzePercentileStability", () => {
  /**
   * The service takes ~35-60 requests a minute, so a 20-second interval holds
   * roughly 15 samples. A p90 over 15 samples is the second slowest request.
   * Calling that a "90th percentile" implies a distribution it does not have.
   */
  it("flags a p90 computed over a thin interval as an extreme", () => {
    const s = analyzePercentileStability(
      parseMonitorQuery(
        "avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:x} > 1",
      ),
      15,
    );

    assert.equal(s?.percentile, 90);
    assert.equal(s?.samplesAbovePercentile, 2);
    assert.equal(s?.behavesAsExtreme, true);
  });

  it("does not flag a p90 with a real sample behind it", () => {
    const s = analyzePercentileStability(
      parseMonitorQuery(
        "avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:x} > 1",
      ),
      500,
    );

    assert.equal(s?.samplesAbovePercentile, 50);
    assert.equal(s?.behavesAsExtreme, false);
  });

  it("says nothing about a mean", () => {
    const s = analyzePercentileStability(
      parseMonitorQuery(
        "avg(last_10m):avg:trace.aspnet_core.request{env:prod,service:x} > 0.7",
      ),
      15,
    );

    assert.equal(s, undefined);
  });

  it("says nothing when the request volume is unknown", () => {
    const s = analyzePercentileStability(
      parseMonitorQuery(
        "avg(last_10m):p90:trace.aspnet_core.request{env:prod,service:x} > 1",
      ),
      undefined,
    );

    assert.equal(s, undefined);
  });
});
