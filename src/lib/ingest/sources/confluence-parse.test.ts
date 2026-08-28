import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Coverage, CoverageRole, PageState } from "@/lib/constants";
import {
  parseCoverage,
  parseEventTime,
  parseOnCall,
  parsePageState,
  parseRefreshedAt,
  parseWindow,
  serviceFromTitle,
} from "@/lib/ingest/sources/confluence-parse";

const TZ = "America/Los_Angeles";
const asDate = (d?: Date) => d?.toISOString().slice(0, 10);

describe("parsePageState", () => {
  // Verbatim first lines from the archive, because that is the only text the
  // banner check is allowed to depend on.
  const LIVE =
    "🔄 **Live page** — refreshed daily during the on-call week " +
    "(2026-08-18 → 2026-08-25). Last refreshed **2026-08-23 8:05 AM PT " +
    "(America/Los_Angeles)**. This page freezes at the Tuesday handoff " +
    "(2026-08-25); a new page opens for the next week.\n\n" +
    "# Growth Team Ops Review — Weekly Handoff\n";
  const FROZEN =
    "🔒 **Frozen — final state at week close (2026-08-18).** This on-call week " +
    "has ended; see the next week's page (2026-08-18 → 2026-08-25). " +
    "Final refresh completed **2026-08-18 12:35 PM PT (America/Los_Angeles)**.\n\n" +
    "# Growth Team Ops Review — Weekly Handoff\n";

  it("reads a live page's banner", () => {
    assert.equal(parsePageState(LIVE), PageState.Live);
  });

  it("reads a frozen page's banner", () => {
    assert.equal(parsePageState(FROZEN), PageState.Frozen);
  });

  // The live banner PROMISES it "freezes at the Tuesday handoff". Matching that
  // as frozen would report every open week as closed — silencing the exact check
  // this parser exists to feed.
  it("does not read a live page's promise to freeze as already frozen", () => {
    assert.ok(/freezes/.test(LIVE), "fixture must contain the freeze promise");
    assert.equal(parsePageState(LIVE), PageState.Live);
  });

  // Conversely, the frozen banner points at "the next week's page", and the body
  // of any page describes numbers as "live". Neither is a state declaration.
  it("does not read body prose as a banner", () => {
    const noBanner =
      "# Growth Team Ops Review — Weekly Handoff\n\n" +
      "Totals are week-to-date (live, refreshed daily until it freezes at the " +
      "Sep 1 handoff). The Frozen archive holds prior weeks.\n";

    assert.equal(parsePageState(noBanner), undefined);
  });

  it("reads a definite state from every archived page that carries a banner", () => {
    const dir = join(process.cwd(), "data", "confluence");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") && !/ledger/i.test(f),
    );
    assert.ok(files.length > 0, "no handoff pages found to check");

    for (const file of files) {
      const md = readFileSync(join(dir, file), "utf8");
      const state = parsePageState(md);
      // Pages published before the banner existed carry none; that is "unknown",
      // never "live". Any page that does carry one must resolve to exactly one state.
      if (/^(?:🔄|🔒)/.test(md)) {
        assert.ok(
          state === PageState.Live || state === PageState.Frozen,
          `${file}: banner present but state parsed as ${state}`,
        );
      }
    }
  });

  // The page for the running week is the one the dashboard reads live, so it must
  // never parse as frozen — that would make an open week look closed and correct.
  it("reads the current week's page as live", () => {
    const md = readFileSync(
      join(process.cwd(), "data", "confluence", "handoff.md"),
      "utf8",
    );

    assert.equal(parsePageState(md), PageState.Live);
  });
});

