/*
 * Cursor tells us nothing about an automation run, so these verdicts are built
 * entirely from a git log and a line of prose on a Confluence page. The cases
 * below exist to stop the dashboard claiming more than that evidence supports —
 * above all, to stop it blaming the health check for the daily refresh's failure.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AutomationHealthState, AutomationKey } from "@/lib/constants";
import {
  assessAutomations,
  healthTone,
  worstState,
  type AutomationHealth,
  type AutomationSchedule,
  type PageEvidence,
} from "@/lib/automations/health";
import type { GitEvidence } from "@/lib/automations/git-evidence";

// The 9AM slot is expressed in America/Chicago, so in August it resolves in CDT
// (UTC-5), not CST: 09:00 → 14:00Z, and +3h grace ⇒ today's deadline is 17:00Z.
// Naming the zone rather than an offset is the point — luxon handles the shift.
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

// ── helpers ─────────────────────────────────────────────────────────────────

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
