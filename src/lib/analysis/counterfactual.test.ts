import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MetricPoint } from "@/lib/clients/datadog";
import {
  evaluateCounterfactual,
  replayRule,
  syntheticSustainedBreach,
  type ProposedRule,
} from "./counterfactual";

/**
 * The replay that decides whether the recommendation for monitor 243692163 is
 * worth approving.
 *
 * CURRENT is the shipped rule. PROPOSED is the change: keep the threshold, make
 * the window require a sustained breach. The claim to prove is that the second
 * suppresses the pages the first produced while still firing on a real
 * degradation.
 */
const CURRENT: ProposedRule = {
  windowFn: "avg",
  windowSeconds: 600,
  comparator: ">",
  threshold: 1,
};

const PROPOSED: ProposedRule = {
  windowFn: "min",
  windowSeconds: 900,
  comparator: ">",
  threshold: 1,
  requireFullWindow: true,
};

const INTERVAL_SECONDS = 20;
const BASELINE = 0.11;

/**
 * p90 values every 20s on 2026-09-12, straddling 18:47 UTC.
 *
 * The spike values are the ones Datadog actually recorded: a single interval at
 * 99.95s, then a ragged tail of 20.2, 5.7, 8.2, 3.6, 1.1, 5.2, 19.9, 1.8, 4.5
 * before the service returned to its ~0.11s baseline. Padded with baseline on
 * both sides so a 15-minute window has data to cover.
 */
function sep12Series(): MetricPoint[] {
  const spike = [
    99.954327, 0.08632, 20.242455, 0.322441, 5.67709, 8.236202, 3.621243,
    1.13202, 5.172798, 19.931033, 1.830581, 4.499094,
  ];
  const values = [
    ...Array<number>(60).fill(BASELINE),
    ...spike,
    ...Array<number>(60).fill(BASELINE),
  ];
  const startMs = Date.UTC(2026, 8, 12, 18, 27, 0);
  return values.map((value, i) => ({
    at: startMs + i * INTERVAL_SECONDS * 1000,
    value,
  }));
}

describe("replayRule", () => {
  /**
   * Why the monitor fired at all. Averaged over 30 intervals, one 99.95s sample
   * contributes 3.33s on its own, so the window statistic clears 1.0s without
   * any help from the rest of the spike.
   */
  it("confirms the shipped rule fires on the 2026-09-12 spike", () => {
    const r = replayRule(sep12Series(), CURRENT);

    assert.equal(r.fired, true);
    assert.ok(r.peakStatistic != null && r.peakStatistic > 3.3);
    assert.ok(r.firstBreachAtIso?.startsWith("2026-09-12T18:4"));
  });

  /**
   * The remedy. `min` requires every sample in the window to breach, and the
   * spike is bracketed by baseline samples, so the window minimum never leaves
   * 0.11s.
   */
  it("shows the proposed rule does not fire on the same spike", () => {
    const r = replayRule(sep12Series(), PROPOSED);

    assert.equal(r.fired, false);
    assert.ok(r.evaluations > 0, "the replay must actually evaluate windows");
    assert.ok(r.peakStatistic != null && r.peakStatistic <= BASELINE + 1e-9);
  });

  /**
   * The coverage half of the argument: a genuine 20-minute degradation still
   * pages under the proposed rule.
   */
  it("still fires on a sustained breach", () => {
    const r = replayRule(
      syntheticSustainedBreach(1.5, 20, INTERVAL_SECONDS),
      PROPOSED,
    );

    assert.equal(r.fired, true);
  });

  /**
   * A breach shorter than the window must not fire a min() rule — that is the
   * whole point of the change, and the boundary worth pinning.
   */
  it("does not fire on a breach shorter than the window", () => {
    const r = replayRule(
      syntheticSustainedBreach(1.5, 10, INTERVAL_SECONDS),
      PROPOSED,
    );

    assert.equal(r.fired, false);
  });

  it("evaluates nothing rather than guessing when the series is empty", () => {
    const r = replayRule([], PROPOSED);

    assert.equal(r.fired, false);
    assert.equal(r.evaluations, 0);
  });

  /**
   * requireFullWindow must suppress evaluation, not fabricate it. A series
   * shorter than the window proves nothing either way, and a replay that
   * silently evaluated a partial window would report a suppression it had not
   * demonstrated.
   */
  it("evaluates nothing when the series is shorter than a full window", () => {
    const short = syntheticSustainedBreach(99, 5, INTERVAL_SECONDS);
    const r = replayRule(short, PROPOSED);

    assert.equal(r.evaluations, 0);
    assert.equal(r.fired, false);
  });
});

describe("evaluateCounterfactual", () => {
  it("counts suppressed firings and reports the claim", () => {
    const report = evaluateCounterfactual(
      [
        { label: "2026-09-12T18:47Z", points: sep12Series() },
        { label: "2026-09-10T23:41Z", points: sep12Series() },
      ],
      CURRENT,
      PROPOSED,
    );

    assert.equal(report.currentFiredCount, 2);
    assert.equal(report.suppressedCount, 2);
    assert.equal(report.stillFiringCount, 0);
    assert.match(report.summary, /Suppresses 2 of 2/);
  });

  it("reports an episode that would still fire rather than hiding it", () => {
    const report = evaluateCounterfactual(
      [
        { label: "spike", points: sep12Series() },
        {
          label: "sustained",
          points: syntheticSustainedBreach(1.5, 25, INTERVAL_SECONDS),
        },
      ],
      CURRENT,
      PROPOSED,
    );

    assert.equal(report.currentFiredCount, 2);
    assert.equal(report.suppressedCount, 1);
    assert.equal(report.stillFiringCount, 1);
    assert.match(report.summary, /1 would still fire/);
  });

  /**
   * The honesty case. If the current rule never fired in the replayed windows,
   * the proposed rule not firing proves nothing — and the summary must say so
   * instead of claiming a clean suppression.
   */
  it("calls a replay inconclusive when the current rule never fired", () => {
    const quiet = [
      {
        label: "quiet",
        points: syntheticSustainedBreach(BASELINE, 30, INTERVAL_SECONDS),
      },
    ];

    const report = evaluateCounterfactual(quiet, CURRENT, PROPOSED);

    assert.equal(report.currentFiredCount, 0);
    assert.equal(report.suppressedCount, 0);
    assert.equal(report.inconclusiveCount, 1);
    assert.match(report.summary, /Inconclusive/);
  });
});
