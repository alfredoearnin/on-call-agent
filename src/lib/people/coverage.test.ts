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
  assessCoverage,
  deserializeCoverage,
  isUpcoming,
  serializeCoverage,
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
