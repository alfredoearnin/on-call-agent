"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig, canApply } from "@/lib/config";
import { DatadogClient } from "@/lib/clients/datadog";
import {
  AppliedChangeStatus,
  RecommendationStatus,
  TargetScope,
} from "@/lib/constants";
import type {
  PatchBranch,
  PatchOption,
  ProposedPatch,
} from "@/lib/ingest/types";
import { parseStoredPatch } from "@/lib/ingest/patch-schema";

/** Which Monitor column a patch target writes to locally. */
type PatchField = "message" | "query" | "priority" | "options";

/**
 * Reflect an applied (or reverted) value on the local Monitor row.
 *
 * One mapping for both directions, so a new target cannot be handled on the
 * apply path and silently dropped on the revert path — which would leave the
 * dashboard showing a config Datadog no longer has.
 */
function monitorFieldUpdate(
  field: string,
  value: string,
): Record<string, string> {
  switch (field) {
    case "query":
      return { query: value };
    case "message":
      return { message: value };
    case "options":
      return { options: value };
    default:
      return { priority: value };
  }
}

/**
 * The Datadog PUT body that restores a saved before-state.
 *
 * `options` is stored as JSON text, so it has to be parsed back into an object;
 * sending the string would be rejected. A malformed stored value throws here
 * rather than sending a body that would reset the monitor's options to their
 * defaults — a failed revert is recoverable, a silently emptied options object
 * is not.
 */
function revertPutBody(field: string, value: string): Record<string, unknown> {
  switch (field) {
    case "query":
      return { query: value };
    case "message":
      return { message: value };
    case "options": {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("stored options are not an object");
      }
      return { options: parsed };
    }
    default:
      return { priority: Number(value) };
  }
}

export interface ApplyResult {
  ok: boolean;
  dryRun?: boolean;
  noop?: boolean;
  message?: string;
}

function branchFor(patch: ProposedPatch, scope: string): PatchBranch | undefined {
  if (scope === TargetScope.Dev) return patch.dev ?? patch.prod;
  return patch.prod ?? patch.dev;
}

function applyTransform(current: string, branch: PatchBranch): string {
  return current.split(branch.find).join(branch.replace);
}

/** Stable, readable JSON so the preview diff is comparable line by line. */
function stableOptionsJson(options: Record<string, unknown>): string {
  const sorted = Object.keys(options)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = options[k];
      return acc;
    }, {});
  return JSON.stringify(sorted, null, 2);
}