describe("parseWindow", () => {
  it("reads the header window, not the next week's page cited in the banner", () => {
    const window = parseWindow(
      "🔒 **Frozen — final state at week close (2026-08-18).** This on-call week has " +
        "ended; see the next week's page (2026-08-18 → 2026-08-25).\n\n" +
        "**08/18/2026 Growth Team Ops Review** · On-call week " +
        "**2026-08-11 → 2026-08-18** (Tuesday → Tuesday).",
      TZ,
    );

    assert.equal(asDate(window?.start), "2026-08-11");
    assert.equal(asDate(window?.end), "2026-08-18");
  });

  /**
   * The rotation changes hands Tuesdays at 11:00 Mexico City, so pages state
   * that boundary explicitly. Reading it is what keeps a Tuesday-morning page
   * attributed to the primary who was actually holding the pager.
   */
  it("honours the handoff boundary a page states", () => {
    const window = parseWindow(
      "**08/25/2026 Growth Team Ops Review** · On-call week " +
        "**2026-08-25 11:00 → 2026-09-01 11:00** (America/Mexico_City).",
      TZ,
    );

    assert.equal(window?.start.toISOString(), "2026-08-25T17:00:00.000Z");
    assert.equal(window?.end.toISOString(), "2026-09-01T17:00:00.000Z");
  });

  /**
   * Mexico City dropped DST in 2022, so the boundary is the same instant in
   * January as in August. A page cut in the team zone would drift an hour here.
   */
  it("keeps the boundary fixed across a northern DST change", () => {
    const window = parseWindow(
      "On-call week **2027-01-19 11:00 → 2027-01-26 11:00** (America/Mexico_City).",
      TZ,
    );

    assert.equal(window?.start.toISOString(), "2027-01-19T17:00:00.000Z");
  });

  /**
   * The archive predates the boundary being modelled: those pages state only
   * dates and their counts were queried midnight-to-midnight. Reading a handoff
   * time into them would claim a window their contents never covered.
   */
  it("leaves a page that states no time at midnight in the team zone", () => {
    const window = parseWindow(
      "On-call week **2026-08-18 → 2026-08-25** (Tuesday → Tuesday, America/Los_Angeles).",
      TZ,
    );

    assert.equal(window?.start.toISOString(), "2026-08-18T07:00:00.000Z");
  });

  /**
   * The line loop skips lines citing the next week, so a frozen banner pushes the
   * match down to the whole-document fallback — where a `\s` class would have let
   * the end date pair with a time on the following line and move the boundary by
   * hours. Every class in the pattern is newline-free for that reason.
   */
  it("never binds a boundary time from the following line", () => {
    const window = parseWindow(
      "🔒 Frozen. This on-call week has ended; see the next week 2026-08-18 → 2026-08-25\n" +
        "11:00 AM PT is when the team syncs.",
      TZ,
    );

    assert.equal(window?.end.toISOString(), "2026-08-25T07:00:00.000Z");
  });

  /**
   * Zone names are page-supplied, and luxon caches zones by the raw string in maps
   * it never evicts — so accepting casing variants would mint a permanent ICU
   * formatter per variant. Resolving to the canonical spelling collapses them.
   */
  it("resolves a stated zone irrespective of its casing", () => {
    const window = parseWindow(
      "On-call week **2026-08-25 11:00 → 2026-09-01 11:00** (aMeRiCa/mExIcO_cItY).",
      TZ,
    );

    assert.equal(window?.start.toISOString(), "2026-08-25T17:00:00.000Z");
  });

  it("falls back to the team zone when a stated zone is not a real one", () => {
    const window = parseWindow(
      "On-call week **2026-08-25 11:00 → 2026-09-01 11:00** (Mars/Olympus_Mons).",
      TZ,
    );

    assert.equal(window?.start.toISOString(), "2026-08-25T18:00:00.000Z");
  });
});

/**
 * The rotation line is free prose written by an agent, so its wording drifts
 * between runs. These cases pin the forms that have actually been published —
 * a silent parse failure blanks the on-call names on the Overview.
 */
