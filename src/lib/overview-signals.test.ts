import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SignalKey,
  SignalSeverity,
  collectSignals,
  panelSeverity,
  type OverviewCounts,
} from "@/lib/overview-signals";

const CLEAR: OverviewCounts = {
  activeFiring: 0,
  staleFiring: 0,
  incidents: 0,
  openRecommendations: 0,
  servicesToDrop: 0,
  boundaryDisputes: 0,
};

const counts = (over: Partial<OverviewCounts> = {}): OverviewCounts => ({
  ...CLEAR,
  ...over,
});

const keys = (c: OverviewCounts) => collectSignals(c).map((s) => s.key);

describe("collectSignals", () => {
  it("reports nothing owed when every count is clear", () => {
    assert.deepEqual(collectSignals(CLEAR), []);
  });

  it("leaves out a count of zero", () => {
    assert.deepEqual(keys(counts({ staleFiring: 4 })), [SignalKey.StaleFiring]);
  });

  // A negative count means the data upstream is wrong. Surfacing "-1 incidents"
  // as something owed would be worse than saying nothing about it.
  it("leaves out a negative count", () => {
    assert.deepEqual(collectSignals(counts({ incidents: -1 })), []);
  });

  it("ranks every alert above work that is merely owed", () => {
    const ranked = collectSignals(
      counts({ staleFiring: 9, openRecommendations: 2, incidents: 1 }),
    );

    assert.deepEqual(ranked.map((s) => s.severity), [
      SignalSeverity.Alert,
      SignalSeverity.Warn,
      SignalSeverity.Warn,
    ]);
    assert.equal(ranked[0].key, SignalKey.Incidents);
  });

  it("ranks an incident above an alert that is still firing", () => {
    assert.deepEqual(keys(counts({ activeFiring: 3, incidents: 1 })), [
      SignalKey.Incidents,
      SignalKey.ActiveFiring,
    ]);
  });

  // The order is a property of RULES, not of the order the page happens to pass
  // its counts — that is the whole reason ranking does not live in the page.
  it("ranks independently of the order the counts are written", () => {
    const everything = counts({
      boundaryDisputes: 1,
      openRecommendations: 2,
      staleFiring: 3,
      servicesToDrop: 4,
      activeFiring: 5,
      incidents: 6,
    });

    assert.deepEqual(keys(everything), [
      SignalKey.Incidents,
      SignalKey.ActiveFiring,
      SignalKey.ServicesToDrop,
      SignalKey.StaleFiring,
      SignalKey.OpenRecommendations,
      SignalKey.BoundaryDisputes,
    ]);
  });

  it("leads each headline with its count", () => {
    const [stale] = collectSignals(counts({ staleFiring: 4 }));

    assert.equal(stale.headline, "4 stale alerts");
    assert.equal(stale.detail, "orphaned incident.io alerts from prior weeks");
  });

  // Not every plural is a trailing `s`: this rendered as "21 ownership boundarys"
  // on the Overview. Each rule states its own plural, so each needs checking.
  it("pluralises every headline correctly", () => {
    const all = collectSignals({
      activeFiring: 2,
      staleFiring: 2,
      incidents: 2,
      openRecommendations: 2,
      servicesToDrop: 2,
      boundaryDisputes: 2,
    });

    assert.deepEqual(
      all.map((s) => s.headline),
      [
        "2 incidents",
        "2 alerts firing now",
        "2 services should leave the rotation",
        "2 stale alerts",
        "2 open recommendations",
        "2 ownership boundaries unresolved",
      ],
    );
  });

  it("says one alert in the singular", () => {
    const [one] = collectSignals(counts({ activeFiring: 1 }));
    const [many] = collectSignals(counts({ activeFiring: 2 }));

    assert.equal(one.headline, "1 alert firing now");
    assert.equal(many.headline, "2 alerts firing now");
  });

  it("points each signal at the page that resolves it", () => {
    const [recs] = collectSignals(counts({ openRecommendations: 1 }));

    assert.equal(recs.href, "/recommendations");
  });
});

describe("panelSeverity", () => {
  it("carries alert tone when any signal is an alert", () => {
    const signals = collectSignals(counts({ staleFiring: 4, incidents: 1 }));

    assert.equal(panelSeverity(signals), SignalSeverity.Alert);
  });

  it("carries warn tone when nothing is worse than owed work", () => {
    const signals = collectSignals(counts({ staleFiring: 4 }));

    assert.equal(panelSeverity(signals), SignalSeverity.Warn);
  });

  it("carries no tone when nothing is owed", () => {
    assert.equal(panelSeverity([]), undefined);
  });
});