function parseOptions(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Merge an options patch into the monitor's current options.
 *
 * Datadog's monitor PUT replaces the whole options object, so sending only the
 * changed key would silently reset every other option to its default —
 * including the thresholds. The merge is the safe form, and it is why
 * Monitor.options has to be populated before an options patch can be applied.
 */
function mergeOptions(
  current: Record<string, unknown>,
  sets: PatchOption[],
): Record<string, unknown> {
  const next = { ...current };
  for (const { key, value } of sets) next[key] = value;
  return next;
}

/**
 * Compute the before -> after for a recommendation + scope, without writing.
 * Used by the preview modal so the client always shows the authoritative diff.
 */
export async function previewApplyAction(
  recommendationId: string,
  scope: string,
): Promise<{
  ok: boolean;
  field?: string;
  before?: string;
  after?: string;
  changed?: boolean;
  message?: string;
}> {
  const rec = await prisma.tuningRecommendation.findUnique({
    where: { id: recommendationId },
    include: { monitor: true },
  });
  if (!rec?.patchJson || !rec.monitor) {
    return { ok: false, message: "No applyable change for this recommendation." };
  }
  const patch = parseStoredPatch(rec.patchJson);
  if (!patch) {
    return { ok: false, message: "The stored change is malformed and was not applied." };
  }
  const branch = branchFor(patch, scope);
  if (!branch && patch.target !== "priority" && patch.target !== "options") {
    return { ok: false, message: "No change defined for this scope." };
  }

  if (patch.target === "priority") {
    const before = rec.monitor.priority;
    const after = String(patch.priorityValue ?? "");
    return { ok: true, field: "priority", before, after, changed: before !== after };
  }

  if (patch.target === "options") {
    const sets = patch.options ?? [];
    if (sets.length === 0) {
      return { ok: false, message: "No options defined for this change." };
    }
    // Without a live read of the current options there is no before-state to
    // merge into, and a PUT would reset every option Datadog is not told about.
    if (!rec.monitor.options) {
      return {
        ok: false,
        message:
          "Monitor options are not stored yet — run an analysis to read them from Datadog first.",
      };
    }
    const current = parseOptions(rec.monitor.options);
    const before = stableOptionsJson(current);
    const after = stableOptionsJson(mergeOptions(current, sets));
    return { ok: true, field: "options", before, after, changed: after !== before };
  }

  const current =
    (patch.target === "query" ? rec.monitor.query : rec.monitor.message) ?? "";
  const after = applyTransform(current, branch as PatchBranch);
  return {
    ok: true,
    field: patch.target,
    before: current,
    after,
    changed: after !== current,
  };
}

/**
 * The one guarded write: apply a recommendation to a Datadog monitor.
 *  - Real write when APPLY_ENABLED + DD_APP_KEY_WRITE are set.
 *  - Demo dry-run (no Datadog call) when in DEMO_MODE, so the apply -> validated
 *    feedback flow is demonstrable locally.
 *  - Blocked otherwise.
 * Records an AppliedChange audit row (before/after/operator/target) either way,
 * with `dryRun` telling the two apart. The status stays `applied` for a dry run
 * on purpose — the feedback loop keys off it — so the flag is the only thing
 * separating "changed in Datadog" from "changed nowhere", and DEMO_MODE
 * defaults to true.
 */
export async function applyRecommendationAction(
  recommendationId: string,
  scope: string,
): Promise<ApplyResult> {
  const cfg = getConfig();
  const target = scope === TargetScope.Dev ? TargetScope.Dev : TargetScope.Prod;

  const rec = await prisma.tuningRecommendation.findUnique({
    where: { id: recommendationId },
    include: { monitor: true },
  });
  if (!rec?.patchJson || !rec.monitor) {
    return { ok: false, message: "No applyable change for this recommendation." };
  }

  const real = canApply(cfg);
  if (!real && !cfg.demoMode) {
    return {
      ok: false,
      message:
        "Apply is disabled. Set APPLY_ENABLED=true and DD_APP_KEY_WRITE to enable real writes.",
    };
  }

  const patch = parseStoredPatch(rec.patchJson);
  if (!patch) {
    return { ok: false, message: "The stored change is malformed and was not applied." };
  }
  const monitor = rec.monitor;

  // Compute before/after + the Datadog PUT body.
  let field: "message" | "query" | "priority" | "options" = patch.target;
  let before: string;
  let after: string;
  let putBody: Record<string, unknown>;

  if (patch.target === "priority") {
    before = monitor.priority;
    after = String(patch.priorityValue ?? "");
    putBody = { priority: patch.priorityValue };
  } else if (patch.target === "options") {
    const sets = patch.options ?? [];
    if (sets.length === 0) {
      return { ok: false, message: "No options defined for this change." };
    }
    if (!monitor.options) {
      return {
        ok: false,
        message:
          "Monitor options are not stored yet — run an analysis to read them from Datadog first.",
      };
    }
    const current = parseOptions(monitor.options);
    const merged = mergeOptions(current, sets);
    before = stableOptionsJson(current);
    after = stableOptionsJson(merged);
    // Same drift guard as the text targets: if the live options already carry
    // these values, the change has been applied or superseded.
    if (after === before) {
      return {
        ok: false,
        noop: true,
        message:
          "No-op: the monitor options already carry these values (already applied or drifted).",
      };
    }
    // The whole merged object, never the changed key alone — Datadog replaces
    // the options it is sent and defaults the rest.
    putBody = { options: merged };
  } else {
    const branch = branchFor(patch, target);
    if (!branch) return { ok: false, message: "No change defined for this scope." };
    const current = (patch.target === "query" ? monitor.query : monitor.message) ?? "";
    before = current;
    after = applyTransform(current, branch);
    // Idempotency / drift guard.
    if (after === current) {
      return {
        ok: false,
        noop: true,
        message:
          "No-op: the monitor no longer matches the recorded 'before' (already applied or drifted).",
      };
    }
    putBody = patch.target === "query" ? { query: after } : { message: after };
  }

  let datadogResponse = "(demo dry-run — no Datadog write)";
  let status: string = AppliedChangeStatus.Applied;

  if (real) {
    try {
      const dd = new DatadogClient(cfg);
      const res = await dd.updateMonitor(monitor.id, putBody);
      datadogResponse = `Datadog updated monitor ${res.id}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.appliedChange.create({
        data: {
          monitorId: monitor.id,
          recommendationId: rec.id,
          targetScope: target,
          changeSummary: rec.changeSummary,
          beforeJson: JSON.stringify({ field, value: before }),
          afterJson: JSON.stringify({ field, value: after }),
          diffJson: JSON.stringify({ field, before, after }),
          operator: cfg.apply.operator,
          status: AppliedChangeStatus.Failed,
          error: message,
        },
      });
      return { ok: false, message: `Datadog write failed: ${message}` };
    }
  }

  // Record audit + reflect the new config in the DB so the feedback loop sees it.
  await prisma.appliedChange.create({
    data: {
      monitorId: monitor.id,
      recommendationId: rec.id,
      targetScope: target,
      changeSummary: rec.changeSummary,
      beforeJson: JSON.stringify({ field, value: before }),
      afterJson: JSON.stringify({ field, value: after }),
      diffJson: JSON.stringify({ field, before, after }),
      operator: cfg.apply.operator,
      status,
      dryRun: !real,
      datadogResponse,
    },
  });

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: monitorFieldUpdate(field, after),
  });

  await prisma.tuningRecommendation.update({
    where: { id: rec.id },
    data: { status: RecommendationStatus.Applied, lastUpdated: new Date() },
  });

  revalidatePath("/recommendations");
  revalidatePath(`/monitors/${monitor.id}`);
  revalidatePath("/", "layout");

  return {
    ok: true,
    dryRun: !real,
    message: real
      ? `Applied to monitor ${monitor.id} (${target}).`
      : `Demo dry-run applied (${target}) — no Datadog write. Sync to see it validate.`,
  };
}

/** Revert a previously applied change (restores the saved before-state). */
export async function revertAppliedChangeAction(
  appliedChangeId: string,
): Promise<ApplyResult> {
  const cfg = getConfig();
  const change = await prisma.appliedChange.findUnique({
    where: { id: appliedChangeId },
    include: { monitor: true },
  });
  if (!change || !change.monitor) {
    return { ok: false, message: "Applied change not found." };
  }
  if (change.status !== AppliedChangeStatus.Applied) {
    return { ok: false, message: "Only an applied change can be reverted." };
  }

  const beforeParsed = JSON.parse(change.beforeJson) as {
    field: string;
    value: string;
  };
  const real = canApply(cfg);

  let datadogResponse = "(demo dry-run — no Datadog write)";
  if (real) {
    try {
      const dd = new DatadogClient(cfg);
      const putBody = revertPutBody(beforeParsed.field, beforeParsed.value);
      const res = await dd.updateMonitor(change.monitor.id, putBody);
      datadogResponse = `Datadog reverted monitor ${res.id}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The apply path records a Failed row; this one used to return without
      // one, so a revert that failed left no trace at all. An operator then
      // cannot tell "nobody tried to revert" from "the revert was attempted
      // and Datadog refused", which are different situations to walk into.
      await prisma.appliedChange.create({
        data: {
          monitorId: change.monitor.id,
          recommendationId: change.recommendationId,
          targetScope: change.targetScope,
          changeSummary: `Revert failed: ${change.changeSummary}`,
          beforeJson: change.afterJson,
          afterJson: change.beforeJson,
          operator: cfg.apply.operator,
          status: AppliedChangeStatus.Failed,
          error: message,
          revertsId: change.id,
        },
      });
      return { ok: false, message: `Revert failed: ${message}` };
    }
  }

  await prisma.appliedChange.update({
    where: { id: change.id },
    data: { status: AppliedChangeStatus.Reverted, revertedAt: new Date() },
  });
  await prisma.appliedChange.create({
    data: {
      monitorId: change.monitor.id,
      recommendationId: change.recommendationId,
      targetScope: change.targetScope,
      changeSummary: `Revert: ${change.changeSummary}`,
      beforeJson: change.afterJson,
      afterJson: change.beforeJson,
      operator: cfg.apply.operator,
      status: AppliedChangeStatus.Reverted,
      dryRun: !real,
      datadogResponse,
      revertsId: change.id,
    },
  });

  await prisma.monitor.update({
    where: { id: change.monitor.id },
    data: monitorFieldUpdate(beforeParsed.field, beforeParsed.value),
  });

  if (change.recommendationId) {
    await prisma.tuningRecommendation.update({
      where: { id: change.recommendationId },
      data: { status: RecommendationStatus.Recommend, lastUpdated: new Date() },
    });
  }

  revalidatePath("/recommendations");
  revalidatePath(`/monitors/${change.monitor.id}`);
  revalidatePath("/", "layout");

  return {
    ok: true,
    dryRun: !real,
    message: real ? "Reverted." : "Demo dry-run revert — no Datadog write.",
  };
}