describe("parseOnCall", () => {
  it("reads the canonical `primary: X; secondary: Y` form", () => {
    const schedule = parseOnCall(
      "_This on-call week — primary: **Ada Lovelace**; secondary: **Grace Hopper** " +
        "(shift Tue 2026-07-28 10:00 PT; verified live via_ `schedule_show`_)._",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
    assert.equal(schedule?.unverified, false);
  });

  it("reads the hedged `Primary X, Secondary Y` form used when incident.io is down", () => {
    const schedule = parseOnCall(
      "On-call: the handoff occurred Tue Aug 11 10:00 PT; the new primary/secondary " +
        "could not be verified (incident.io connector down, ~12 days). " +
        "Last verified (Aug 4): Primary **Ada Lovelace**, Secondary **Grace Hopper**.",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
    assert.equal(schedule?.unverified, true);
    assert.equal(schedule?.verifiedAsOf, "Aug 4");
  });

  it("keeps dotted usernames intact", () => {
    const schedule = parseOnCall(
      "primary: **ada.lovelace**; secondary: **grace.hopper** (shift Tue 2026-07-28).",
    );

    assert.equal(schedule?.primary, "ada.lovelace");
    assert.equal(schedule?.secondary, "grace.hopper");
  });

  it("separates the closing week from the incoming one in a single paragraph", () => {
    const schedule = parseOnCall(
      "On-call (closing week): Primary **Ada Lovelace** — confirmed from incident.io " +
        "escalation acks this week (every spot-checked page was acked by Ada). " +
        "The handoff occurred Tue Aug 18 10:00 PT; the new week's primary is " +
        "**Grace Hopper**, secondary **Alan Turing** (next primary Alan, Aug 25).",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.nextPrimary, "Grace Hopper");
    assert.equal(schedule?.nextSecondary, "Alan Turing");
    assert.equal(schedule?.unverified, false);
  });

  it("gives each role its own name when only a space separates them", () => {
    const schedule = parseOnCall(
      "On-call: primary **Ada Lovelace** secondary **Grace Hopper**.",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
  });

  it("keeps an abbreviation from splitting names away from the next cue", () => {
    const schedule = parseOnCall(
      "On-call: Next handoff is Tue Aug 25 at 10:00 a.m. PT: " +
        "primary **Alan Turing**, secondary **Ada Lovelace**.",
    );

    assert.equal(schedule?.primary, undefined, "next week's primary shown as current");
    assert.equal(schedule?.nextPrimary, "Alan Turing");
    assert.equal(schedule?.nextSecondary, "Ada Lovelace");
  });

  it("ignores prose crediting a role outside the rotation paragraph", () => {
    const schedule = parseOnCall(
      "Escalation acked by **Grace Hopper** primary within 30s.\n\n" +
        "On-call: primary: **Ada Lovelace**; secondary: **Alan Turing**.",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Alan Turing");
  });

  it("does not mistake prose that merely mentions a role for a name", () => {
    const schedule = parseOnCall(
      "Every page was **human-acknowledged by Ada (primary on-call)** within ~20-55s.",
    );

    assert.equal(schedule, undefined);
  });

  it("reads the next handoff with the role before the name", () => {
    const schedule = parseOnCall(
      "Next handoff Tue 2026-07-14 10:00 PT → primary **Ada Lovelace**, " +
        "secondary **grace.hopper**. Verified via incident.io this run.",
    );

    assert.equal(schedule?.nextPrimary, "Ada Lovelace");
    assert.equal(schedule?.nextSecondary, "grace.hopper");
  });

  it("reads the next handoff with the name before the role", () => {
    const schedule = parseOnCall(
      "Next handoff Tue 2026-07-28: **Ada Lovelace** primary, **Grace Hopper** secondary._",
    );

    assert.equal(schedule?.nextPrimary, "Ada Lovelace");
    assert.equal(schedule?.nextSecondary, "Grace Hopper");
  });

  it("does not flag a live-verified page as unverified", () => {
    const schedule = parseOnCall(
      "primary: **Ada Lovelace**; secondary: **Grace Hopper** " +
        "(shift Tue 2026-06-30 10:00 PT). Verified via incident.io schedule this run.",
    );

    assert.equal(schedule?.unverified, false);
    assert.equal(schedule?.verifiedAsOf, undefined);
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();

    parseOnCall(`primary${" ".repeat(5_000)}X`);
    parseOnCall(`Next handoff ${"x primary ".repeat(4_000)}`);
    parseOnCall(`primary ${"**".repeat(8_000)}`);
    parseOnCall(`Next handoff ${"**a** primary, **b** secondary ".repeat(2_000)}`);

    assert.ok(
      Date.now() - started < 1_000,
      `parseOnCall took ${Date.now() - started}ms on adversarial input`,
    );
  });

  it("returns undefined when the page has no rotation line", () => {
    assert.equal(parseOnCall("# Weekly Handoff\n\nNo schedule section here."), undefined);
  });

  it("names a primary for every published handoff", () => {
    const dir = join(process.cwd(), "data", "confluence");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "no handoff pages found to check");

    for (const file of files) {
      const schedule = parseOnCall(readFileSync(join(dir, file), "utf8"));
      assert.ok(schedule?.primary, `${file}: no primary parsed`);
    }
  });
});

/*
 * The refresh stamp is the only evidence the dashboard has that the upstream
 * health-check automation ran, and an LLM rewrites the wording each day. These
 * cases pin the forms that have actually been published, and — just as important —
 * the refresh-adjacent prose that must NOT be mistaken for a stamp, because a
 * false positive would report a stale page as fresh.
 */
describe("parseRefreshedAt", () => {
  it("reads the live banner's stamp with the zone in parentheses", () => {
    const refresh = parseRefreshedAt(
      "\u{1F504} **Live page** — refreshed daily during the on-call week " +
        "(2026-08-18 → 2026-08-25). Last refreshed **2026-08-19 8:00 AM PT " +
        "(America/Los_Angeles)** (\\~1.3 days into the week).",
      TZ,
    );

    assert.equal(asDate(refresh?.at), "2026-08-19");
    assert.equal(refresh?.text, "2026-08-19 8:00 AM PT (America/Los_Angeles)");
  });

  it("reads the header stamp written with a colon", () => {
    const refresh = parseRefreshedAt(
      "Sources: incident.io + Datadog · Last refreshed: **2026-08-19 8:00 AM PT**.",
      TZ,
    );

    assert.equal(asDate(refresh?.at), "2026-08-19");
  });

  it("reads the frozen page's `Final refresh completed` wording", () => {
    const refresh = parseRefreshedAt(
      "\u{1F512} **Frozen — final state at week close (2026-08-18).** Final refresh " +
        "completed **2026-08-18 12:35 PM PT (America/Los_Angeles)** — later than the " +
        "Tuesday handoff because both connectors were down.",
      TZ,
    );

    assert.equal(asDate(refresh?.at), "2026-08-18");
  });

  it("reads a single-digit hour", () => {
    const eight = parseRefreshedAt("Last refreshed 2026-08-19 8:00 AM PT.", TZ);
    const twelve = parseRefreshedAt("Last refreshed 2026-08-19 12:57 PM PT.", TZ);

    assert.ok(eight?.at);
    assert.ok(twelve?.at);
    assert.ok(twelve.at.getTime() > eight.at.getTime(), "12:57 PM sorts after 8:00 AM");
  });

  it("resolves the stamp in the zone the page names, not the PT abbreviation", () => {
    const pacific = parseRefreshedAt(
      "Last refreshed **2026-08-19 8:00 AM PT (America/Los_Angeles)**.",
      TZ,
    );
    const eastern = parseRefreshedAt(
      "Last refreshed **2026-08-19 8:00 AM PT (America/New_York)**.",
      TZ,
    );

    assert.ok(pacific?.at && eastern?.at);
    assert.equal(
      pacific.at.getTime() - eastern.at.getTime(),
      3 * 60 * 60 * 1000,
      "the named zone wins over the PT abbreviation",
    );
  });

  it("falls back to the team timezone when the page names no zone", () => {
    const refresh = parseRefreshedAt("Last refreshed: 2026-08-19 8:00 AM PT.", TZ);

    assert.equal(asDate(refresh?.at), "2026-08-19");
  });

  it("keeps the stamp verbatim, escaped markdown and all", () => {
    const refresh = parseRefreshedAt(
      "Last refreshed **2026-08-19 8:00 AM PT (America/Los_Angeles)**.",
      TZ,
    );

    assert.equal(refresh?.text, "2026-08-19 8:00 AM PT (America/Los_Angeles)");
  });

  it("prefers the first stamp on the page over the footer's repeat", () => {
    const refresh = parseRefreshedAt(
      "Last refreshed **2026-08-19 8:00 AM PT**.\n" +
        "## Footer\nLast refreshed: 2026-08-12 9:00 AM PT.",
      TZ,
    );

    assert.equal(asDate(refresh?.at), "2026-08-19");
  });

  it("returns undefined when the page has no refresh line", () => {
    assert.equal(
      parseRefreshedAt("# Growth Team Ops Review — Weekly Handoff", TZ),
      undefined,
    );
  });

  it('does not read "New since the last refresh (Jul 25 → Jul 26)" as a stamp', () => {
    assert.equal(
      parseRefreshedAt(
        "New since the last refresh (Jul 25 → Jul 26): the 2026-07-26 pair re-fired.",
        TZ,
      ),
      undefined,
    );
  });

  it('does not read "at this morning\'s 08:02 AM refresh" as a stamp', () => {
    assert.equal(
      parseRefreshedAt(
        "Monitor 2026-08-19 read OK at this morning's 08:02 AM refresh.",
        TZ,
      ),
      undefined,
    );
  });

  it("does not read the banner's `refreshed daily` preamble as a stamp", () => {
    assert.equal(
      parseRefreshedAt(
        "Live page — refreshed daily during the on-call week (2026-08-18 → 2026-08-25).",
        TZ,
      ),
      undefined,
    );
  });

  it("leaves the instant undefined when the stamp names an unknown zone", () => {
    const refresh = parseRefreshedAt(
      "Last refreshed **2026-08-19 8:00 AM XX (Middle/Nowhere)**.",
      TZ,
    );

    assert.ok(refresh, "the stamp is still located");
    assert.equal(asDate(refresh?.at), "2026-08-19", "falls back to the team zone");
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();
    parseRefreshedAt(`last refreshed${" ".repeat(5_000)}X`, TZ);
    parseRefreshedAt(`last refreshed${"*".repeat(8_000)}X`, TZ);
    parseRefreshedAt("last refresh completed ".repeat(4_000), TZ);

    assert.ok(
      Date.now() - started < 1_000,
      `parseRefreshedAt took ${Date.now() - started}ms on adversarial input`,
    );
  });

  // Catches wording drift on the next LLM-authored page. The corpus legitimately
  // contains three pre-July pages with no stamp at all, so the assertion has to
  // encode both directions: locate a stamp where one exists, invent none where it
  // does not.
  it("reads a stamp from every handoff page that publishes one", () => {
    const dir = join(process.cwd(), "data", "confluence");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "no handoff pages found to check");

    for (const file of files) {
      const md = readFileSync(join(dir, file), "utf8");
      const refresh = parseRefreshedAt(md, TZ);

      if (!/last\s+refreshed|refresh(?:ed)?\s+completed/i.test(md)) {
        assert.equal(refresh, undefined, `${file}: invented a stamp on a page without one`);
        continue;
      }
      assert.ok(refresh?.at, `${file}: page states a refresh but no instant was parsed`);
    }
  });
});

/*
 * The coverage check tells the dashboard whether a named on-call is actually
 * available. Two failure modes are worse than not shipping it: reading a page with
 * no check as "everyone is available", and picking up ordinary prose elsewhere on
 * the page as a coverage verdict. Both are pinned below.
 */
describe("parseCoverage", () => {
  it("reads a role marked out of office with a date range", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    const primary = coverage?.roles[CoverageRole.Primary];
    assert.equal(primary?.state, Coverage.OutOfOffice);
    // Compared in the team zone, not UTC: `to` is the END of the last day, so an
    // absence through Aug 22 PT is Aug 23 in UTC. That end-of-day boundary is what
    // makes someone out "20 → 22" still count as absent on the 22nd.
    assert.equal(zoned(primary?.from), "2026-08-20");
    assert.equal(zoned(primary?.to), "2026-08-22");
  });

  it("reads a role marked available", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    assert.equal(
      coverage?.roles[CoverageRole.Secondary].state,
      Coverage.Available,
    );
  });

  it("tells next primary apart from primary", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    assert.equal(
      coverage?.roles[CoverageRole.NextPrimary].state,
      Coverage.OutOfOffice,
    );
    assert.equal(zoned(coverage?.roles[CoverageRole.NextPrimary].from), "2026-08-25");
  });

  it("notes an open-ended absence", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    assert.equal(coverage?.roles[CoverageRole.NextPrimary].openEnded, true);
  });

  it("reads the check timestamp verbatim", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    assert.equal(
      coverage?.checkedAt,
      "Slack out-of-office, as of 2026-08-20 8:00 AM PT",
    );
  });

  it("reports unknown for a role the block explicitly could not check", () => {
    const coverage = parseCoverage(coverageBlock(), TZ);

    assert.equal(
      coverage?.roles[CoverageRole.NextSecondary].state,
      Coverage.Unknown,
    );
  });

  it("reports unknown for a role the block does not mention", () => {
    const coverage = parseCoverage(
      "_Coverage check (as of 2026-08-20):_\n* Primary **Ada Lovelace** — available",
      TZ,
    );

    assert.equal(coverage?.roles[CoverageRole.Primary].state, Coverage.Available);
    assert.equal(coverage?.roles[CoverageRole.Secondary].state, Coverage.Unknown);
  });

  it("reports unknown for every role when the check could not be completed", () => {
    const coverage = parseCoverage(
      "_Coverage check: could not be completed (Slack unreachable) — verify manually._",
      TZ,
    );

    assert.equal(coverage?.unavailableReason, "Slack unreachable");
    for (const role of Object.values(CoverageRole)) {
      assert.equal(coverage?.roles[role].state, Coverage.Unknown, role);
    }
  });

  it("returns undefined when the page carries no coverage check", () => {
    assert.equal(
      parseCoverage("# Growth Team Ops Review — Weekly Handoff", TZ),
      undefined,
    );
  });

  // The honesty case: a missing block must be distinguishable from "all clear".
  it("does not treat a missing block as everyone being available", () => {
    const coverage = parseCoverage("No coverage information on this page.", TZ);

    assert.equal(coverage, undefined, "a missing block must not parse as available");
  });

  it("does not read a role bullet outside the block as a coverage verdict", () => {
    const coverage = parseCoverage(
      "_Coverage check (as of 2026-08-20):_\n" +
        "* Primary **Ada Lovelace** — available\n" +
        "\n## Alerts\n" +
        "* Primary **Grace Hopper** — out of office **2026-08-20 → 2026-08-29**\n",
      TZ,
    );

    assert.equal(
      coverage?.roles[CoverageRole.Primary].state,
      Coverage.Available,
      "the bullet after the heading must not override the block",
    );
  });

  it("does not read coverage prose elsewhere on the page as a check", () => {
    assert.equal(
      parseCoverage(
        "Coverage of the duplicate-funnel monitor improved this week.\n" +
          "* Primary **Ada Lovelace** — acked in 13 s\n",
        TZ,
      ),
      undefined,
    );
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();
    parseCoverage(`coverage check${" ".repeat(6_000)}:`, TZ);
    parseCoverage(`* primary ${"x".repeat(9_000)}`, TZ);
    parseCoverage("coverage check : ".repeat(3_000), TZ);

    assert.ok(
      Date.now() - started < 1_000,
      `parseCoverage took ${Date.now() - started}ms on adversarial input`,
    );
  });

  // Guards the corpus both ways: pages published before this feature must yield
  // nothing, and any page that does carry a block must parse.
  it("parses the coverage block in every handoff page that has one", () => {
    const dir = join(process.cwd(), "data", "confluence");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "no handoff pages found to check");

    for (const file of files) {
      const md = readFileSync(join(dir, file), "utf8");
      const coverage = parseCoverage(md, TZ);

      if (!/coverage\s+check/i.test(md)) {
        assert.equal(coverage, undefined, `${file}: invented a check on a page without one`);
        continue;
      }
      assert.ok(coverage, `${file}: page states a coverage check but none was parsed`);
    }
  });
});

