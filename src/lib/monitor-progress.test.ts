import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monitorProgressBadges } from "./monitor-progress";

const NONE = {
  recommendationCount: 0,
  appliedCount: 0,
  appliedOutOfBandCount: 0,
  openCount: 0,
  applyableCount: 0,
};

describe("monitorProgressBadges", () => {
  it("shows nothing for a monitor with no recommendations", () => {
    assert.deepEqual(monitorProgressBadges(NONE), []);
  });

  /** 243692163: three applied through the dashboard, one left with no usable patch. */
  it("shows progress and what is left, for a partly tuned monitor", () => {
    const badges = monitorProgressBadges({
      ...NONE,
      recommendationCount: 4,
      appliedCount: 3,
      openCount: 1,
      applyableCount: 0,
    });

    assert.deepEqual(
      badges.map((b) => [b.label, b.tone]),
      [
        ["3 of 4 applied", "ok"],
        ["1 open", "warn"],
      ],
    );
    assert.match(badges[1].title, /re-run the analysis/);
  });

  it("drops the fraction once every recommendation is applied", () => {
    const [badge] = monitorProgressBadges({
      ...NONE,
      recommendationCount: 2,
      appliedCount: 2,
    });

    assert.equal(badge.label, "2 applied");
    assert.equal(badge.tone, "ok");
  });

  /**
   * 135119948. The recommendation was addressed by an edit made straight in
   * Datadog, so the change is real but this dashboard did not make it. Green
   * would claim more than is known.
   */
  it("does not use the applied colour for a change it only observed", () => {
    const [badge] = monitorProgressBadges({
      ...NONE,
      recommendationCount: 1,
      appliedOutOfBandCount: 1,
    });

    assert.equal(badge.label, "1 applied");
    assert.equal(badge.tone, "neutral");
    assert.match(badge.title, /edited directly in Datadog/);
  });

  /** The only call to action on the page, and the only primary-toned badge. */
  it("calls out a change that can be applied now", () => {
    const badges = monitorProgressBadges({
      ...NONE,
      recommendationCount: 2,
      openCount: 2,
      applyableCount: 1,
    });

    assert.deepEqual(
      badges.map((b) => [b.label, b.tone]),
      [["1 to apply", "primary"]],
    );
  });

  it("never shows more than two badges", () => {
    const badges = monitorProgressBadges({
      recommendationCount: 9,
      appliedCount: 3,
      appliedOutOfBandCount: 2,
      openCount: 4,
      applyableCount: 2,
    });

    assert.equal(badges.length, 2);
    assert.deepEqual(
      badges.map((b) => b.label),
      ["5 of 9 applied", "2 to apply"],
    );
  });

  it("keeps the singular readable in the hover text", () => {
    const [badge] = monitorProgressBadges({
      ...NONE,
      recommendationCount: 1,
      appliedCount: 1,
    });

    assert.match(badge.title, /1 change applied/);
  });
});
