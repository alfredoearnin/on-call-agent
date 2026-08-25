import { DateTime, type WeekdayNumbers } from "luxon";
import { getConfig } from "@/lib/config";

/**
 * Luxon does not reject out-of-range units, it overflows them: `hour: 99` walks
 * the boundary into another month and `minute: 999` adds 16 hours. A misconfigured
 * env should not silently resolve a week nobody meant, so pin each unit to its
 * real domain before it reaches `set()`.
 */
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.trunc(n)));

/** Luxon's weekday domain is 1-7 (Mon-Sun). */
function toWeekday(n: number): WeekdayNumbers {
  const day = Math.trunc(n);
  return (day >= 1 && day <= 7 ? day : 2) as WeekdayNumbers;
}

export interface OpsWindow {
  /** The handoff instant that opens the current on-call week. */
  start: Date;
  /** The following handoff instant. */
  end: Date;
  /** Prior week [start-7d, start]. */
  priorStart: Date;
  priorEnd: Date;
  /** Days elapsed since window start (floored at ~0.04 to avoid div-by-zero). */
  daysElapsed: number;
  timezone: string;
}

/**
 * Resolve the on-call window (handoff -> the following handoff), week-to-date.
 * Mirrors the agent prompt, Step 0.
 *
 * The boundary is the moment the rotation changes hands, not midnight: a week
 * cut at midnight PT ends ~10h before the Tuesday 11:00 Mexico City handoff, so
 * every page in between lands on the incoming primary who was not yet on call.
 */
export function resolveWindow(now: Date = new Date()): OpsWindow {
  const cfg = getConfig();
  const tz = cfg.team.timezone;
  const { weekday, hour, minute, timezone: handoffZone } = cfg.handoff;

  // Resolve the boundary in the zone the handoff happens in; present it in the
  // team zone.
  const nowT = DateTime.fromJSDate(now, { zone: handoffZone });
  let boundary = nowT.set({
    weekday: toWeekday(weekday),
    hour: clamp(hour, 0, 23),
    minute: clamp(minute, 0, 59),
    second: 0,
    millisecond: 0,
  });
  // set({ weekday }) stays inside the current ISO week, so it can land ahead of
  // now — earlier in the week, or on handoff day before the rotation turns over.
  // Either way the running week is still the previous one.
  if (boundary > nowT) boundary = boundary.minus({ weeks: 1 });

  // Step weeks in the handoff zone, then present in the team zone. Adding 7 days
  // in a DST zone keeps the local clock time and so moves the instant by an hour
  // across a transition; the rotation does not shift by an hour twice a year.
  const start = boundary.setZone(tz);
  const end = boundary.plus({ days: 7 }).setZone(tz);
  const priorStart = boundary.minus({ days: 7 }).setZone(tz);
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
