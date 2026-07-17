import type {
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
  sourceStatus: {
    datadog: SourceStatus;
    incidentio: SourceStatus;
    jira: SourceStatus;
  };
  notes?: string;
}