/** Calendar date in the team timezone — `asDate` renders UTC, which shifts end-of-day. */
const zoned = (d?: Date) =>
  d ? DateTime.fromJSDate(d, { zone: TZ }).toISODate() : undefined;

const coverageBlock = () =>
  "_This on-call week — primary: **Ada Lovelace**; secondary: **Grace Hopper**._\n" +
  "_Coverage check (Slack out-of-office, as of 2026-08-20 8:00 AM PT):_\n" +
  "* Primary **Ada Lovelace** — out of office **2026-08-20 → 2026-08-22**\n" +
  "* Secondary **Grace Hopper** — available\n" +
  "* Next primary **Alan Turing** — out of office **2026-08-25 → 2026-08-29** (open-ended)\n" +
  "* Next secondary **Ada Lovelace** — could not be checked\n";

/*
 * Alert times come out of free prose, and the pages never write ISO dates for them:
 * they write "Aug 7 15:00 UTC", "Fri Jul 31 18:23 PT", "~2:18 AM PT Thu Aug 20".
 * The old parser accepted only ISO and fell back to `new Date()` on failure, which
 * silently stamped 9 of 33 alerts with their INGEST time — a plausible-looking wrong
 * clock time on the timeline. These cases pin the real formats, the mixed zones
 * (UTC and PT appear in the same corpus, 7 hours apart), and the refusal to invent
 * a time that the page did not state.
 */
