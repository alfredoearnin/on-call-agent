/**
 * Evidence-based health for the two cloud Cursor Automations.
 *
 * Cursor exposes no API to read an automation's run status, so health is inferred
 * from the only two things this checkout can actually observe:
 *
 *   #2 daily refresh  → a `Daily refresh <date>` commit on origin/main
 *   #1 health check   → the "Last refreshed" stamp on the page #2 fetched
 *
 * Every state below is therefore a statement about what could be observed here,
 * never about what Cursor did. The module is pure — it imports only luxon and
 * constants, takes `now` and the schedule as arguments, and reads no clock, no
 * DB, and no filesystem of its own. That is what makes the truth table testable.
 */

import { DateTime } from "luxon";
import {
  AutomationHealthState,
  AutomationKey,
  PageState,
  WeekCloseState,
  type AutomationHealthState as HealthState,
} from "@/lib/constants";
import { AUTOMATIONS, automationMeta } from "@/lib/automations/meta";
import type { GitCommit, GitEvidence } from "@/lib/automations/git-evidence";
import type { ArchivedWeek, PageArchive } from "@/lib/automations/page-evidence";

/**
 * agents/OnCall dashboard.md step 6b commits `Daily refresh $(date +%Y-%m-%d)`; the squash
 * merge in step 6d appends the PR number, so what actually lands on main is
 * `Daily refresh 2026-08-19 (#31)`. A pattern anchored to `^Daily refresh <date>$`
 * would miss every real commit.
 */
