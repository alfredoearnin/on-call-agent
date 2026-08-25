import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveWindow } from "./window";

/**
 * The on-call week turns over when the rotation does — Tuesdays at 11:00 Mexico
 * City, which is 17:00 UTC in every season because that zone has no DST.
 *
 * These cases run against the shipped defaults, so they also pin the config: if
 * someone moves the boundary back to midnight, the instants below stop matching.
 */
const HANDOFF_UTC = "T17:00:00.000Z";

/** Aug 25 2026 and Jan 19 2027 are both Tuesdays. */
describe("resolveWindow", () => {
  it("opens the week at the handoff once it has passed", () => {
    // Tuesday 12:00 Mexico City, an hour after the rotation changed hands.
    const w = resolveWindow(new Date("2026-08-25T18:00:00Z"));

    assert.equal(w.start.toISOString(), `2026-08-25${HANDOFF_UTC}`);
    assert.equal(w.end.toISOString(), `2026-09-01${HANDOFF_UTC}`);
  });

  /**
   * The case the midnight model got wrong. Between midnight and 11:00 on handoff
   * day the outgoing primary is still carrying the pager, so anything that fires
   * belongs to the week that has not closed yet.
   */
  it("still reports the previous week before the handoff on handoff day", () => {
    // Tuesday 09:00 Mexico City, two hours before the rotation changes.
    const w = resolveWindow(new Date("2026-08-25T15:00:00Z"));

    assert.equal(w.start.toISOString(), `2026-08-18${HANDOFF_UTC}`);
    assert.equal(w.end.toISOString(), `2026-08-25${HANDOFF_UTC}`);
  });

  it("reports the preceding handoff on a mid-week day", () => {
    const w = resolveWindow(new Date("2026-08-26T14:00:00Z")); // Wednesday

    assert.equal(w.start.toISOString(), `2026-08-25${HANDOFF_UTC}`);
  });

  it("reports the preceding handoff on the day before the next one", () => {
    const w = resolveWindow(new Date("2026-08-31T16:00:00Z")); // Monday

    assert.equal(w.start.toISOString(), `2026-08-25${HANDOFF_UTC}`);
  });

  it("holds the boundary at the same instant through a northern DST change", () => {
    const w = resolveWindow(new Date("2027-01-19T18:00:00Z")); // Tuesday, PST

    assert.equal(w.start.toISOString(), `2027-01-19${HANDOFF_UTC}`);
    assert.equal(w.end.toISOString(), `2027-01-26${HANDOFF_UTC}`);
  });

  /**
   * Stepping a week in a DST zone keeps the local clock and moves the instant, so
   * a window spanning the PT transition would come out 167 or 169 hours long.
   */
  it("spans exactly seven days across the PT transition", () => {
    // Nov 3 2026 is the Tuesday before PT falls back on Nov 8.
    const w = resolveWindow(new Date("2026-11-03T18:00:00Z"));
    const hours = (w.end.getTime() - w.start.getTime()) / 3_600_000;

    assert.equal(hours, 168);
  });

  it("hands the prior week the closing boundary as its end", () => {
    const w = resolveWindow(new Date("2026-08-26T14:00:00Z"));

    assert.equal(w.priorEnd.toISOString(), w.start.toISOString());
    assert.equal(w.priorStart.toISOString(), `2026-08-18${HANDOFF_UTC}`);
  });
});
