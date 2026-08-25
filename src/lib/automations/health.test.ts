/*
 * Cursor tells us nothing about an automation run, so these verdicts are built
 * entirely from a git log and a line of prose on a Confluence page. The cases
 * below exist to stop the dashboard claiming more than that evidence supports —
 * above all, to stop it blaming the health check for the daily refresh's failure.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AutomationHealthState,
  AutomationKey,
  PageState,
  WeekCloseState,
} from "@/lib/constants";
import {
  assessAutomations,
  assessWeekClose,
  healthTone,
  weekCloseTone,
  worstState,
  type AutomationHealth,
  type AutomationSchedule,
  type PageEvidence,
} from "@/lib/automations/health";
import type { GitEvidence } from "@/lib/automations/git-evidence";
import type { ArchivedWeek } from "@/lib/automations/page-evidence";

// A deliberately DST-shifting fixture, NOT the production slot (which is 12:00
// America/Mexico_City, fixed at UTC-6). `closeDueAt` has to hold for whatever zone
// is configured, so the fixture exercises the harder case: 09:00 America/Chicago
// resolves in August to CDT (UTC-5), not CST — 09:00 → 14:00Z, and +3h grace ⇒
// today's deadline is 17:00Z. Naming the zone rather than an offset is the point.
const SCHEDULE: AutomationSchedule = {
  hour: 9,
  minute: 0,
  timezone: "America/Chicago",
  graceMinutes: 180,
};
const DUE_AT = new Date("2026-08-20T17:00:00Z"); // 12:00 CDT
const BEFORE_DUE = new Date("2026-08-20T16:00:00Z"); // 11:00 CDT
const AFTER_DUE = new Date("2026-08-20T19:00:00Z"); // 14:00 CDT

describe("assessAutomations", () => {
  it("reports the daily refresh healthy when today's commit is on origin/main", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
    });

    assert.equal(refresh.state, AutomationHealthState.Healthy);
  });

  it("matches the subject a squash merge suffixed with a PR number", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-20 (#32)"], { fetchedAt: AFTER_DUE }),
    });

    assert.equal(refresh.state, AutomationHealthState.Healthy);
    assert.ok(refresh.evidence.includes("(#32)"), refresh.evidence);
  });

  it("ignores a Daily refresh commit dated yesterday when judging today", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-19 (#31)"], { fetchedAt: AFTER_DUE }),
    });

    assert.equal(refresh.state, AutomationHealthState.Failed);
  });

  it("names the newest refresh commit it did see in the evidence", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-19 (#31)"], { fetchedAt: AFTER_DUE }),
    });

    assert.ok(refresh.evidence.includes("Daily refresh 2026-08-19 (#31)"), refresh.evidence);
  });

  it("reports the daily refresh pending before the grace window closes", () => {
    const [, refresh] = assess({
      now: BEFORE_DUE,
      git: gitWith(["Daily refresh 2026-08-19 (#31)"], { fetchedAt: BEFORE_DUE }),
    });

    assert.equal(refresh.state, AutomationHealthState.Pending);
    assert.ok(refresh.evidence.includes("due by"), refresh.evidence);
  });

  it("reports the daily refresh unknown when origin was last fetched before today's deadline", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-19 (#31)"], {
        fetchedAt: new Date(DUE_AT.getTime() - 60_000),
      }),
    });

    assert.equal(refresh.state, AutomationHealthState.Unknown);
    assert.ok(refresh.evidence.includes("Refresh from source"), refresh.evidence);
  });

  it("reports the daily refresh unknown when origin has never been fetched", () => {
    const [, refresh] = assess({ git: gitWith(["Daily refresh 2026-08-19"], {}) });

    assert.equal(refresh.state, AutomationHealthState.Unknown);
    assert.ok(refresh.evidence.includes("never been fetched"), refresh.evidence);
  });

  it("reports the daily refresh unknown when git could not read origin/main", () => {
    const [, refresh] = assess({
      git: {
        ref: "origin/main",
        commits: [],
        localCommits: [],
        error: "fatal: bad revision",
      },
    });

    assert.equal(refresh.state, AutomationHealthState.Unknown);
    assert.ok(refresh.evidence.includes("fatal: bad revision"), refresh.evidence);
  });

  it("accepts a commit titled with today's UTC date when the runner's clock is ahead", () => {
    // 2026-08-20 23:30 CDT is already 2026-08-21 in UTC, where the runner names files.
    const [, refresh] = assess({
      now: new Date("2026-08-21T04:30:00Z"),
      git: gitWith(["Daily refresh 2026-08-21"], {
        fetchedAt: new Date("2026-08-21T04:30:00Z"),
      }),
    });

    assert.equal(refresh.state, AutomationHealthState.Healthy);
  });

  it("reports the health check healthy when the page says it refreshed today", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: pageStamped("2026-08-20T15:00:00Z", "2026-08-20 8:00 AM PT"),
    });

    assert.equal(healthCheck.state, AutomationHealthState.Healthy);
  });

  it("reports the health check failed when a page fetched after the deadline still says yesterday", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], {
        fetchedAt: AFTER_DUE,
        committedAt: new Date("2026-08-20T18:30:00Z"), // after the 17:00Z deadline
      }),
      page: pageStamped("2026-08-19T15:00:00Z", "2026-08-19 8:00 AM PT"),
    });

    assert.equal(healthCheck.state, AutomationHealthState.Failed);
  });

  // The crux: when the refresh never landed, today's page was never fetched here,
  // so the health check's outcome is unobservable — not failed.
  it("reports the health check unknown when the refresh never landed, not failed", () => {
    const [healthCheck, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-19 (#31)"], { fetchedAt: AFTER_DUE }),
      page: pageStamped("2026-08-19T15:00:00Z", "2026-08-19 8:00 AM PT"),
    });

    assert.equal(refresh.state, AutomationHealthState.Failed);
    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
    assert.ok(healthCheck.evidence.includes("cannot be observed"), healthCheck.evidence);
  });

  // Regression: origin/main advances on `git fetch`, which does NOT touch the
  // working tree or the DB. Treating "the commit is on origin/main" as "a fresh
  // page reached my DB" produced a false accusation against the health check on a
  // checkout that had fetched but not pulled.
  it("reports the health check unknown when today's refresh is on origin but not pulled here", () => {
    const [healthCheck, refresh] = assess({
      git: {
        ref: "origin/main",
        commits: [
          {
            sha: "remote1",
            committedAt: new Date("2026-08-20T18:30:00Z"),
            subject: "Daily refresh 2026-08-20 (#32)",
          },
        ],
        localCommits: [
          {
            sha: "local1",
            committedAt: new Date("2026-08-19T16:14:00Z"),
            subject: "Daily refresh 2026-08-19 (#31)",
          },
        ],
        lastFetchedAt: AFTER_DUE,
      },
      page: pageStamped("2026-08-19T15:00:00Z", "2026-08-19 8:00 AM PT"),
    });

    assert.equal(refresh.state, AutomationHealthState.Healthy, "the automation did land it");
    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
    assert.ok(
      /not been pulled|Refresh from source/.test(healthCheck.evidence),
      healthCheck.evidence,
    );
  });

  it("does not accuse the health check when the page was fetched before its own deadline", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], {
        fetchedAt: AFTER_DUE,
        committedAt: new Date("2026-08-20T16:30:00Z"), // before the 17:00Z deadline
      }),
      page: pageStamped("2026-08-19T15:00:00Z", "2026-08-19 8:00 AM PT"),
    });

    assert.equal(healthCheck.state, AutomationHealthState.Pending);
  });

  it("reports the health check unknown when the page carries no refresh stamp", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: {},
    });

    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
    assert.ok(healthCheck.evidence.includes("no \"Last refreshed\" line"), healthCheck.evidence);
  });

  it("reports the health check unknown when the page claims a refresh in the future", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: pageStamped("2026-08-25T15:00:00Z", "2026-08-25 8:00 AM PT"),
    });

    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
    assert.ok(healthCheck.evidence.includes("in the future"), healthCheck.evidence);
  });

  it("reports the health check unknown when the page's stamp could not be resolved", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: { refreshedText: "2026-08-20 8:00 AM XX (Middle/Nowhere)" },
    });

    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
    assert.ok(healthCheck.evidence.includes("could not be resolved"), healthCheck.evidence);
  });

  it("reports the health check unknown when nothing has been ingested yet", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: { noRun: true },
    });

    assert.equal(healthCheck.state, AutomationHealthState.Unknown);
  });

  it("quotes the page's stamp verbatim in the evidence", () => {
    const [healthCheck] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
      page: pageStamped("2026-08-20T15:00:00Z", "2026-08-20 8:00 AM PT (America/Los_Angeles)"),
    });

    assert.ok(
      healthCheck.evidence.includes("2026-08-20 8:00 AM PT (America/Los_Angeles)"),
      healthCheck.evidence,
    );
  });

  it("reads the schedule from its input rather than the machine's local day", () => {
    // 08:30 CST is before the 9AM slot, though it is already 14:30 UTC.
    const [, refresh] = assess({
      now: new Date("2026-08-20T13:30:00Z"),
      git: gitWith(["Daily refresh 2026-08-19"], {
        fetchedAt: new Date("2026-08-20T13:30:00Z"),
      }),
    });

    assert.equal(refresh.state, AutomationHealthState.Pending);
  });

  it("attributes the evidence to origin/main, never to HEAD", () => {
    const [, refresh] = assess({
      git: gitWith(["Daily refresh 2026-08-20"], { fetchedAt: AFTER_DUE }),
    });

    assert.ok(refresh.evidence.includes("origin/main"), refresh.evidence);
    assert.ok(!refresh.evidence.includes("HEAD"), refresh.evidence);
  });

  it("reports both automations in a fixed step order", () => {
    const [first, second] = assess({});

    assert.equal(first.key, AutomationKey.HealthCheck);
    assert.equal(second.key, AutomationKey.DashboardRefresh);
  });
});

describe("worstState", () => {
  it("ranks a failure above every other state", () => {
    assert.equal(
      worstState([stateOnly("healthy"), stateOnly("failed"), stateOnly("unknown")]),
      AutomationHealthState.Failed,
    );
  });

  it("ranks an unreadable channel above a run that is merely pending", () => {
    assert.equal(
      worstState([stateOnly("pending"), stateOnly("unknown")]),
      AutomationHealthState.Unknown,
    );
  });

  it("reports healthy only when nothing else is present", () => {
    assert.equal(
      worstState([stateOnly("healthy"), stateOnly("healthy")]),
      AutomationHealthState.Healthy,
    );
  });
});

describe("healthTone", () => {
  it("does not paint an unreadable channel green", () => {
    assert.equal(healthTone(AutomationHealthState.Unknown), "warn");
  });

  it("maps the remaining states to their semantic tones", () => {
    assert.equal(healthTone(AutomationHealthState.Healthy), "ok");
    assert.equal(healthTone(AutomationHealthState.Failed), "alert");
    assert.equal(healthTone(AutomationHealthState.Pending), "neutral");
  });
});

// The week-close check runs on the page windows, which the pages state in PT.
const PT = "America/Los_Angeles";
const WEEK = {
  start: new Date("2026-08-18T07:00:00Z"), // Aug 18 00:00 PT
  end: new Date("2026-08-25T07:00:00Z"), // Aug 25 00:00 PT
};
const AFTER_CLOSE = new Date("2026-08-25T20:00:00Z"); // Aug 25 13:00 PT

describe("assessWeekClose", () => {
  // The Aug 18 -> Aug 25 regression: the run that should have closed this week
  // published a page for the NEW week and reported success, leaving this one
  // frozen 40 h early — its totals cover 5.3 days of a 7-day week. Every daily
  // check passed while it happened, which is why this check has to exist.
  it("reports a week stale when its page stopped being refreshed before its own end", () => {
    const v = closeOf([
      week({
        state: PageState.Live,
        refreshedAt: new Date("2026-08-23T15:05:00Z"),
        refreshedText: "2026-08-23 8:05 AM PT (America/Los_Angeles)",
      }),
    ]);

    assert.equal(v.state, WeekCloseState.Stale);
    assert.equal(v.shortBy, "40 h");
    // The verdict must quote the page, not paraphrase it.
    assert.ok(v.evidence.includes("2026-08-23 8:05 AM PT"), v.evidence);
    assert.ok(v.evidence.includes("Aug 18 → Aug 25"), v.evidence);
  });

  it("reports a week closed when the final refresh landed at its end and the page is frozen", () => {
    const v = closeOf([week()]);

    assert.equal(v.state, WeekCloseState.Closed);
    assert.equal(v.unclosed, 0);
    assert.equal(v.judged, 1);
  });

  // Data is complete, so this is not an alert — but the archive still presents a
  // finished week as in progress, which is how a reader ends up quoting it as live.
  it("reports a week unfrozen when it was refreshed through its end but still says Live page", () => {
    const v = closeOf([week({ state: PageState.Live })]);

    assert.equal(v.state, WeekCloseState.Unfrozen);
    assert.equal(v.unclosed, 1);
    assert.ok(v.evidence.includes("Live page"), v.evidence);
  });

  it("reports pending while the week is still running", () => {
    const v = closeOf([week()], new Date("2026-08-21T20:00:00Z"));

    assert.equal(v.state, WeekCloseState.Pending);
    assert.equal(v.judged, 0);
  });

  it("cannot judge a page that carries no refresh stamp", () => {
    const v = closeOf([
      week({ refreshedAt: undefined, refreshedText: undefined }),
    ]);

    assert.equal(v.state, WeekCloseState.Unknown);
    assert.equal(v.judged, 0, "a stampless page must not count either way");
  });

  // A banner-less page must not be credited as closed just because it does not say
  // "Live page". Testing `state !== Live` would have made the count disagree with
  // the headline about the very same page, and a fleet of banner-less pages would
  // then read as a clean archive.
  it("cannot judge a page refreshed through its end that carries no banner", () => {
    const v = closeOf([week({ state: undefined })]);

    assert.equal(v.state, WeekCloseState.Unknown);
    assert.ok(v.evidence.includes("no state banner"), v.evidence);
    assert.equal(v.judged, 0, "no banner means no verdict, not a clean one");
    assert.equal(v.unclosed, 0);
  });

  // The week ends at 00:00 on handoff day, but the run that closes it does not
  // start until that morning's slot. Judging from the window end alone lit up the
  // loudest state in the vocabulary every Tuesday morning, for a close not yet owed.
  it("stays pending until the handoff run is actually overdue", () => {
    const truncated = week({
      state: PageState.Live,
      refreshedAt: new Date("2026-08-23T15:05:00Z"),
      refreshedText: "2026-08-23 8:05 AM PT (America/Los_Angeles)",
    });

    // Aug 25, 00:30 PT — the week has ended, the 9:00 CST run has not happened.
    assert.equal(
      closeOf([truncated], new Date("2026-08-25T07:30:00Z")).state,
      WeekCloseState.Pending,
    );
    // Aug 25, 12:30 CDT — past the slot plus its 180-minute grace.
    assert.equal(
      closeOf([truncated], new Date("2026-08-25T17:30:00Z")).state,
      WeekCloseState.Stale,
    );
  });

  // One miss is a bad run; four out of five is the reason this shipped.
  it("judges the newest closed week and counts the rest it can read", () => {
    const v = closeOf([
      week({
        file: "handoff-2026-08-04.md",
        window: {
          start: new Date("2026-08-04T07:00:00Z"),
          end: new Date("2026-08-11T07:00:00Z"),
        },
        refreshedAt: undefined,
        refreshedText: undefined,
      }),
      week({
        file: "handoff-2026-08-11.md",
        window: {
          start: new Date("2026-08-11T07:00:00Z"),
          end: new Date("2026-08-18T07:00:00Z"),
        },
        refreshedAt: new Date("2026-08-18T19:35:00Z"),
      }),
      week({
        state: PageState.Live,
        refreshedAt: new Date("2026-08-23T15:05:00Z"),
        refreshedText: "2026-08-23 8:05 AM PT (America/Los_Angeles)",
      }),
    ]);

    assert.equal(v.state, WeekCloseState.Stale, "the newest closed week wins");
    assert.equal(v.judged, 2, "the stampless week is not judgeable");
    assert.equal(v.unclosed, 1);
  });

  it("reports unknown when the archive could not be read", () => {
    const v = assessWeekClose(
      { weeks: [], error: "data/confluence could not be read (ENOENT)" },
      AFTER_CLOSE,
      PT,
      SCHEDULE,
    );

    assert.equal(v.state, WeekCloseState.Unknown);
    assert.ok(v.evidence.includes("ENOENT"), v.evidence);
    // The reader hands us an errno, never Node's message — that embeds the
    // absolute deployment path, and this sentence is rendered in the UI.
    assert.ok(!/\//.test(v.evidence.replace("data/confluence", "")), v.evidence);
  });

  it("reports unknown when there are no archived pages at all", () => {
    const v = closeOf([]);

    assert.equal(v.state, WeekCloseState.Unknown);
  });
});

describe("weekCloseTone", () => {
  it("alerts only on stale, the one state where the archived numbers are wrong", () => {
    assert.equal(weekCloseTone(WeekCloseState.Stale), "alert");
    assert.equal(weekCloseTone(WeekCloseState.Unfrozen), "warn");
  });

  it("maps the remaining states to their semantic tones", () => {
    assert.equal(weekCloseTone(WeekCloseState.Closed), "ok");
    assert.equal(weekCloseTone(WeekCloseState.Pending), "neutral");
    assert.equal(weekCloseTone(WeekCloseState.Unknown), "warn");
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

const week = (over: Partial<ArchivedWeek> = {}): ArchivedWeek => ({
  file: "handoff-2026-08-18.md",
  window: WEEK,
  state: PageState.Frozen,
  refreshedAt: new Date("2026-08-25T19:35:00Z"), // Aug 25 12:35 PT, after close
  refreshedText: "2026-08-25 12:35 PM PT (America/Los_Angeles)",
  ...over,
});

const closeOf = (weeks: ArchivedWeek[], now: Date = AFTER_CLOSE) =>
  assessWeekClose({ weeks }, now, PT, SCHEDULE);

function assess(over: {
  now?: Date;
  git?: GitEvidence;
  page?: PageEvidence;
}): AutomationHealth[] {
  return assessAutomations({
    now: over.now ?? AFTER_DUE,
    schedule: SCHEDULE,
    git: over.git ?? gitWith([], { fetchedAt: AFTER_DUE }),
    page: over.page ?? pageStamped("2026-08-19T15:00:00Z", "2026-08-19 8:00 AM PT"),
  });
}

function gitWith(
  subjects: string[],
  opts: { fetchedAt?: Date; committedAt?: Date },
): GitEvidence {
  const commits = subjects.map((subject, i) => ({
    sha: `sha${i}`,
    committedAt: opts.committedAt ?? new Date("2026-08-20T18:30:00Z"),
    subject,
  }));
  // Default to a checkout that has pulled everything it can see; the
  // fetched-but-not-pulled case is exercised explicitly above.
  return { ref: "origin/main", commits, localCommits: commits, lastFetchedAt: opts.fetchedAt };
}

const pageStamped = (iso: string, text: string): PageEvidence => ({
  refreshedAt: new Date(iso),
  refreshedText: text,
  runStartedAt: new Date(iso),
  runStatus: "success",
});

const stateOnly = (state: string) =>
  ({ state } as unknown as AutomationHealth);
