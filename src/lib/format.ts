import { DateTime } from "luxon";
import {
  RecommendationStatus,
  MonitorState,
  Priority,
  Confidence,
} from "@/lib/constants";

/** Semantic color token name for a recommendation status lozenge. */
export function statusTone(status: string): string {
  switch (status) {
    case RecommendationStatus.StronglyRecommend:
    case RecommendationStatus.Regressed:
      return "alert";
    case RecommendationStatus.Recommend:
      return "warn";
    case RecommendationStatus.Applied:
      return "info";
    case RecommendationStatus.Validated:
      return "ok";
    case RecommendationStatus.Resolved:
      return "ok";
    default:
      return "neutral"; // proposed
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case RecommendationStatus.StronglyRecommend:
      return "strongly recommend";
    case RecommendationStatus.Validated:
      return "validated ✓";
    default:
      return status;
  }
}

export function monitorStateTone(state: string): string {
  switch (state) {
    case MonitorState.OK:
      return "ok";
    case MonitorState.Warn:
      return "warn";
    case MonitorState.Alert:
      return "alert";
    case MonitorState.NoData:
      return "neutral";
    default:
      return "neutral";
  }
}

export function priorityTone(priority: string): string {
  return priority === Priority.High ? "alert" : "info";
}

export function confidenceLabel(c: string): string {
  switch (c) {
    case Confidence.High:
      return "high";
    case Confidence.Medium:
      return "medium";
    default:
      return "low";
  }
}

export function fmtDateTime(d: Date | string | null | undefined, tz: string): string {
  if (!d) return "—";
  return DateTime.fromJSDate(new Date(d), { zone: tz }).toFormat("MMM d, yyyy · h:mm a");
}

export function fmtDate(d: Date | string | null | undefined, tz: string): string {
  if (!d) return "—";
  return DateTime.fromJSDate(new Date(d), { zone: tz }).toFormat("MMM d, yyyy");
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const rel = DateTime.fromJSDate(new Date(d)).toRelative();
  return rel ?? "—";
}

export function trendArrow(trend: string | null | undefined): string {
  switch (trend) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "flat":
      return "→";
    default:
      return "";
  }
}

/** YYYY-MM-DD in a timezone (for the daily view day key). */
export function dayKey(d: Date | string, tz: string): string {
  return DateTime.fromJSDate(new Date(d), { zone: tz }).toISODate() ?? "";
}
