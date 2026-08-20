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

/** One labelled block of a finding's "What happened" detail. */
export interface FindingSection {
  /** e.g. "Observed", "Likely cause". Absent for text before the first label. */
  label?: string;
  body: string;
}

/**
 * Splits a finding detail into its labelled sections.
 *
 * The agent marks sections with markdown emphasis — `_Observed_`, `_Likely cause_`
 * — but the same prose quotes Datadog queries stuffed with snake_case identifiers
 * (`sum:kubernetes_state.job.failed{kube_app_name:…} by {kube_cluster_name,env}`).
 * Running a general markdown renderer over that would eat the underscores out of
 * the query and silently corrupt the one piece of text an on-call actually needs
 * to copy. So this recognises only a deliberate section label, defined narrowly:
 *
 *   - at the very start, or after a sentence boundary (`.`, `)`, `:`, `;`) + space,
 *   - opening with a capital letter,
 *   - containing letters, spaces and hyphens only — which is what excludes
 *     `_state.job.failed{kube_` and `_timeout); aiden.ramgoolam user_`,
 *   - and short (a label, not a sentence).
 *
 * Everything else, underscores included, is passed through verbatim.
 */
const SECTION_LABEL = /(^|[.:;)]\s{1,3})_([A-Z][A-Za-z]{0,18}(?:[ -][A-Za-z]{1,18}){0,3})_/g;

export function splitFindingSections(
  detail: string | null | undefined,
): FindingSection[] {
  if (!detail) return [];
  const text = detail.trim();
  if (!text) return [];

  const marks: { at: number; end: number; label: string }[] = [];
  SECTION_LABEL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_LABEL.exec(text)) !== null) {
    marks.push({
      at: m.index + m[1].length,
      end: m.index + m[0].length,
      label: m[2].trim(),
    });
  }

  if (marks.length === 0) return [{ body: text }];

  const out: FindingSection[] = [];
  const lead = text.slice(0, marks[0].at).trim();
  if (lead) out.push({ body: stripLeadingDash(lead) });

  marks.forEach((mark, i) => {
    const bodyEnd = i + 1 < marks.length ? marks[i + 1].at : text.length;
    const body = stripLeadingDash(text.slice(mark.end, bodyEnd).trim());
    out.push({ label: mark.label, body });
  });

  return out;
}

/** The agent writes `_Observed_ — the thing`; the dash is a separator, not content. */
function stripLeadingDash(s: string): string {
  return s.replace(/^\s*[—–-]\s*/, "").trim();
}
