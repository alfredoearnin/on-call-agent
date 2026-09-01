/**
 * App-level string constants used instead of Prisma enums, so the same schema
 * runs unchanged on SQLite now and Postgres later. Values mirror the agent prompt in agents/.
 */

/** Monitor severity/priority (a property of the monitor). */
export const Priority = {
  High: "High",
  Low: "Low",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** Live Datadog monitor state. */
export const MonitorState = {
  OK: "OK",
  Warn: "Warn",
  Alert: "Alert",
  NoData: "No Data",
  Unknown: "Unknown",
} as const;
export type MonitorState = (typeof MonitorState)[keyof typeof MonitorState];

/** Alert disposition (the agent prompt, Step 1/2). */
export const AlertDisposition = {
  RequiredHumanAttention: "required_human_attention",
  AutoResolved: "auto_resolved",
} as const;
export type AlertDisposition =
  (typeof AlertDisposition)[keyof typeof AlertDisposition];

/** Still-firing split: active prod vs stale/orphaned (the agent prompt, Step 1). */
export const FiringKind = {
  Active: "active",
  Stale: "stale",
  Resolved: "resolved",
} as const;
export type FiringKind = (typeof FiringKind)[keyof typeof FiringKind];

/** Incident classification (the agent prompt, Step 3). */
export const IncidentClass = {
  ProductionCustomerImpact: "production_customer_impact",
  Operational: "operational",
} as const;
export type IncidentClass = (typeof IncidentClass)[keyof typeof IncidentClass];

/** Tuning recommendation status lozenges (the agent prompt, Step 4b / ledger). */
export const RecommendationStatus = {
  Proposed: "proposed",
  Recommend: "recommend",
  StronglyRecommend: "strongly-recommend",
  Applied: "applied",
  Validated: "validated",
  Regressed: "regressed",
  Resolved: "resolved",
} as const;
export type RecommendationStatus =
  (typeof RecommendationStatus)[keyof typeof RecommendationStatus];

/** Confidence of a recommendation. */
export const Confidence = {
  High: "high",
  Medium: "med",
  Low: "low",
} as const;
export type Confidence = (typeof Confidence)[keyof typeof Confidence];

/**
 * Tuning issue patterns (the agent prompt, Step 4b table). Each maps to a canonical
 * recommended change.
 */
export const IssueType = {
  InfraSaturationAutoscaled: "infra_saturation_autoscaled",
  WarnPagingLikeCritical: "warn_paging_like_critical",
  DevNoisePagingProd: "dev_noise_paging_prod",
  VolatileDenominator: "volatile_denominator",
  ThresholdTooLoose: "threshold_too_loose",
  DeadMetricNoData: "dead_metric_no_data",
  DuplicateRedundant: "duplicate_redundant",
  RecurringRealFailure: "recurring_real_failure",
  StaleNonResolving: "stale_non_resolving",
  OwnershipReview: "ownership_review",
} as const;
export type IssueType = (typeof IssueType)[keyof typeof IssueType];

/** Sync mode chosen by the user (on-call dashboard Settings). */
export const SyncMode = {
  Manual: "manual",
  Automatic: "automatic",
} as const;
export type SyncMode = (typeof SyncMode)[keyof typeof SyncMode];

/** How a sync run was triggered. */
export const SyncTrigger = {
  ManualUI: "manual_ui",
  ManualCLI: "manual_cli",
  Scheduler: "scheduler",
  Cron: "cron",
} as const;
export type SyncTrigger = (typeof SyncTrigger)[keyof typeof SyncTrigger];

/** Sync run outcome. */
export const RunStatus = {
  Success: "success",
  Partial: "partial",
  Failed: "failed",
  Running: "running",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

/** Per-source availability within a run (graceful degradation). */
export const SourceStatus = {
  OK: "ok",
  Unavailable: "unavailable",
  Skipped: "skipped",
} as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

/**
 * The handoff page's own state banner (the agent prompt, Step 7 item 0): a page is
 * rewritten daily while its week runs, then frozen by the Tuesday handoff run.
 *
 * Deliberately a third-state enum rather than `frozen?: boolean`, because absence
 * means "the page carried no banner" — not "it is live". Only a page that says
 * `Live page` after its week has ended is evidence the handoff never closed it.
 */
export const PageState = {
  Live: "live",
  Frozen: "frozen",
} as const;
export type PageState = (typeof PageState)[keyof typeof PageState];

/** Which scope/branch of a single monitor an apply targets. */
export const TargetScope = {
  Prod: "prod",
  Dev: "dev",
} as const;
export type TargetScope = (typeof TargetScope)[keyof typeof TargetScope];

/** Applied-change audit status. */
export const AppliedChangeStatus = {
  Applied: "applied",
  Reverted: "reverted",
  Failed: "failed",
} as const;
export type AppliedChangeStatus =
  (typeof AppliedChangeStatus)[keyof typeof AppliedChangeStatus];

/** The two Cursor Automations that produce this dashboard's data, in run order. */
export const AutomationKey = {
  HealthCheck: "health_check",
  DashboardRefresh: "dashboard_refresh",
} as const;
export type AutomationKey = (typeof AutomationKey)[keyof typeof AutomationKey];

/**
 * Health of one cloud automation, inferred from local evidence. Cursor exposes no
 * run-status API, so every state below is a statement about what this checkout
 * could observe — never about what Cursor actually did.
 */
export const AutomationHealthState = {
  /** Positive evidence of today's run was found. */
  Healthy: "healthy",
  /** Due, but the grace window has not closed yet — nothing is wrong. */
  Pending: "pending",
  /** Grace closed, the evidence channel was readable, the evidence is absent.
   *  The only state that accuses an automation. */
  Failed: "failed",
  /** The evidence channel itself could not be read. Absence here proves nothing. */
  Unknown: "unknown",
} as const;
export type AutomationHealthState =
  (typeof AutomationHealthState)[keyof typeof AutomationHealthState];

/**
 * Whether the Tuesday handoff actually closed the week it ended.
 *
 * Separate from AutomationHealthState because it answers a different question on a
 * different clock: that one asks "did today's run land?", this one asks "was the
 * week that just ended given its final refresh?". A run can be perfectly healthy
 * every single day and still leave a closed week truncated — which is exactly what
 * happened to Aug 18 → Aug 25.
 *
 * Stale and Unfrozen are deliberately distinct. Stale means the archived numbers
 * are WRONG (the page stopped being refreshed before its week ended, so it
 * undercounts). Unfrozen means the numbers are complete but the banner still
 * claims the page is live — misleading to a reader, harmless to the data.
 */
export const WeekCloseState = {
  /** Final refresh landed at or after the week's end, and the page is frozen. */
  Closed: "closed",
  /** The page's last refresh predates its own window end — it undercounts. */
  Stale: "stale",
  /** Refreshed through the end, but never flipped out of "Live page". */
  Unfrozen: "unfrozen",
  /** The week has not ended yet — nothing is owed. */
  Pending: "pending",
  /** No archived week, no banner, or no stamp: absence proves nothing. */
  Unknown: "unknown",
} as const;
export type WeekCloseState = (typeof WeekCloseState)[keyof typeof WeekCloseState];

/**
 * What an operator decided to do about a service's on-call ownership.
 *
 * These record intent, not execution: the authoritative owner lives in Cortex
 * and the dashboard cannot write there. `Keep` is the deliberate override —
 * it answers a finding by rejecting it, which is a decision worth recording.
 */
export const OwnershipAction = {
  /** Give it to the team the ownership inventory names. */
  HandOff: "hand-off",
  /** Delete the service rather than transfer it. */
  Delete: "delete",
  /** The tag resolves to nothing in Cortex; fix that before deciding ownership. */
  FixTag: "fix-tag",
  /** Assert Growth ownership and retag Cortex to match. */
  Claim: "claim",
  /** Drop the claim in favour of the team Cortex already records. */
  Concede: "concede",
  /** Reject the finding and keep the service in scope. */
  Keep: "keep",
} as const;
export type OwnershipAction =
  (typeof OwnershipAction)[keyof typeof OwnershipAction];

/** Outcome of a dashboard-initiated automation webhook trigger. */
export const TriggerStatus = {
  Triggered: "triggered",
  Failed: "failed",
  /** The server-side config gate refused (webhook URL or key missing). */
  Blocked: "blocked",
} as const;
export type TriggerStatus = (typeof TriggerStatus)[keyof typeof TriggerStatus];

/**
 * Availability of a rotation member, from the handoff page's coverage check.
 * `Unknown` is load-bearing: the page carrying no check, or a check that failed,
 * must never read as "available".
 */
export const Coverage = {
  Available: "available",
  OutOfOffice: "out_of_office",
  Unknown: "unknown",
} as const;
export type Coverage = (typeof Coverage)[keyof typeof Coverage];

/** The four rotation slots the coverage check reports on. */
export const CoverageRole = {
  Primary: "primary",
  Secondary: "secondary",
  NextPrimary: "nextPrimary",
  NextSecondary: "nextSecondary",
} as const;
export type CoverageRole = (typeof CoverageRole)[keyof typeof CoverageRole];

/** How a monitor config edit entered the dashboard. */
export const MonitorEditSource = {
  DatadogDetected: "datadog_detected",
  DashboardApply: "dashboard_apply",
} as const;
export type MonitorEditSource =
  (typeof MonitorEditSource)[keyof typeof MonitorEditSource];