describe("parseEventTime", () => {
  const WINDOW = {
    start: new Date("2026-08-18T07:00:00.000Z"),
    end: new Date("2026-08-25T07:00:00.000Z"),
  };
  const parse = (text: string, window = WINDOW) =>
    parseEventTime(text, { tz: TZ, window });

  it("reads a month-day time in UTC as UTC, not as team-local", () => {
    const t = parse("monitor 313314019 fired at Aug 20 09:17 UTC on env:prod");

    assert.equal(t?.at.toISOString(), "2026-08-20T09:17:00.000Z");
    assert.equal(t?.timeKnown, true);
  });

  it("reads a month-day time marked PT in the team zone", () => {
    const t = parse("the HPA monitor paged Jul 31 18:23 PT on production-eks-cluster");

    // 18:23 PDT is 01:23Z the next day — the whole point of honouring the label.
    assert.equal(t?.at.toISOString(), "2026-08-01T01:23:00.000Z");
  });

  it("does not read a UTC time as if it were team-local", () => {
    const utc = parse("fired at Aug 20 09:17 UTC");
    const pt = parse("fired at Aug 20 09:17 PT");

    assert.notEqual(utc?.at.toISOString(), pt?.at.toISOString());
    assert.equal(
      (pt!.at.getTime() - utc!.at.getTime()) / 3_600_000,
      7,
      "PDT is UTC-7, so the same clock time is 7h later in absolute terms",
    );
  });

  it("reads a 12-hour time with the date written after it", () => {
    const t = parse("paged primary twice overnight (~2:18 AM PT Thu Aug 20)");

    assert.equal(t?.at.toISOString(), "2026-08-20T09:18:00.000Z");
  });

  it("prefers the time introduced by a fired cue over later timestamps", () => {
    const t = parse(
      "fired at Aug 20 09:17 UTC; acked at 09:18:34 UTC; resolved 10:07 UTC",
    );

    assert.equal(t?.at.toISOString(), "2026-08-20T09:17:00.000Z");
  });

  it("infers the year from the on-call week rather than guessing today", () => {
    const t = parse("fired Aug 20 09:17 UTC");

    assert.equal(t?.at.getUTCFullYear(), 2026);
  });

  it("rolls the year over for a week that spans new year", () => {
    const t = parse("fired Jan 2 09:17 UTC", {
      start: new Date("2026-12-29T08:00:00.000Z"),
      end: new Date("2027-01-05T08:00:00.000Z"),
    });

    assert.equal(t?.at.getUTCFullYear(), 2027);
  });

  it("still reads an ISO date and time", () => {
    const t = parse("window opened 2026-08-20 09:17");

    assert.equal(asDate(t?.at), "2026-08-20");
    assert.equal(t?.timeKnown, true);
  });

  // The pages started writing ISO stamps in alert findings, and this branch was
  // flattening them into the team zone: an alert that paged at 16:53 UTC was
  // stored as 23:53 UTC and rendered seven hours late.
  it("reads an ISO time marked UTC as UTC, not as team-local", () => {
    const t = parse("monitor 135119948 fired at 2026-08-20 16:53 UTC on prod");

    assert.equal(t?.at.toISOString(), "2026-08-20T16:53:00.000Z");
    assert.equal(t?.zone, "utc");
  });

  it("reads an unlabelled ISO time in the team zone", () => {
    const t = parse("monitor 135119948 fired at 2026-08-20 16:53 on prod");

    assert.equal(t?.at.toISOString(), "2026-08-20T23:53:00.000Z");
    assert.equal(t?.zone, TZ);
  });

  it("keeps a bare ISO date at team-local midnight even when a zone follows", () => {
    const t = parse("carried since 2026-08-20 UTC with no clock time");

    assert.equal(t?.timeKnown, false);
    assert.equal(
      DateTime.fromJSDate(t!.at, { zone: TZ }).toISODate(),
      "2026-08-20",
      "a labelled date with no time must not shift the day",
    );
  });

  it("reports the day without a time when the page states only a date", () => {
    const t = parse("the OTGE containers-not-ready fire on Mon Aug 17 was un-paged");

    assert.equal(t?.timeKnown, false, "no clock time was stated");
    assert.equal(
      DateTime.fromJSDate(t!.at, { zone: TZ }).toISODate(),
      "2026-08-17",
      "the day is still known",
    );
  });

  // The regression that started this: never invent a time the page did not state.
  it("returns undefined rather than falling back to now", () => {
    assert.equal(parse("no timestamp anywhere in this sentence"), undefined);
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();
    parse(`fired at ${" ".repeat(6_000)} Aug 20`);
    parse(`Aug 20 ${"9".repeat(8_000)}`);
    parse("fired at Aug 20 09:17 UTC ".repeat(2_000));

    assert.ok(
      Date.now() - started < 1_000,
      `parseEventTime took ${Date.now() - started}ms on adversarial input`,
    );
  });
});

