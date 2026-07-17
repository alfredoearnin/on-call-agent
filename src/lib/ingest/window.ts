import { DateTime } from "luxon";
import { getConfig } from "@/lib/config";

export interface OpsWindow {
  /** Tuesday 00:00 that opens the current on-call week. */
  start: Date;
  /** The following Tuesday 00:00. */
  end: Date;
  /** Prior week [start-7d, start]. */
  priorStart: Date;
  priorEnd: Date;
  /** Days elapsed since window start (floored at ~0.04 to avoid div-by-zero). */
  daysElapsed: number;
  timezone: string;
}

/**
 * Resolve the on-call window (Tuesday -> the following Tuesday), week-to-date,
 * in the team timezone. Mirrors on-call.md Step 0.
 */
export function resolveWindow(now: Date = new Date()): OpsWindow {
  const tz = getConfig().team.timezone;
  const nowT = DateTime.fromJSDate(now, { zone: tz });

  // Luxon weekday: Mon=1 ... Sun=7. Tuesday = 2.
  const daysSinceTuesday = (nowT.weekday - 2 + 7) % 7;
  const mostRecentTuesday = nowT
    .minus({ days: daysSinceTuesday })
    .startOf("day");

  const start = mostRecentTuesday;
  const end = start.plus({ days: 7 });
  const priorStart = start.minus({ days: 7 });
  const priorEnd = start;

  const daysElapsed = Math.max(0.04, nowT.diff(start, "days").days);

  return {
    start: start.toJSDate(),
    end: end.toJSDate(),
    priorStart: priorStart.toJSDate(),
    priorEnd: priorEnd.toJSDate(),
    daysElapsed,
    timezone: tz,
  };
}

/** Epoch seconds helper for Datadog queries. */
export function toEpochSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}
