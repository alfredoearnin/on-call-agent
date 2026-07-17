/**
 * App-level string constants used instead of Prisma enums, so the same schema
 * runs unchanged on SQLite now and Postgres later. Values mirror on-call.md.
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

/** Alert disposition (on-call.md Step 1/2). */
export const AlertDisposition = {
  RequiredHumanAttention: "required_human_attention",
  AutoResolved: "auto_resolved",
} as const;
export type AlertDisposition =
  (typeof AlertDisposition)[keyof typeof AlertDisposition];

/** Still-firing split: active prod vs stale/orphaned (on-call.md Step 1). */
export const FiringKind = {
  Active: "active",
  Stale: "stale",
  Resolved: "resolved",
} as const;
export type FiringKind = (typeof FiringKind)[keyof typeof FiringKind];

/** Incident classification (on-call.md Step 3). */
export const IncidentClass = {
  ProductionCustomerImpact: "production_customer_impact",
  Operational: "operational",
} as const;
export type IncidentClass = (typeof IncidentClass)[keyof typeof IncidentClass];

/** Tuning recommendation status lozenges (on-call.md Step 4b / ledger). */
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
 * Tuning issue patterns (on-call.md Step 4b table). Each maps to a canonical
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