describe("serviceFromTitle", () => {
  // Verbatim monitor titles from the current archive.
  it("attributes a monitor whose title names the service tag", () => {
    assert.equal(
      serviceFromTitle("svc-referral has an abnormal change in Apdex (env:prod)"),
      "svc-referral",
    );
    assert.equal(
      serviceFromTitle("313314019 — cronjob-mark-tech-crons cron-run failure"),
      "cronjob-mark-tech-crons",
    );
    assert.equal(
      serviceFromTitle(
        'Monitor 143557417 — "[job-cashout-attempt-restore-event-processor] Message Processing Failure"',
      ),
      "job-cashout-attempt-restore-event-processor",
    );
  });

  it("prefers the most specific tag when one contains another", () => {
    // `service-postman` is also a catalog entry and a prefix of this tag.
    assert.equal(
      serviceFromTitle(
        "119674469 — service-postman-internal high average latency _(fired at Warn)_",
      ),
      "service-postman-internal",
    );
    // `svc-referral` is a prefix of every referral processor tag.
    assert.equal(
      serviceFromTitle("svc-referral-cashout-processor message failures"),
      "svc-referral-cashout-processor",
    );
  });

  it("leaves a monitor unattributed rather than guessing", () => {
    // Both clearly mean a catalog service to a human, but neither spells the
    // tag out — attributing them would link a monitor to the wrong owner.
    assert.equal(serviceFromTitle("OTGE containers not ready (NEW)"), undefined);
    assert.equal(
      serviceFromTitle(
        "HPA sustained high utilization (bank-transactions-neobank) · incident.io alert",
      ),
      undefined,
    );
    assert.equal(serviceFromTitle("HPA sustained high utilization"), undefined);
  });
});
