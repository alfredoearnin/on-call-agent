/*
 * The coverage check decides whether the dashboard accuses a rotation of being
 * uncovered. These cases exist to stop it claiming more than the handoff page
 * actually said — above all, to stop "we never asked" from rendering as
 * "everyone is available", which is the failure this feature exists to prevent.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Coverage, CoverageRole } from "@/lib/constants";
import type { CoverageEntry, PageCoverage } from "@/lib/ingest/types";
import {
  CoverageSummaryKind,
  assessCoverage,
  deserializeCoverage,
  isUpcoming,
  serializeCoverage,
  summarizeCoverage,
} from "@/lib/people/coverage";

const NOW = new Date("2026-08-20T18:00:00.000Z");
const daysFromNow = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("assessCoverage", () => {
  it("warns when an absence overlaps today", () => {
    const { primary } = assessCoverage({
      coverage: coverageWith({
        primary: out(daysFromNow(-1), daysFromNow(2)),
      }),
      now: NOW,
    });

    assert.equal(primary.state, Coverage.OutOfOffice);
  });

  it("carries the return date so the banner can say when they are back", () => {
    const back = daysFromNow(2);
    const { primary } = assessCoverage({
      coverage: coverageWith({ primary: out(daysFromNow(-1), back) }),
      now: NOW,
    });

    assert.equal(primary.to?.toISOString(), back.toISOString());
  });

  it("warns about an absence starting later in the on-call week", () => {
    const { primary } = assessCoverage({
      coverage: coverageWith({ primary: out(daysFromNow(2), daysFromNow(4)) }),
      now: NOW,
    });

    assert.equal(primary.state, Coverage.OutOfOffice);
    assert.equal(isUpcoming(primary, NOW), true);
  });

  it("does not warn about an absence that has already ended", () => {
    const { primary } = assessCoverage({
      coverage: coverageWith({ primary: out(daysFromNow(-5), daysFromNow(-2)) }),
      now: NOW,
    });

    assert.equal(primary.state, Coverage.Available);
    assert.ok(primary.evidence.includes("ended"), primary.evidence);
  });

  it("reports available when the page said available", () => {
    const { secondary } = assessCoverage({
      coverage: coverageWith({
        secondary: { state: Coverage.Available, evidence: "* Secondary Ada Lovelace — available" },
      }),
      now: NOW,
    });

    assert.equal(secondary.state, Coverage.Available);
  });

  // The honesty case. A page with no coverage block must not imply availability.
  it("reports unknown for every role when the page carried no coverage check", () => {
    const all = assessCoverage({ coverage: undefined, now: NOW });

    for (const role of Object.values(CoverageRole)) {
      assert.equal(all[role].state, Coverage.Unknown, role);
      assert.ok(all[role].evidence.includes("no coverage check"), all[role].evidence);
    }
  });

  it("reports unknown with the reason when the check itself failed", () => {
    const all = assessCoverage({
      coverage: { unavailableReason: "Slack unreachable", roles: allUnknown() },
      now: NOW,
    });

    assert.equal(all[CoverageRole.Primary].state, Coverage.Unknown);
    assert.ok(
      all[CoverageRole.Primary].evidence.includes("Slack unreachable"),
      all[CoverageRole.Primary].evidence,
    );
  });

  it("reports unknown for a role the block did not mention", () => {
    const { nextSecondary } = assessCoverage({
      coverage: coverageWith({ primary: out(daysFromNow(-1), daysFromNow(1)) }),
      now: NOW,
    });

    assert.equal(nextSecondary.state, Coverage.Unknown);
  });

  it("quotes the page's own sentence in the evidence", () => {
    const line = "* Primary Ada Lovelace — out of office 2026-08-20 → 2026-08-22";
    const { primary } = assessCoverage({
      coverage: coverageWith({
        primary: { ...out(daysFromNow(-1), daysFromNow(1)), evidence: line },
      }),
      now: NOW,
    });

    assert.equal(primary.evidence, line);
  });
});

describe("isUpcoming", () => {
  it("is true for an absence that has not started", () => {
    assert.equal(isUpcoming({ from: daysFromNow(1) }, NOW), true);
  });

  it("is false for an absence already under way", () => {
    assert.equal(isUpcoming({ from: daysFromNow(-1) }, NOW), false);
  });

  it("is false when no start date was stated", () => {
    assert.equal(isUpcoming({}, NOW), false);
  });
});

describe("deserializeCoverage", () => {
  it("round-trips a serialized coverage check", () => {
    const original = coverageWith({
      primary: { ...out(daysFromNow(-1), daysFromNow(2)), evidence: "* Primary — out" },
    });
    original.checkedAt = "2026-08-20 8:00 AM PT";

    const back = deserializeCoverage(serializeCoverage(original));

    assert.equal(back?.checkedAt, "2026-08-20 8:00 AM PT");
    assert.equal(back?.roles[CoverageRole.Primary].state, Coverage.OutOfOffice);
    assert.equal(
      back?.roles[CoverageRole.Primary].to?.toISOString(),
      daysFromNow(2).toISOString(),
    );
  });

  it("returns undefined for a null column rather than throwing", () => {
    assert.equal(deserializeCoverage(null), undefined);
    assert.equal(deserializeCoverage(undefined), undefined);
    assert.equal(deserializeCoverage(""), undefined);
  });

  // A page render must survive a payload written by an older or buggier version.
  it("returns undefined on malformed json rather than throwing", () => {
    assert.equal(deserializeCoverage("{not json"), undefined);
  });

  it("reads an unrecognised state as unknown, never available", () => {
    const back = deserializeCoverage(
      '{"roles":{"primary":{"state":"on_a_boat"}}}',
    );

    assert.equal(back?.roles[CoverageRole.Primary].state, Coverage.Unknown);
  });

  it("drops an unparseable date rather than inventing one", () => {
    const back = deserializeCoverage(
      '{"roles":{"primary":{"state":"out_of_office","to":"not-a-date"}}}',
    );

    assert.equal(back?.roles[CoverageRole.Primary].to, undefined);
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

const avail = (evidence: string): CoverageEntry => ({
  state: Coverage.Available,
  evidence,
});

const out = (from: Date, to: Date): CoverageEntry => ({
  state: Coverage.OutOfOffice,
  from,
  to,
});

const allUnknown = (): Record<CoverageRole, CoverageEntry> => ({
  [CoverageRole.Primary]: { state: Coverage.Unknown },
  [CoverageRole.Secondary]: { state: Coverage.Unknown },
  [CoverageRole.NextPrimary]: { state: Coverage.Unknown },
  [CoverageRole.NextSecondary]: { state: Coverage.Unknown },
});

/** A coverage check where only the named roles are set; the rest stay unknown. */
function coverageWith(
  over: Partial<Record<CoverageRole, CoverageEntry>>,
): PageCoverage {
  return { roles: { ...allUnknown(), ...over } };
}

