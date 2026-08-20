/*
 * The contract between the agent prompt and this repo's parsers.
 *
 * The prompt in `agents/` is the source of truth: it is the text pasted into the
 * Cursor Automations, so it is what actually runs. The parsers here key on specific
 * wordings in the pages that prompt produces — and nothing used to notice when one
 * of those wordings disappeared.
 *
 * It already happened once. The "Rotation line — fixed wording" instruction was
 * dropped from the live prompt between the Jul 28 and Aug 11 handoff pages, the
 * Overview's on-call names broke, and the fix (PR #30) made `parseOnCall` tolerant
 * of the new phrasings rather than restoring the instruction. That left the parser
 * absorbing slack the prompt no longer imposed, with no alarm if it drifted again.
 *
 * Each case below ties one parser to the template the prompt must keep, and proves
 * the parser actually reads a line built from that template. If someone edits the
 * prompt and drops a format the dashboard depends on, this fails instead of a
 * dashboard field silently going blank weeks later.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  parseCoverage,
  parseOnCall,
  parseRefreshedAt,
  parseWindow,
} from "@/lib/ingest/sources/confluence-parse";
import { splitFinding } from "@/lib/format";
import { CoverageRole } from "@/lib/constants";

const TZ = "America/Los_Angeles";

/** The canonical prompts — the copies pasted into Cursor. */
const HEALTH_CHECK = read("agents/Growth Team Ops Review Weekly Handof.md");
const DAILY_REFRESH = read("agents/OnCall dashboard.md");

describe("the canonical Health Check prompt", () => {
  it("pins the rotation line that parseOnCall reads", () => {
    assert.ok(
      HEALTH_CHECK.includes("primary: **<name>**; secondary:"),
      "the rotation-line template is gone — the Overview's on-call names will drift",
    );

    const schedule = parseOnCall(
      "_This on-call week — primary: **Ada Lovelace**; secondary: **Grace Hopper** " +
        "(shift Tue 2026-08-18 10:00 PT → Tue 2026-08-25 10:00 PT; verified live via " +
        "`schedule_show`). Next handoff 2026-08-25: primary **Alan Turing**, secondary " +
        "**Ada Lovelace**._",
    );
    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
  });

  it("pins the unverified fallback that sets the banner's warning", () => {
    assert.ok(
      HEALTH_CHECK.includes("Last verified (<date>)"),
      "the unverified fallback is gone — a stale rotation will read as confirmed",
    );

    const schedule = parseOnCall(
      "On-call: the handoff occurred Tue Aug 18 10:00 PT; the new rotation could not be " +
        "verified (incident.io connector down). Last verified (Aug 11): Primary " +
        "**Ada Lovelace**, Secondary **Grace Hopper**.",
    );
    assert.equal(schedule?.unverified, true);
    assert.equal(schedule?.verifiedAsOf, "Aug 11");
  });

  it("pins the Last refreshed stamp that dates the page", () => {
    assert.ok(
      /Last refreshed/i.test(HEALTH_CHECK),
      "the refresh stamp is gone — the health check's own status becomes unobservable",
    );

    const refresh = parseRefreshedAt(
      "Last refreshed **2026-08-20 8:00 AM PT (America/Los_Angeles)**.",
      TZ,
    );
    assert.equal(refresh?.text, "2026-08-20 8:00 AM PT (America/Los_Angeles)");
  });

  it("pins the coverage check that drives the out-of-office warnings", () => {
    assert.ok(
      HEALTH_CHECK.includes("_Coverage check (Slack out-of-office"),
      "the coverage block is gone — availability silently becomes unknown for everyone",
    );

    const coverage = parseCoverage(
      "_Coverage check (Slack out-of-office, as of 2026-08-20 8:00 AM PT):_\n" +
        "* Primary **Ada Lovelace** — out of office **2026-08-20 → 2026-08-22**\n" +
        "* Secondary **Grace Hopper** — available\n",
      TZ,
    );
    assert.equal(coverage?.roles[CoverageRole.Primary].state, "out_of_office");
    assert.equal(coverage?.roles[CoverageRole.Secondary].state, "available");
  });

  it("pins the on-call week window that scopes every page", () => {
    assert.ok(
      /On-call week/i.test(HEALTH_CHECK),
      "the window wording is gone — pages can no longer be filed to a week",
    );

    const window = parseWindow(
      "On-call week **2026-08-18 → 2026-08-25** (Tuesday → Tuesday).",
      TZ,
    );
    assert.equal(window?.start.toISOString().slice(0, 10), "2026-08-18");
  });

  it("pins the TL;DR / What happened labels the detail panel splits on", () => {
    assert.ok(
      HEALTH_CHECK.includes("TL;DR:") && HEALTH_CHECK.includes("What happened:"),
      "the finding labels are gone — every alert collapses to one unsplit blob",
    );

    const { tldr, detail } = splitFinding(
      "TL;DR: the monitor paged twice. What happened: _Observed_ — it fired at 09:17 UTC.",
    );
    assert.equal(tldr, "the monitor paged twice.");
    assert.ok(detail?.includes("Observed"), detail ?? "no detail");
  });

  // Known gap, deliberately not asserted: `parseKpis` requires the literal phrase
  // "paging alerts: N total (X High, Y Low)", which appears in NEITHER prompt copy —
  // the template says "Alert volume this week (week-to-date): 4 total (2 High, 2 Low)".
  // So the KPI parse always fails, persistBundle falls back to numbers derived from
  // the alert set, and the run is still marked success. Fixing it means changing one
  // side to match the other, which changes displayed numbers — out of scope here.
  it.todo("pins the alert-volume summary that parseKpis reads");
});

describe("the canonical daily-refresh prompt", () => {
  it("pins the commit subject that automation health looks for", () => {
    // health.ts finds `Daily refresh <date>` on origin/main to decide whether the
    // refresh landed. If the prompt renames the commit, health silently reads overdue.
    assert.ok(
      DAILY_REFRESH.includes("Daily refresh"),
      "the commit subject changed — automation health can no longer see the refresh",
    );
  });

  it("keeps the merge synchronous, so a run cannot end with an unmerged PR", () => {
    assert.ok(
      /--squash/.test(DAILY_REFRESH),
      "the squash merge is gone — refreshes may pile up unmerged (see PRs #16-#28)",
    );
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

function read(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}
