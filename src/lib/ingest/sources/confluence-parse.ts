import { DateTime } from "luxon";
import { getConfig } from "@/lib/config";
import {
  Priority,
  MonitorState,
  AlertDisposition,
  FiringKind,
  IssueType,
  Confidence,
  RecommendationStatus,
  SourceStatus,
} from "@/lib/constants";
import type {
  IngestBundle,
  NormalizedAlert,
  NormalizedMonitor,
  NormalizedRecommendation,
  NormalizedSchedule,
  ProposedPatch,
} from "@/lib/ingest/types";

/**
 * Parses the on-call agent's Confluence pages (weekly handoff + tuning ledger,
 * in the markdown the Atlassian tools return) into the dashboard's normalized
 * structures. Defensive: every section is optional and skipped if not found.
 */

/** Strip markdown links/bold/status macros to plain text. */
function clean(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/<custom[^>]*>(.*?)<\/custom>/gis, "$1") // status macros
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monitorIdFrom(text: string): string | undefined {
  const m = /\b(\d{5,})\b/.exec(text);
  return m?.[1];
}

function alertIdFrom(text: string): string | undefined {
  const m = /\b(01[0-9A-HJKMNP-TV-Z]{24})\b/.exec(text); // ULID
  return m?.[1];
}

function parseDate(text: string, tz: string): Date | undefined {
  const m = /(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?/.exec(text);
  if (!m) return undefined;
  const iso = m[2] ? `${m[1]}T${m[2]}` : m[1];
  const dt = DateTime.fromISO(iso, { zone: tz });
  return dt.isValid ? dt.toJSDate() : undefined;
}

/** Return the body of a section between a heading and the next heading. */
function section(md: string, headingPattern: RegExp): string | undefined {
  const lines = md.split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (h && headingPattern.test(h[2])) {
      start = i + 1;
      level = h[1].length;
      break;
    }
  }
  if (start === -1) return undefined;
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const h = /^(#{1,6})\s+/.exec(lines[i]);
    if (h && h[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

/** Parse a markdown table into rows of trimmed cells (skips header + divider). */
function parseTable(body: string): string[][] {
  const rows: string[][] = [];
  const lines = body.split("\n").filter((l) => l.trim().startsWith("|"));
  for (const line of lines) {
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue; // divider
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length) rows.push(cells);
  }
  // Drop the header row (first row) if present.
  return rows.length > 1 ? rows.slice(1) : rows;
}

// ── Week window (Tue -> Tue) ────────────────────────────────────────────────

const WINDOW =
  /on-call week[^\n]*?(\d{4}-\d{2}-\d{2})[^\n]*?(?:→|->)[^\n]*?(\d{4}-\d{2}-\d{2})/i;

/**
 * The state banner sits above the header and cites the *next* week's page ("a
 * new page opens for the next week", "see the next week's page (X → Y)"), so
 * taking the first window on the page reports the wrong week once a page
 * freezes. Prefer a line that is not talking about another week.
 */
function windowMatch(md: string): RegExpExecArray | null {
  for (const line of md.split("\n")) {
    if (NEXT_CUE.test(line)) continue;
    const m = WINDOW.exec(line);
    if (m) return m;
  }
  return WINDOW.exec(md);
}

export function parseWindow(
  md: string,
  tz: string,
): { start: Date; end: Date } | undefined {
  const m = windowMatch(md);
  if (!m) return undefined;
  const start = DateTime.fromISO(m[1], { zone: tz }).startOf("day");
  const end = DateTime.fromISO(m[2], { zone: tz }).startOf("day");
  if (!start.isValid || !end.isValid) return undefined;
  return { start: start.toJSDate(), end: end.toJSDate() };
}

// ── On-call schedule ────────────────────────────────────────────────────────

/**
 * The rotation is free prose and the wording drifts: three forms have shipped
 * so far — `primary: X; secondary: Y`, `Primary X, Secondary Y` (when
 * incident.io could not be reached), and `the new week's primary is X,
 * secondary Y`. Matching whole sentences broke on each new one, so instead find
 * every role label sitting next to an emphasised name and use a "next" cue to
 * separate the upcoming rotation from the current one. `on-call.md` pins the
 * canonical wording; this is the tolerance around it.
 *
 * Every quantifier is bounded: a name may contain spaces, so an unbounded `\s*`
 * beside the capture lets the engine split a whitespace run exponentially many
 * ways and hang the ingest.
 */

/** An emphasised name — every page bolds the people it names. */
const BOLD_NAME = String.raw`\*\*\s{0,4}([\p{L}][^*\n;,()]{0,48}?)\s{0,4}\*\*`;
/** The little that may sit between a role label and its name. */
const LABEL = String.raw`\s{0,4}(?:is|:|—|–|-)?\s{0,4}`;

/** `primary: **X**`, `primary is **X**`, `Primary **X**`. */
const ROLE_THEN_NAME = new RegExp(
  String.raw`\b(primary|secondary)\b${LABEL}${BOLD_NAME}`,
  "gdiu",
);
/** `**X** primary` — the order the next-handoff line often uses. */
const NAME_THEN_ROLE = new RegExp(
  String.raw`${BOLD_NAME}\s{0,4}(primary|secondary)\b`,
  "gdiu",
);

/** Marks a rotation as the one starting at the upcoming handoff. */
const NEXT_CUE = /\b(?:next|new week|upcoming)\b/i;

/**
 * The paragraph whose job is to state the rotation: `On-call: …`,
 * `On-call (closing week): …`, `_This on-call week — …`. Confining the scan to
 * it keeps prose that merely credits someone with a role ("acked by **Grace
 * Hopper** primary within 30s") from being read as the rotation.
 */
const ROTATION_PARAGRAPH = /^[_*\s]*(?:this\s+)?on-call\b/i;

/**
 * Sentence boundary. The period must follow two non-period characters so that
 * `10:00 a.m. PT: primary **X**` stays joined to its "next" cue instead of
 * being split into a cue-less fragment and read as the current rotation.
 */
const SENTENCE_END = /(?<=[^\s.][^\s.]\.)\s/;

/** Wording that means "we could not confirm this against incident.io". */
const UNVERIFIED =
  /could not be verified|cannot be verified|unverified|last verified|carried (?:over )?from/i;

/** `Last verified (Aug 4)` or `last verified: 2026-08-04` → the date as written. */
const VERIFIED_AS_OF = /last verified\s*(?:\(([^)]+)\)|:\s*([^.;,]+))/i;

const flatten = (s: string) => s.replace(/\s+/g, " ");

type Role = "primary" | "secondary";

/** Every `role → name` pairing in one sentence, in the order they appear. */
function rolesNamed(sentence: string): { role: Role; name: string }[] {
  const hits: { role: Role; name: string; at: number }[] = [];
  const taken: [number, number][] = [];

  for (const m of sentence.matchAll(ROLE_THEN_NAME)) {
    hits.push({ role: m[1].toLowerCase() as Role, name: m[2], at: m.index });
    taken.push(m.indices![2]!);
  }

  // `**X** primary` also matches inside `primary **X** secondary`, which would
  // give X both roles and discard the real secondary. Skip names already spoken for.
  for (const m of sentence.matchAll(NAME_THEN_ROLE)) {
    const [from, to] = m.indices![1]!;
    if (taken.some(([start, end]) => from < end && start < to)) continue;
    hits.push({ role: m[2].toLowerCase() as Role, name: m[1], at: m.index });
  }

  return hits.sort((a, b) => a.at - b.at);
}

export function parseOnCall(md: string): NormalizedSchedule | undefined {
  const current: Partial<Record<Role, string>> = {};
  const upcoming: Partial<Record<Role, string>> = {};
  /** The paragraph naming the current rotation, for the verified/carried check. */
  let context: string | undefined;

  const paragraphs = md.split(/\n\s*\n/).map(flatten);
  const declared = paragraphs.filter((p) => ROTATION_PARAGRAPH.test(p));

  for (const flat of declared.length ? declared : paragraphs) {
    // A paragraph can name both rotations, so classify sentence by sentence.
    for (const sentence of flat.split(SENTENCE_END)) {
      const named = rolesNamed(sentence);
      if (!named.length) continue;
      const isNext = NEXT_CUE.test(sentence);
      for (const { role, name } of named) {
        (isNext ? upcoming : current)[role] ??= clean(name);
      }
      if (!isNext) context ??= flat;
    }
  }

  if (!current.primary && !current.secondary && !upcoming.primary) return undefined;

  const unverified = Boolean(context) && UNVERIFIED.test(context!);
  const asOf = unverified ? VERIFIED_AS_OF.exec(context!) : null;

  return {
    primary: current.primary,
    secondary: current.secondary,
    nextPrimary: upcoming.primary,
    nextSecondary: upcoming.secondary,
    unverified,
    verifiedAsOf: clean(asOf?.[1] ?? asOf?.[2] ?? "") || undefined,
  };
}

// ── KPIs (alert-volume summary paragraph) ───────────────────────────────────

interface ParsedKpis {
  totalAlerts: number;
  highAlerts: number;
  lowAlerts: number;
  humanAttention: number;
  autoResolved: number;
  escalationNum: number;
  escalationDen: number;
  activeFiring: number;
  staleFiring: number;
}

function parseKpis(md: string): ParsedKpis | undefined {
  const t = md.replace(/\s+/g, " ");
  const total = /paging alerts:\s*\**(\d+)\s*total\**[^(]*\((\d+)\s*High,\s*(\d+)\s*Low\)/i.exec(t);
  if (!total) return undefined;
  const human = /Human-attention:\s*\**(\d+)/i.exec(t);
  const auto = /Auto-resolved[^:]*:\s*\**(\d+)/i.exec(t);
  const esc = /Escalation rate[^:]*:\s*\**(\d+)\/(\d+)/i.exec(t);
  const firing = /Still firing:\s*\**(\d+)\s*active\s*\/\s*(\d+)\s*stale/i.exec(t);
  return {
    totalAlerts: Number(total[1]),
    highAlerts: Number(total[2]),
    lowAlerts: Number(total[3]),
    humanAttention: human ? Number(human[1]) : 0,
    autoResolved: auto ? Number(auto[1]) : 0,
    escalationNum: esc ? Number(esc[1]) : 0,
    escalationDen: esc ? Number(esc[2]) : Number(total[1]),
    activeFiring: firing ? Number(firing[1]) : 0,
    staleFiring: firing ? Number(firing[2]) : 0,
  };
}

// ── Recommendations (tuning table) ──────────────────────────────────────────

function statusFrom(text: string): RecommendationStatus {
  const t = text.toLowerCase();
  if (t.includes("strongly")) return RecommendationStatus.StronglyRecommend;
  if (t.includes("validated")) return RecommendationStatus.Validated;
  if (t.includes("regressed")) return RecommendationStatus.Regressed;
  if (t.includes("applied")) return RecommendationStatus.Applied;
  if (t.includes("resolved")) return RecommendationStatus.Resolved;
  if (t.includes("recommend")) return RecommendationStatus.Recommend;
  return RecommendationStatus.Proposed;
}

function confidenceFrom(text: string): Confidence {
  const t = text.toLowerCase();
  if (t.startsWith("high") || t.includes("high")) return Confidence.High;
  if (t.startsWith("med") || t.includes("medium")) return Confidence.Medium;
  return Confidence.Low;
}

function issueTypeFrom(text: string): IssueType {
  const t = text.toLowerCase();
  if (/hpa|autoscal|saturation|utilization|cpu|memory/.test(t)) {
    if (/dev|non-prod|dev-eks/.test(t)) return IssueType.DevNoisePagingProd;
    return IssueType.InfraSaturationAutoscaled;
  }
  if (/apdex|anomal|ratio|volatile|deviation/.test(t)) return IssueType.VolatileDenominator;
  if (/no data|dead metric/.test(t)) return IssueType.DeadMetricNoData;
  if (/real failure|code bug|business-logic|do not tune/.test(t)) return IssueType.RecurringRealFailure;
  if (/duplicate|redundant/.test(t)) return IssueType.DuplicateRedundant;
  if (/stale|non-auto-resolving|lingering/.test(t)) return IssueType.StaleNonResolving;
  if (/ownership|routing review/.test(t)) return IssueType.OwnershipReview;
  return IssueType.ThresholdTooLoose;
}

/** Best-effort structured patch from the before -> after change text. */
function patchFrom(changeText: string, issueType: string): ProposedPatch | undefined {
  const t = changeText.toLowerCase();
  if (t.includes("incidentio-high") && t.includes("incidentio-low")) {
    return {
      target: "message",
      prod: { find: "@webhook-incidentio-high", replace: "@webhook-incidentio-low" },
    };
  }
  if (t.includes("last_5m") && t.includes("last_15m")) {
    return { target: "query", prod: { find: "last_5m", replace: "last_15m" } };
  }
  if (t.includes("last_2h") && t.includes("last_4h")) {
    return { target: "query", prod: { find: "last_2h", replace: "last_4h" } };
  }
  if (issueType === IssueType.InfraSaturationAutoscaled && t.includes("low")) {
    return {
      target: "message",
      prod: { find: "@webhook-incidentio-high", replace: "@webhook-incidentio-low" },
    };
  }
  return undefined;
}

function splitBeforeAfter(cell: string): { before: string; after: string; summary: string } {
  const summary = /^\s*\*\*(.+?)\*\*/.exec(cell)?.[1] ?? "";
  const before = /before:\s*(.+?)\s*after:/is.exec(cell)?.[1] ?? "";
  const after = /after:\s*(.+?)(?:_Coverage|_Impact|$)/is.exec(cell)?.[1] ?? "";
  return {
    before: clean(before) || "(see recommendation)",
    after: clean(after) || clean(cell),
    summary: clean(summary) || "Tuning recommendation",
  };
}

function parseRecommendations(md: string): NormalizedRecommendation[] {
  const sec = section(md, /Monitor Tuning Recommendations/i);
  if (!sec) return [];
  const rows = parseTable(sec);
  const out: NormalizedRecommendation[] = [];
  for (const cells of rows) {
    if (cells.length < 6) continue;
    const [monCell, issueCell, evidenceCell, changeCell, confCell, statusCell] = cells;
    const monitorId = monitorIdFrom(monCell);
    const monitorName = clean(monCell).replace(/^\d+\s*[—-]\s*/, "").trim() || `Monitor ${monitorId ?? "?"}`;
    const issue = clean(issueCell);
    const issueType = issueTypeFrom(issue + " " + changeCell);
    const { before, after, summary } = splitBeforeAfter(changeCell);
    out.push({
      monitorId,
      monitorKey: monitorId ?? clean(monCell).slice(0, 40),
      monitorName,
      issueType,
      title: summary,
      before,
      after,
      changeSummary: summary,
      evidence: clean(evidenceCell),
      confidence: confidenceFrom(clean(confCell)),
      status: statusFrom(statusCell),
      firesThisWeek: 0,
      patch: patchFrom(changeCell, issueType),
    });
  }
  return out;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

function parseRequiredAttention(md: string, tz: string): NormalizedAlert[] {
  const sec = section(md, /Required Human Attention/i);
  if (!sec) return [];
  const out: NormalizedAlert[] = [];
  for (const cells of parseTable(sec)) {
    if (cells.length < 5) continue;
    const [alertCell, priorityCell, serviceCell, , findingCell] = cells;
    const monitorId = monitorIdFrom(alertCell);
    const id = alertIdFrom(alertCell) ?? `cf-rha-${monitorId ?? clean(alertCell).slice(0, 12)}`;
    const finding = clean(findingCell);
    out.push({
      id,
      monitorId,
      source: "confluence",
      title: clean(alertCell).replace(/^Monitor\s*\d+\s*[—-]?\s*/i, "").trim() || "Alert",
      priority: /high/i.test(priorityCell) ? Priority.High : Priority.Low,
      status: /resolved|self-resolved|auto-resolved/i.test(finding) ? "resolved" : "firing",
      disposition: AlertDisposition.RequiredHumanAttention,
      firingKind: FiringKind.Resolved,
      firedAt: parseDate(finding, tz) ?? new Date(),
      env: clean(serviceCell) || undefined,
      timesFired: 1,
      finding,
    });
  }
  return out;
}

function parseBulletAlerts(
  md: string,
  headingPattern: RegExp,
  disposition: string | undefined,
  firingKind: string,
  tz: string,
): NormalizedAlert[] {
  const sec = section(md, headingPattern);
  if (!sec) return [];
  const out: NormalizedAlert[] = [];
  for (const line of sec.split("\n")) {
    if (!/^\s*[*-]\s+/.test(line)) continue;
    const text = clean(line.replace(/^\s*[*-]\s+/, ""));
    const monitorId = monitorIdFrom(text);
    const id = alertIdFrom(text);
    if (!id && !monitorId) continue;
    out.push({
      id: id ?? `cf-${firingKind}-${monitorId}`,
      monitorId,
      source: "confluence",
      title: text.slice(0, 140),
      priority: /high/i.test(text) ? Priority.High : Priority.Low,
      status: firingKind === FiringKind.Stale ? "firing" : "resolved",
      disposition: disposition as NormalizedAlert["disposition"],
      firingKind: firingKind as NormalizedAlert["firingKind"],
      firedAt: parseDate(text, tz) ?? new Date(),
      timesFired: 1,
      finding: text,
    });
  }
  return out;
}

// ── Vulnerabilities ─────────────────────────────────────────────────────────

function parseVuln(md: string): IngestBundle["vuln"] {
  const t = md.replace(/\s+/g, " ");
  const total = /Vulnerabilities:\**\s*\**(\d+)\s*open/i.exec(t);
  if (!total) return undefined;
  const ch = /(\d+)\s*Critical,\s*(\d+)\s*High/i.exec(t);
  return {
    total: Number(total[1]),
    critical: ch ? Number(ch[1]) : 0,
    high: ch ? Number(ch[2]) : 0,
    scope: "org-wide",
    source: "Confluence handoff",
  };
}

// ── Monitors (minimal, collected from recs + alerts for FK + links) ─────────

function collectMonitors(
  recs: NormalizedRecommendation[],
  alerts: NormalizedAlert[],
): NormalizedMonitor[] {
  const appBase = getConfig().datadog.appBase;
  const byId = new Map<string, NormalizedMonitor>();
  const add = (id: string | undefined, name: string) => {
    if (!id || byId.has(id)) return;
    byId.set(id, {
      id,
      name,
      priority: Priority.High,
      tags: [],
      state: MonitorState.Unknown,
      datadogUrl: `${appBase}/monitors/${id}`,
    });
  };
  for (const r of recs) add(r.monitorId, r.monitorName);
  for (const a of alerts) add(a.monitorId ?? undefined, a.title);
  return [...byId.values()];
}

// ── Top-level ───────────────────────────────────────────────────────────────

export function parseConfluence(
  handoffMd: string,
  now: Date = new Date(),
): IngestBundle {
  const tz = getConfig().team.timezone;
  const window = parseWindow(handoffMd, tz);
  const schedule = parseOnCall(handoffMd);
  const kpis = parseKpis(handoffMd);
  const recommendations = parseRecommendations(handoffMd);
  const alerts = [
    ...parseRequiredAttention(handoffMd, tz),
    ...parseBulletAlerts(handoffMd, /Auto-Resolved/i, AlertDisposition.AutoResolved, FiringKind.Resolved, tz),
    ...parseBulletAlerts(handoffMd, /Open Going Into Handoff/i, undefined, FiringKind.Stale, tz),
  ];
  const vuln = parseVuln(handoffMd);
  const monitors = collectMonitors(recommendations, alerts);

  return {
    monitors,
    alerts,
    incidents: [], // handoff shows "No incidents" in the sample; extend if needed
    recommendations,
    vuln,
    schedule,
    kpis: kpis ?? undefined,
    window,
    sourceStatus: {
      datadog: SourceStatus.Skipped,
      incidentio: SourceStatus.Skipped,
      jira: SourceStatus.Skipped,
    },
    notes: `Confluence source${kpis ? "" : " (KPI summary not parsed)"}`,
  };
}