/*
 * The banner used to show nothing both when nobody was away and when nobody had
 * checked. These cases pin the four kinds apart, because "everyone is around" and
 * "we never asked" must never render the same way.
 */
describe("summarizeCoverage", () => {
  const summarize = (coverage?: PageCoverage) =>
    summarizeCoverage(coverage, assessCoverage({ coverage, now: NOW }));

  it("reports all available when the check found nobody away", () => {
    const s = summarize(
      coverageWith({
        primary: avail("* Primary Ada Lovelace — available"),
        secondary: avail("* Secondary Grace Hopper — available"),
        nextPrimary: avail("* Next primary Alan Turing — available"),
        nextSecondary: avail("* Next secondary Ada Lovelace — available"),
      }),
    );

    assert.equal(s.kind, CoverageSummaryKind.AllAvailable);
    assert.deepEqual(s.out, []);
    assert.deepEqual(s.unverified, []);
  });

  it("reports who is away when someone is", () => {
    const s = summarize(
      coverageWith({
        primary: out(daysFromNow(-1), daysFromNow(2)),
        secondary: avail("* Secondary Grace Hopper — available"),
        nextPrimary: avail("* Next primary Alan Turing — available"),
        nextSecondary: avail("* Next secondary Ada Lovelace — available"),
      }),
    );

    assert.equal(s.kind, CoverageSummaryKind.SomeOut);
    assert.deepEqual(s.out, [CoverageRole.Primary]);
  });

  it("still reports all available when only some roles could be resolved", () => {
    const s = summarize(
      coverageWith({ primary: avail("* Primary Ada Lovelace — available") }),
    );

    assert.equal(s.kind, CoverageSummaryKind.AllAvailable);
    assert.equal(s.unverified.length, 3, "the rest are named as unverified");
  });

  // The distinction the whole summary exists for.
  it("does not report all available when the page carried no check", () => {
    const s = summarize(undefined);

    assert.equal(s.kind, CoverageSummaryKind.NotChecked);
  });

  it("does not report all available when a check resolved nobody", () => {
    const s = summarize(coverageWith({}));

    assert.equal(s.kind, CoverageSummaryKind.NotChecked);
  });

  it("reports the failure and its reason when the check could not complete", () => {
    const s = summarize({
      unavailableReason: "Slack unreachable",
      roles: allUnknown(),
    });

    assert.equal(s.kind, CoverageSummaryKind.CheckFailed);
    assert.equal(s.reason, "Slack unreachable");
  });

  it("lists away roles in rotation order, not discovery order", () => {
    const s = summarize(
      coverageWith({
        nextSecondary: out(daysFromNow(1), daysFromNow(3)),
        primary: out(daysFromNow(-1), daysFromNow(1)),
      }),
    );

    assert.deepEqual(s.out, [CoverageRole.Primary, CoverageRole.NextSecondary]);
  });

  it("does not count a lapsed absence as someone being away", () => {
    const s = summarize(
      coverageWith({
        primary: out(daysFromNow(-6), daysFromNow(-3)),
        secondary: avail("* Secondary Grace Hopper — available"),
      }),
    );

    assert.equal(s.kind, CoverageSummaryKind.AllAvailable);
  });
});