export const DAILY_REFRESH_SUBJECT =
  /^Daily refresh (\d{4}-\d{2}-\d{2})(?:\s+\(#\d+\))?\s*$/;

/** The daily slot the automations run in — an input, never a constant. */
export interface AutomationSchedule {
  hour: number;
  minute: number;
  /** IANA zone the slot is expressed in (9AM CST → America/Chicago). */
  timezone: string;
  /** How long after the slot a run may still legitimately be in flight. */
  graceMinutes: number;
}

/** What the newest ingestion run recorded about the page it parsed. */
export interface PageEvidence {
  refreshedAt?: Date;
  refreshedText?: string;
  runStartedAt?: Date;
  runStatus?: string;
  /** No ingestion run at all — a checkout that has never ingested. */
  noRun?: boolean;
}

export interface HealthInputs {
  now: Date;
  schedule: AutomationSchedule;
  git: GitEvidence;
  page: PageEvidence;
}

export interface AutomationHealth {
  key: AutomationKey;
  /** The name exactly as it reads in Cursor, so the user can find the run. */
  name: string;
  produces: string;
  state: HealthState;
  /**
   * One sentence stating what was and was not observed, written to be rendered
   * VERBATIM. The UI must not paraphrase it: this string is the whole honesty
   * contract. It never speculates about a cause, because we cannot see Cursor.
   */
  evidence: string;
  /** When the evidence being quoted was produced (commit time / page stamp). */
  evidenceAt?: Date;
  /**
   * When this checkout last had a chance to see that evidence. Undefined means we
   * never looked — which is exactly why a state can be Unknown.
   */
  observedAt?: Date;
  /** Today's slot, and the deadline used to judge it. */
  expectedAt: Date;
  dueAt: Date;
}

/**
 * Ordinary clock skew between the cloud runner and this laptop, tolerated so a
 * slightly-ahead stamp is not read as a refresh that has not happened yet.
 */
const FUTURE_TOLERANCE_MS = 2 * 60 * 60 * 1000;

const fmtTime = (d: Date, zone: string) =>
  DateTime.fromJSDate(d, { zone }).toFormat("h:mm a ZZZZ");

const localDate = (d: Date, zone: string) =>
  DateTime.fromJSDate(d, { zone }).toISODate();

export function assessAutomations(inputs: HealthInputs): AutomationHealth[] {
  const { now, schedule, git, page } = inputs;
  const { timezone: zone } = schedule;

  const expectedAt = DateTime.fromJSDate(now, { zone })
    .set({ hour: schedule.hour, minute: schedule.minute, second: 0, millisecond: 0 })
    .toJSDate();
  const dueAt = DateTime.fromJSDate(expectedAt, { zone })
    .plus({ minutes: schedule.graceMinutes })
    .toJSDate();
  const pastDue = now.getTime() >= dueAt.getTime();
  const deadline = fmtTime(dueAt, zone);

  // The commit title's date comes from `date +%Y-%m-%d` on the cloud runner's
  // clock, almost certainly UTC. At the 9AM CST slot the UTC and CST dates agree;
  // they diverge only for an evening re-run. Accepting either can only turn a
  // "failed" into a "healthy" on the strength of a commit that really exists — it
  // never fabricates one.
  const todayKeys = new Set(
    [localDate(now, zone), localDate(now, "utc")].filter(Boolean) as string[],
  );

  const refresh = assessDailyRefresh({
    now, git, zone, dueAt, pastDue, deadline, todayKeys, expectedAt,
  });

  // The moment a fresh copy of the page actually entered THIS working tree, which
  // is the only thing that licenses a conclusion about the health check. It comes
  // from HEAD, not from the remote-tracking ref: `git fetch` advances origin/main
  // without touching the tree or the DB, so a fetched-but-not-pulled refresh means
  // today's page has still never been read here.
  const pulled = todaysRefreshCommit(git.localCommits, todayKeys);
  const landedRemotely = Boolean(todaysRefreshCommit(git.commits, todayKeys));

  const healthCheck = assessHealthCheck({
    now, page, zone, dueAt, pastDue, deadline, todayKeys, expectedAt,
    pageObservedAt: pulled?.committedAt,
    landedRemotely,
  });

  // Fixed order: step 1 before step 2, matching how the chain actually runs.
  const byKey = new Map([
    [AutomationKey.HealthCheck, healthCheck],
    [AutomationKey.DashboardRefresh, refresh],
  ]);
  return AUTOMATIONS.map((meta) => byKey.get(meta.key)!);
}

interface Ctx {
  now: Date;
  zone: string;
  dueAt: Date;
  pastDue: boolean;
  deadline: string;
  todayKeys: Set<string>;
  expectedAt: Date;
}

/** The refresh commit for today in a given list, if it is there. */
function todaysRefreshCommit(commits: GitCommit[], todayKeys: Set<string>) {
  for (const commit of commits) {
    const m = DAILY_REFRESH_SUBJECT.exec(commit.subject.trim());
    if (m && todayKeys.has(m[1])) return commit;
  }
  return undefined;
}

function newestRefreshSubject(git: GitEvidence): string | undefined {
  return git.commits.find((c) => DAILY_REFRESH_SUBJECT.test(c.subject.trim()))
    ?.subject;
}

function assessDailyRefresh(
  ctx: Ctx & { git: GitEvidence },
): AutomationHealth {
  const meta = automationMeta(AutomationKey.DashboardRefresh);
  const { git, zone, dueAt, pastDue, deadline, todayKeys, expectedAt, now } = ctx;
  const base = { key: meta.key, name: meta.label, produces: meta.produces, expectedAt, dueAt };
  const today = [...todayKeys][0];

  if (git.error) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `Could not read ${git.ref}: ${git.error}`,
    };
  }

  const commit = todaysRefreshCommit(git.commits, todayKeys);
  if (commit) {
    // Positive evidence is unconditional on when we last fetched: a commit that
    // exists cannot un-exist, so a stale view invalidates only NEGATIVE evidence.
    // That asymmetry is what lets the render stay passive.
    return {
      ...base,
      state: AutomationHealthState.Healthy,
      evidence: `Found "${commit.subject.trim()}" on ${git.ref}, committed ${fmtTime(commit.committedAt, zone)}.`,
      evidenceAt: commit.committedAt,
      observedAt: git.lastFetchedAt,
    };
  }

  const lastSeen = newestRefreshSubject(git);
  const lastSeenNote = lastSeen ? ` Newest refresh commit seen: "${lastSeen.trim()}".` : "";

  if (!pastDue) {
    return {
      ...base,
      state: AutomationHealthState.Pending,
      evidence: `No "Daily refresh ${today}" commit on ${git.ref} yet; today's run is due by ${deadline}.${lastSeenNote}`,
      observedAt: git.lastFetchedAt,
    };
  }

  if (!git.lastFetchedAt) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `No "Daily refresh ${today}" commit in this checkout, but origin has never been fetched here — that is not evidence of a failure. Use Refresh from source to look.${lastSeenNote}`,
    };
  }

  if (git.lastFetchedAt.getTime() < dueAt.getTime()) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `No "Daily refresh ${today}" commit in this checkout's copy of ${git.ref}, but origin was last fetched ${fmtTime(git.lastFetchedAt, zone)} — before today's ${deadline} deadline. Not evidence of a failure; use Refresh from source to look again.${lastSeenNote}`,
      observedAt: git.lastFetchedAt,
    };
  }

  return {
    ...base,
    state: AutomationHealthState.Failed,
    evidence: `origin was fetched ${fmtTime(git.lastFetchedAt, zone)}, after today's ${deadline} deadline, and ${git.ref} carries no "Daily refresh ${today}" commit.${lastSeenNote}`,
    observedAt: git.lastFetchedAt,
    evidenceAt: now,
  };
}

