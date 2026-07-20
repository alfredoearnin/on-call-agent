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

export function fmtTime(d: Date | string | null | undefined, tz: string): string {
  if (!d) return "—";
  return DateTime.fromJSDate(new Date(d), { zone: tz }).toFormat("h:mm a");
}

/**
 * Split an alert/incident "Agent Finding" into a skimmable TL;DR and the
 * detailed "What happened". The on-call agent emits `TL;DR: … What happened: …`;
 * when those labels are absent (older reports) we derive a one-line summary from
 * the first clause so the UI stays consistent.
 */
export function splitFinding(finding: string | null | undefined): {
  tldr: string | null;
  detail: string | null;
} {
  if (!finding) return { tldr: null, detail: null };
  const text = finding.trim();
  if (!text) return { tldr: null, detail: null };

  if (/tl;?dr:/i.test(text)) {
    const afterTldr = text.replace(/^.*?tl;?dr:\s*/i, "");
    const [tldrPart, ...rest] = afterTldr.split(/\s*what happened:\s*/i);
    const detail = rest.join(" ").trim();
    return { tldr: tldrPart.trim() || null, detail: detail || null };
  }

  // Fallback: first sentence/clause as the summary, full text as the detail.
  const clauses = text.split(/(?<=[.;])\s+/);
  const first = (clauses[0] ?? text).replace(/^observed:\s*/i, "").trim();
  const truncate = (s: string) =>
    s.length > 200 ? `${s.slice(0, 200).trim()}…` : s;
  if (clauses.length <= 1) return { tldr: truncate(text), detail: null };
  return { tldr: truncate(first), detail: text };
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
