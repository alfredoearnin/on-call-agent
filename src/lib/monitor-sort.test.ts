import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MONITOR_SORT,
  MonitorSort,
  parseMonitorSort,
  sortMonitors,
  type SortableMonitor,
} from "./monitor-sort";

function monitor(
  name: string,
  over: Partial<SortableMonitor> = {},
): SortableMonitor {
  return {
    name,
    alertCount: 0,
    recommendationCount: 0,
    appliedCount: 0,
    appliedOutOfBandCount: 0,
    openCount: 0,
    applyableCount: 0,
    lastAnalysisAt: null,
    ...over,
  };
}

const names = (rows: SortableMonitor[]) => rows.map((r) => r.name);

describe("parseMonitorSort", () => {
  it("reads every offered option", () => {
    assert.equal(parseMonitorSort("to-apply"), MonitorSort.ToApply);
    assert.equal(parseMonitorSort("name"), MonitorSort.Name);
  });

  /** The param comes from the URL, so it is untrusted input. */
  it("falls back to the default for anything it does not know", () => {
    assert.equal(parseMonitorSort(undefined), DEFAULT_MONITOR_SORT);
    assert.equal(parseMonitorSort(""), DEFAULT_MONITOR_SORT);
    assert.equal(parseMonitorSort("../etc/passwd"), DEFAULT_MONITOR_SORT);
  });
});

describe("sortMonitors", () => {
  it("does not mutate the rows it is given", () => {
    const rows = [monitor("b"), monitor("a")];
    const sorted = sortMonitors(rows, MonitorSort.Name);

    assert.deepEqual(names(rows), ["b", "a"]);
    assert.deepEqual(names(sorted), ["a", "b"]);
  });

  describe("noisiest", () => {
    it("puts the most firings first", () => {
      const rows = sortMonitors(
        [
          monitor("quiet", { alertCount: 1 }),
          monitor("loud", { alertCount: 12 }),
          monitor("middling", { alertCount: 6 }),
        ],
        MonitorSort.Firings,
      );

      assert.deepEqual(names(rows), ["loud", "middling", "quiet"]);
    });

    /** Preserves the index's original intent: unexamined monitors surface. */
    it("surfaces the unexamined one at an equal firing count", () => {
      const rows = sortMonitors(
        [
          monitor("handled", { alertCount: 3, recommendationCount: 2 }),
          monitor("unexamined", { alertCount: 3 }),
        ],
        MonitorSort.Firings,
      );

      assert.deepEqual(names(rows), ["unexamined", "handled"]);
    });
  });

  describe("to apply", () => {
    /**
     * The queue view. A noisy monitor with nothing to act on must not outrank
     * a quiet one with a change ready, or the ordering answers the wrong
     * question.
     */
    it("ranks a ready change above a louder monitor with none", () => {
      const rows = sortMonitors(
        [
          monitor("loud-nothing-to-do", { alertCount: 40 }),
          monitor("quiet-ready", {
            alertCount: 1,
            recommendationCount: 1,
            openCount: 1,
            applyableCount: 1,
          }),
        ],
        MonitorSort.ToApply,
      );

      assert.deepEqual(names(rows), ["quiet-ready", "loud-nothing-to-do"]);
    });

    it("breaks a tie on open count, then on firings", () => {
      const rows = sortMonitors(
        [
          monitor("one-open", {
            alertCount: 2,
            openCount: 1,
            applyableCount: 1,
          }),
          monitor("three-open", {
            alertCount: 1,
            openCount: 3,
            applyableCount: 1,
          }),
          monitor("one-open-louder", {
            alertCount: 9,
            openCount: 1,
            applyableCount: 1,
          }),
        ],
        MonitorSort.ToApply,
      );

      assert.deepEqual(names(rows), [
        "three-open",
        "one-open-louder",
        "one-open",
      ]);
    });
  });

  describe("open", () => {
    /**
     * The stuck ones. 243692163 has one open recommendation whose patch no
     * longer fits the monitor — invisible under "to apply", which is exactly
     * why this ordering is offered separately.
     */
    it("surfaces advice with no usable patch", () => {
      const rows = sortMonitors(
        [
          monitor("ready", { openCount: 1, applyableCount: 1 }),
          monitor("stuck", { openCount: 2 }),
        ],
        MonitorSort.Open,
      );

      assert.deepEqual(names(rows), ["stuck", "ready"]);
    });
  });

  describe("applied", () => {
    it("counts changes observed in Datadog alongside recorded ones", () => {
      const rows = sortMonitors(
        [
          monitor("recorded", { recommendationCount: 1, appliedCount: 1 }),
          monitor("both", {
            recommendationCount: 3,
            appliedCount: 1,
            appliedOutOfBandCount: 1,
          }),
          monitor("none"),
        ],
        MonitorSort.Applied,
      );

      assert.deepEqual(names(rows), ["both", "recorded", "none"]);
    });
  });

  describe("analysed", () => {
    it("puts the most recent first", () => {
      const rows = sortMonitors(
        [
          monitor("older", { lastAnalysisAt: new Date("2026-09-01T00:00:00Z") }),
          monitor("newer", { lastAnalysisAt: new Date("2026-09-14T00:00:00Z") }),
        ],
        MonitorSort.Analysed,
      );

      assert.deepEqual(names(rows), ["newer", "older"]);
    });

    /**
     * 278 of 279 monitors have never been analysed. Treating a null date as
     * the oldest would bury the one that was under everything that was not.
     */
    it("sorts never-analysed monitors last, however noisy", () => {
      const rows = sortMonitors(
        [
          monitor("never-but-loud", { alertCount: 99 }),
          monitor("analysed", {
            alertCount: 1,
            lastAnalysisAt: new Date("2026-09-14T00:00:00Z"),
          }),
        ],
        MonitorSort.Analysed,
      );

      assert.deepEqual(names(rows), ["analysed", "never-but-loud"]);
    });

    it("orders the never-analysed among themselves by firings", () => {
      const rows = sortMonitors(
        [monitor("quiet"), monitor("loud", { alertCount: 5 })],
        MonitorSort.Analysed,
      );

      assert.deepEqual(names(rows), ["loud", "quiet"]);
    });
  });

  describe("every ordering", () => {
    /**
     * Equal rows must not come back in a different order per sort, or two
     * people comparing screens see a list that looks broken.
     */
    it("is deterministic among otherwise equal rows", () => {
      const equal = [monitor("charlie"), monitor("alpha"), monitor("bravo")];

      for (const { sort } of [
        { sort: MonitorSort.Firings },
        { sort: MonitorSort.ToApply },
        { sort: MonitorSort.Open },
        { sort: MonitorSort.Applied },
        { sort: MonitorSort.Analysed },
        { sort: MonitorSort.Name },
      ]) {
        assert.deepEqual(
          names(sortMonitors(equal, sort)),
          ["alpha", "bravo", "charlie"],
          sort,
        );
      }
    });
  });
});