function assessHealthCheck(
  ctx: Ctx & {
    page: PageEvidence;
    /**
     * When today's refresh commit landed in THIS working tree. Undefined means
     * today's page has never been read here — see assessAutomations.
     *
     * Deliberately the commit time, not page.runStartedAt: a local
     * `npm run ingest` bumps runStartedAt without re-fetching Confluence, so
     * treating it as a fresh look would let a local re-parse manufacture an
     * accusation against this automation.
     */
    pageObservedAt?: Date;
    /** Today's refresh exists on the remote, whether or not it is pulled. */
    landedRemotely: boolean;
  },
): AutomationHealth {
  const meta = automationMeta(AutomationKey.HealthCheck);
  const {
    page, zone, dueAt, pastDue, deadline, todayKeys, expectedAt, now,
    pageObservedAt, landedRemotely,
  } = ctx;
  const base = { key: meta.key, name: meta.label, produces: meta.produces, expectedAt, dueAt };

  if (page.noRun) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: "No ingestion run has recorded a handoff page yet.",
    };
  }

  if (!page.refreshedText && !page.refreshedAt) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence:
        'The ingested handoff page carries no "Last refreshed" line, so its age cannot be read.',
    };
  }

  if (!page.refreshedAt) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `The page's stamp "${page.refreshedText}" could not be resolved to a time.`,
      observedAt: pageObservedAt,
    };
  }

  const quoted = page.refreshedText ?? localDate(page.refreshedAt, zone);

  if (page.refreshedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `The page claims "Last refreshed ${quoted}", which is in the future — treating its age as unreadable.`,
      evidenceAt: page.refreshedAt,
      observedAt: pageObservedAt,
    };
  }

  if (todayKeys.has(localDate(page.refreshedAt, zone) ?? "")) {
    return {
      ...base,
      state: AutomationHealthState.Healthy,
      evidence: `The ingested handoff page says "Last refreshed ${quoted}".`,
      evidenceAt: page.refreshedAt,
      observedAt: pageObservedAt,
    };
  }

  if (!pastDue) {
    return {
      ...base,
      state: AutomationHealthState.Pending,
      evidence: `The page still says "Last refreshed ${quoted}"; today's run is due by ${deadline}.`,
      evidenceAt: page.refreshedAt,
      observedAt: pageObservedAt,
    };
  }

  // The crux. Without today's refresh commit in THIS tree, today's page has never
  // been read here, so this automation's outcome is genuinely unobservable.
  // Reporting "failed" would be blaming #1 for something it may not have done.
  if (!pageObservedAt) {
    const why = landedRemotely
      ? `Today's dashboard refresh has landed on the remote but has not been pulled into this checkout, so today's page has not been ingested here yet — click Refresh from source.`
      : `Today's dashboard refresh has not landed, so today's page has never been fetched here and this automation's status today cannot be observed.`;
    return {
      ...base,
      state: AutomationHealthState.Unknown,
      evidence: `The newest handoff page in this repo says "Last refreshed ${quoted}". ${why}`,
      evidenceAt: page.refreshedAt,
    };
  }

  if (pageObservedAt.getTime() < dueAt.getTime()) {
    return {
      ...base,
      state: AutomationHealthState.Pending,
      evidence: `The copy fetched ${fmtTime(pageObservedAt, zone)} predates this automation's ${deadline} deadline, so its stamp says nothing about today yet.`,
      evidenceAt: page.refreshedAt,
      observedAt: pageObservedAt,
    };
  }

  return {
    ...base,
    state: AutomationHealthState.Failed,
    evidence: `Today's dashboard refresh fetched the page ${fmtTime(pageObservedAt, zone)} and it still says "Last refreshed ${quoted}".`,
    evidenceAt: page.refreshedAt,
    observedAt: pageObservedAt,
  };
}

