import type {
  Coverage,
  CoverageRole,
  Priority,
  MonitorState,
  AlertDisposition,
  FiringKind,
  IncidentClass,
  IssueType,
  Confidence,
  RecommendationStatus,
  SourceStatus,
} from "@/lib/constants";

export interface NormalizedMonitor {
  id: string;
  name: string;
  service?: string;
  priority: Priority;
  tags: string[];
  state: MonitorState;
  query?: string;
  message?: string;
  datadogUrl?: string;
  envScope?: string;
  cluster?: string;
  modifiedAt?: Date;
  thresholds?: unknown;
  options?: unknown;
}

export interface NormalizedAlert {
  id: string;
  monitorId?: string;
  source: string;
  title: string;
  priority: Priority;
  status: string; // firing | resolved
  disposition?: AlertDisposition;
  firingKind?: FiringKind;
  firedAt: Date;
  /** False when the page stated a day but no clock time (or no time at all). */
  firedAtTimeKnown?: boolean;
  resolvedAt?: Date;
  ackedBy?: string;
  ackLatencySec?: number;
  escalationStatus?: string;
  env?: string;
  cluster?: string;
  timesFired: number;
  finding?: string;
}

export interface NormalizedIncident {
  id: string;
  title: string;
  severity?: string;
  classification: IncidentClass;
  service?: string;
  status?: string;
  openedAt: Date;
  resolvedAt?: Date;
  url?: string;
}

/** A find/replace transform applied to a monitor field for a given scope. */
export interface PatchBranch {
  find: string;
  replace: string;
}

export interface ProposedPatch {
  /** Which monitor field the change edits. */
  target: "message" | "query" | "priority";
  /** Transform for the prod branch/scope of the monitor. */
  prod?: PatchBranch;
  /** Transform for the dev branch/scope of the monitor. */
  dev?: PatchBranch;
  /** For priority target: the new numeric Datadog priority. */
  priorityValue?: number;
}

export interface NormalizedRecommendation {
  monitorId?: string;
  monitorKey: string;
  monitorName: string;
  service?: string;
  issueType: IssueType;
  title: string;
  before: string;
  after: string;
  changeSummary: string;
  coveragePreserved?: string;
  expectedImpact?: string;
  evidence?: string;
  confidence: Confidence;
  status: RecommendationStatus;
  firesThisWeek: number;
  weeksSeen?: number;
  autoResolvedPct?: number;
  nightPages?: number;
  lastFiredAt?: Date;
  patch?: ProposedPatch;
}

export interface NormalizedVuln {
  total: number;
  critical: number;
  high: number;
  scope?: string;
  source?: string;
}

export interface NormalizedSchedule {
  primary?: string;
  secondary?: string;
  nextPrimary?: string;
  nextSecondary?: string;
  /** The handoff page could not confirm these names against incident.io, so
   * they are the last known rotation carried forward rather than live truth. */
  unverified?: boolean;
  /** When the names were last confirmed, verbatim from the page (e.g. "Aug 4"). */
  verifiedAsOf?: string;
}

/**
 * The handoff page's own account of when it was last rewritten — the only signal
 * the dashboard has that the upstream health-check automation ran.
 */
export interface PageRefresh {
  /** Resolved instant, for the staleness arithmetic. Derived — may be absent. */
  at?: Date;
  /**
   * The stamp verbatim, e.g. `2026-08-19 8:00 AM PT (America/Los_Angeles)`. Kept
   * so the UI can always quote what the page actually said, even when the wording
   * drifted past what `at` could resolve. That is the difference between "I don't
   * know" and "I have nothing".
   */
  text: string;
  /** True when only a date was written, so `at` is midnight, not the real hour. */
  dateOnly?: boolean;
}

/** One rotation slot's availability, as the handoff page's coverage check stated it. */
export interface CoverageEntry {
  state: Coverage;
  /** First day of the absence, in the team timezone. */
  from?: Date;
  /** Last day of the absence, end-of-day so a same-day range still overlaps. */
  to?: Date;
  /** The page said the Slack status had no expiry, so `to` is the week end. */
  openEnded?: boolean;
  /** The page's own sentence, kept for rendering verbatim. */
  evidence?: string;
}

/**
 * The handoff page's coverage check. Records only WHO is out and WHICH dates —
 * never a reason (see the redaction rules in the agent prompt (agents/)).
 */
export interface PageCoverage {
  /** When the check ran, verbatim as the page wrote it. */
  checkedAt?: string;
  /** Set when the check itself could not be completed (e.g. Slack unreachable). */
  unavailableReason?: string;
  roles: Record<CoverageRole, CoverageEntry>;
}

/** Pre-computed KPI numbers (e.g. parsed from the Confluence summary). When
 * present, persistBundle uses these instead of computing from the alert set. */
export interface KpiOverride {
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

export interface IngestBundle {
  monitors: NormalizedMonitor[];
  alerts: NormalizedAlert[];
  incidents: NormalizedIncident[];
  recommendations: NormalizedRecommendation[];
  vuln?: NormalizedVuln;
  schedule?: NormalizedSchedule;
  kpis?: KpiOverride;
  /** The on-call week window this bundle reports (e.g. from a handoff page). */
  window?: { start: Date; end: Date };
  /** The page's "Last refreshed" stamp. Absent on pages published before it existed. */
  pageRefresh?: PageRefresh;
  /** The page's coverage check. Absent on pages published before it existed. */
  coverage?: PageCoverage;
  sourceStatus: {
    datadog: SourceStatus;
    incidentio: SourceStatus;
    jira: SourceStatus;
  };
  notes?: string;
}
