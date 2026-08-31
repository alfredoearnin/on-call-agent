/**
 * Hash and field-level diffs for Datadog monitor config snapshots.
 *
 * Kept free of Prisma so ingest, the edits UI, and tests share one definition
 * of "what changed".
 */

import { createHash } from "node:crypto";

export type MonitorConfigField = "query" | "message" | "priority" | "thresholds";

export interface MonitorConfigFields {
  query?: string | null;
  message?: string | null;
  priority?: string | null;
  thresholds?: unknown;
  options?: unknown;
}

export interface FieldDiff {
  field: MonitorConfigField;
  before: string;
  after: string;
}

/** Stable JSON so key order does not flip the hash. */
export function stableJson(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJson(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(",")}}`;
}

export function thresholdsFromOptions(options: unknown): unknown {
  if (!options || typeof options !== "object") return undefined;
  const t = (options as Record<string, unknown>).thresholds;
  return t === undefined ? undefined : t;
}

export function hashMonitorConfig(fields: MonitorConfigFields): string {
  const thresholds = fields.thresholds ?? thresholdsFromOptions(fields.options);
  const parts = [
    fields.query ?? "",
    fields.message ?? "",
    fields.priority ?? "",
    stableJson(thresholds),
    stableJson(fields.options),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

function fieldText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  return stableJson(value);
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * A snapshot written by a source that cannot read Datadog config (Confluence,
 * demo). Every Datadog monitor has a query, so a row missing all four config
 * fields carries only ledger metadata — `priority` is excluded because those
 * sources do supply it. The first Datadog snapshot that follows one of these
 * is the baseline capture, not something an operator changed.
 */
export function hasNoDatadogConfig(fields: MonitorConfigFields): boolean {
  return (
    isBlank(fields.query) &&
    isBlank(fields.message) &&
    isBlank(fields.thresholds) &&
    isBlank(fields.options)
  );
}

/**
 * Field-level before/after. Empty when nothing material changed.
 *
 * Filling thresholds/options on a snapshot that previously stored them as
 * null is a backfill of the new hash, not an operator edit — skip those
 * unless query, message, or priority also moved.
 */
export function diffMonitorConfig(
  prev: MonitorConfigFields,
  next: MonitorConfigFields,
): FieldDiff[] {
  // Either direction is a source artefact: moving into a config-less snapshot
  // means the sync could not read Datadog, not that a query was deleted.
  if (hasNoDatadogConfig(prev) || hasNoDatadogConfig(next)) return [];

  const pairs: { field: MonitorConfigField; before: unknown; after: unknown }[] =
    [
      { field: "query", before: prev.query, after: next.query },
      { field: "message", before: prev.message, after: next.message },
      { field: "priority", before: prev.priority, after: next.priority },
      {
        field: "thresholds",
        before: prev.thresholds ?? thresholdsFromOptions(prev.options),
        after: next.thresholds ?? thresholdsFromOptions(next.options),
      },
    ];

  const diffs: FieldDiff[] = [];
  for (const { field, before, after } of pairs) {
    const b = fieldText(before);
    const a = fieldText(after);
    if (b === a) continue;
    diffs.push({ field, before: b, after: a });
  }

  const coreChanged = diffs.some((d) => d.field !== "thresholds");
  const onlyThresholdBackfill =
    !coreChanged &&
    diffs.length === 1 &&
    diffs[0].field === "thresholds" &&
    isBlank(prev.thresholds) &&
    isBlank(prev.options);

  if (onlyThresholdBackfill) return [];
  return diffs;
}

export interface PatchLike {
  target?: string;
  prod?: { find: string; replace: string };
  dev?: { find: string; replace: string };
}

/**
 * True when a recommendation's intended `replace` is visible in `after`.
 *
 * Unlike the feedback loop, this does not require `find` to have disappeared:
 * a HIGH→LOW split keeps the High handle inside `is_alert` and adds Low in
 * `is_warning`, so both strings are present on purpose.
 */
export function recommendationExplainsEdit(
  patch: PatchLike | null,
  after: MonitorConfigFields,
): boolean {
  if (!patch) return false;
  const branch = patch.prod ?? patch.dev;
  if (!branch?.replace) return false;
  const field =
    patch.target === "query"
      ? after.query
      : patch.target === "priority"
        ? after.priority
        : after.message;
  if (!field) return false;
  return field.includes(branch.replace);
}