/** The worst state across all automations — for a single header indicator. */
export function worstState(healths: AutomationHealth[]): HealthState {
  const rank: HealthState[] = [
    AutomationHealthState.Failed,
    AutomationHealthState.Unknown,
    AutomationHealthState.Pending,
    AutomationHealthState.Healthy,
  ];
  for (const state of rank) {
    if (healths.some((h) => h.state === state)) return state;
  }
  return AutomationHealthState.Unknown;
}

/**
 * Semantic tone for a health state. `unknown` maps to warn, not ok: "I can't
 * tell" is not health, and painting it green is the exact lie this feature exists
 * to remove.
 */
export function healthTone(
  state: HealthState,
): "ok" | "warn" | "alert" | "neutral" {
  if (state === AutomationHealthState.Healthy) return "ok";
  if (state === AutomationHealthState.Failed) return "alert";
  if (state === AutomationHealthState.Pending) return "neutral";
  return "warn";
}

// ── Week close ──────────────────────────────────────────────────────────────

/**
 * Did the Tuesday handoff actually close the week that ended?
 *
 * This is the blind spot assessAutomations cannot see. That function asks whether
 * a run happened today, and by that measure the week of Aug 18 → Aug 25 looked
 * perfect: a page was published every day. But the run that ended it never gave
 * the closing week its final refresh, so the archived page froze reading
 * "Last refreshed Aug 23" and permanently undercounts its own week. Nothing in
 * the daily view could notice, because the daily view was fine.
 *
 * The damage is silent and cumulative: every stale archived page understates its
 * week forever, and any trend drawn across those weeks is wrong by whatever the
 * missing days held. So this reports both the newest closed week and how many of
 * the readable closed weeks share the problem — one is a miss, five is a design flaw.
 */
export interface WeekCloseHealth {
  state: WeekCloseState;
  /**
   * One sentence stating what the archive shows, rendered VERBATIM. Same contract
   * as AutomationHealth.evidence: it quotes the page and never guesses at a cause.
   */
  evidence: string;
  /** The closed week this verdict is about, when one could be identified. */
  window?: { start: Date; end: Date };
  refreshedAt?: Date;
  refreshedText?: string;
  /** How long before its own window end that page stopped being refreshed. */
  shortBy?: string;
  /** Closed weeks left unclosed, out of those whose pages can be judged at all. */
  unclosed: number;
  judged: number;
}

/**
 * A page is properly closed when it was refreshed through its end AND says frozen.
 *
 * Positive evidence on both counts, deliberately: `state !== Live` would let a page
 * with no banner at all count as closed, which is the same absence-means-fine lie
 * the rest of this module exists to avoid — and it would disagree with the headline
 * verdict, which reads that page as Unknown.
 */
function isClosed(w: ArchivedWeek): boolean {
  if (!w.window || !w.refreshedAt) return false;
  return (
    w.refreshedAt.getTime() >= w.window.end.getTime() &&
    w.state === PageState.Frozen
  );
}

const fmtWindow = (w: { start: Date; end: Date }, zone: string) =>
  `${DateTime.fromJSDate(w.start, { zone }).toFormat("LLL d")} → ${DateTime.fromJSDate(w.end, { zone }).toFormat("LLL d")}`;

