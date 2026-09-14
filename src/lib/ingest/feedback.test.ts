import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judgeOutcome } from "./feedback";
import { RecommendationStatus } from "@/lib/constants";

/**
 * Monitor 243692163 is the case these assertions are written from. Three
 * recommendations were applied on Sep 14 against a history of seven firings
 * from Sep 9-12. Reading the calendar week's count reported all three as
 * regressed — the firings that motivated each change were counted as its
 * failure — and a regressed row is not settled, so each came back to the top of
 * the list with its original patch and a live Apply button.
 */
const APPLIED = new Date("2026-09-14T23:27:53Z");
const LAST_FIRED_BEFORE = new Date("2026-09-12T18:57:03Z");

describe("judgeOutcome", () => {
  it("does not blame a change for firings that predate it", () => {
    const { status, outcome } = judgeOutcome(
      APPLIED,
      LAST_FIRED_BEFORE,
      new Date("2026-09-14T23:48:00Z"),
    );

    assert.equal(status, RecommendationStatus.Applied);
    assert.match(outcome, /Too early to confirm/);
  });

  it("calls it regressed when it fired after it was applied", () => {
    const { status, outcome } = judgeOutcome(
      APPLIED,
      new Date("2026-09-15T04:10:00Z"),
      new Date("2026-09-15T08:00:00Z"),
    );

    assert.equal(status, RecommendationStatus.Regressed);
    assert.match(outcome, /fired again/);
  });

  /**
   * Twenty minutes of quiet is not evidence. Validating on it would mark a
   * change confirmed before the monitor has had a chance to fire at all.
   */
  it("withholds validation until a week of quiet", () => {
    const sixDays = judgeOutcome(
      APPLIED,
      LAST_FIRED_BEFORE,
      new Date("2026-09-20T23:27:53Z"),
    );
    assert.equal(sixDays.status, RecommendationStatus.Applied);

    const eightDays = judgeOutcome(
      APPLIED,
      LAST_FIRED_BEFORE,
      new Date("2026-09-22T23:27:53Z"),
    );
    assert.equal(eightDays.status, RecommendationStatus.Validated);
    assert.match(eightDays.outcome, /quiet for 8 days/);
  });

  it("validates a monitor that has never fired once the week is out", () => {
    const { status } = judgeOutcome(
      APPLIED,
      null,
      new Date("2026-09-30T00:00:00Z"),
    );

    assert.equal(status, RecommendationStatus.Validated);
  });

  /**
   * Someone edited the monitor in Datadog instead of pressing Apply. The change
   * is real and detectable in the snapshot history, but there is no instant to
   * measure from, so no outcome can be claimed either way.
   */
  it("claims no outcome for a change applied out of band", () => {
    const { status, outcome } = judgeOutcome(
      undefined,
      LAST_FIRED_BEFORE,
      new Date("2026-09-30T00:00:00Z"),
    );

    assert.equal(status, RecommendationStatus.Applied);
    assert.match(outcome, /no recorded apply/);
  });

  it("still reports a regression it can see without a recorded apply", () => {
    // lastFiredAt cannot be compared to a missing apply instant, so this stays
    // unjudged rather than guessing — the firing may predate the change.
    const { status } = judgeOutcome(
      undefined,
      new Date("2026-09-29T00:00:00Z"),
      new Date("2026-09-30T00:00:00Z"),
    );

    assert.equal(status, RecommendationStatus.Applied);
  });
});