/** Hours below two days, days above — the scale a reader actually thinks in. */
function humanGap(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

/**
 * When the close of a week ending at `end` becomes late.
 *
 * A week ends at 00:00 local on the handoff day, but the run that closes it does
 * not start until that morning's slot. Judging from the window end alone would
 * paint every Tuesday morning red for a close that is not yet owed — and a weekly
 * false alarm on the loudest state in the vocabulary is how alerting gets ignored.
 *
 * The handoff day is the calendar day the window ends in the PAGE's zone; the slot
 * is that day's slot in the SCHEDULE's zone. They genuinely differ (windows are
 * stated in PT, the automations are scheduled in CST), and going through the
 * calendar date rather than arithmetic on the instant keeps that unambiguous.
 */
function closeDueAt(
  end: Date,
  zone: string,
  schedule: AutomationSchedule,
): number {
  const handoffDay = DateTime.fromJSDate(end, { zone }).toISODate();
  return DateTime.fromISO(handoffDay ?? "", { zone: schedule.timezone })
    .set({ hour: schedule.hour, minute: schedule.minute })
    .plus({ minutes: schedule.graceMinutes })
    .toMillis();
}

export function assessWeekClose(
  archive: PageArchive,
  now: Date,
  /** Zone the pages state their windows in, and the zone verdicts are worded in. */
  zone: string,
  /** The handoff run's slot, so a week is never "late" before its close is due. */
  schedule: AutomationSchedule,
): WeekCloseHealth {
  const none = { unclosed: 0, judged: 0 };

  if (archive.error) {
    return {
      ...none,
      state: WeekCloseState.Unknown,
      evidence: `The handoff archive could not be read (${archive.error}), so no week close can be checked.`,
    };
  }
  if (archive.weeks.length === 0) {
    return {
      ...none,
      state: WeekCloseState.Unknown,
      evidence:
        "No archived handoff pages were found, so no week close can be checked.",
    };
  }

  // A week is owed a close once the run that should have closed it is overdue.
  const closed = archive.weeks.filter(
    (w) => w.window && closeDueAt(w.window.end, zone, schedule) <= now.getTime(),
  );
  if (closed.length === 0) {
    return {
      ...none,
      state: WeekCloseState.Pending,
      evidence:
        "No week on file has passed its handoff deadline yet, so no close is owed.",
    };
  }

  // A page can only be judged if it carries a window, a stamp AND a banner. The
  // earliest pages predate both the stamp and the banner; counting them either way
  // would lie, and crediting them as closed would hide the very thing we look for.
  const judgeable = closed.filter((w) => w.refreshedAt && w.state);
  const counts = {
    judged: judgeable.length,
    unclosed: judgeable.filter((w) => !isClosed(w)).length,
  };

  const newest = closed[closed.length - 1];
  const window = newest.window!;
  const label = fmtWindow(window, zone);
  const base = {
    ...counts,
    window,
    refreshedAt: newest.refreshedAt,
    refreshedText: newest.refreshedText,
  };

  if (!newest.refreshedAt) {
    return {
      ...base,
      state: WeekCloseState.Unknown,
      evidence: `The page for ${label} carries no refresh stamp, so whether that week was ever closed cannot be read.`,
    };
  }

  const shortByMs = window.end.getTime() - newest.refreshedAt.getTime();
  if (shortByMs > 0) {
    const shortBy = humanGap(shortByMs);
    return {
      ...base,
      state: WeekCloseState.Stale,
      shortBy,
      evidence: `The week of ${label} has ended, but its page was last refreshed "${newest.refreshedText}" — ${shortBy} before the week closed, so everything it reports stops there.`,
    };
  }

  if (newest.state === PageState.Live) {
    return {
      ...base,
      state: WeekCloseState.Unfrozen,
      evidence: `The week of ${label} was refreshed through its close, but its banner still reads "Live page", so a finished week is presented as still in progress.`,
    };
  }

  if (!newest.state) {
    return {
      ...base,
      state: WeekCloseState.Unknown,
      evidence: `The page for ${label} was refreshed through its close but carries no state banner, so whether it was frozen cannot be read.`,
    };
  }

  return {
    ...base,
    state: WeekCloseState.Closed,
    evidence: `The week of ${label} was closed with a final refresh at "${newest.refreshedText}".`,
  };
}

/** Semantic tone for a week-close verdict, on the same scale as healthTone. */
export function weekCloseTone(
  state: WeekCloseState,
): "ok" | "warn" | "alert" | "neutral" {
  if (state === WeekCloseState.Closed) return "ok";
  // Stale is the only one that means the archived numbers are actually wrong.
  if (state === WeekCloseState.Stale) return "alert";
  if (state === WeekCloseState.Pending) return "neutral";
  return "warn";
}
