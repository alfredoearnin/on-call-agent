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
import type { ProposedPatch, PatchBranch } from "@/lib/ingest/types";

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
  const patch = JSON.parse(rec.patchJson) as ProposedPatch;
  const branch = branchFor(patch, scope);
  if (!branch && patch.target !== "priority") {
    return { ok: false, message: "No change defined for this scope." };
  }

  if (patch.target === "priority") {
    const before = rec.monitor.priority;
    const after = String(patch.priorityValue ?? "");
    return { ok: true, field: "priority", before, after, changed: before !== after };
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
 * Records an AppliedChange audit row (before/after/operator/target) either way.
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

  const patch = JSON.parse(rec.patchJson) as ProposedPatch;
  const monitor = rec.monitor;

  // Compute before/after + the Datadog PUT body.
  let field: "message" | "query" | "priority" = patch.target;
  let before: string;
  let after: string;
  let putBody: Record<string, unknown>;

  if (patch.target === "priority") {
    before = monitor.priority;
    after = String(patch.priorityValue ?? "");
    putBody = { priority: patch.priorityValue };
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
      datadogResponse,
    },
  });

  await prisma.monitor.update({
    where: { id: monitor.id },
    data:
      field === "query"
        ? { query: after }
        : field === "message"
          ? { message: after }
          : { priority: after },
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
      const putBody =
        beforeParsed.field === "query"
          ? { query: beforeParsed.value }
          : beforeParsed.field === "message"
            ? { message: beforeParsed.value }
            : { priority: Number(beforeParsed.value) };
      const res = await dd.updateMonitor(change.monitor.id, putBody);
      datadogResponse = `Datadog reverted monitor ${res.id}`;
    } catch (err) {
      return {
        ok: false,
        message: `Revert failed: ${err instanceof Error ? err.message : String(err)}`,
      };
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
      datadogResponse,
      revertsId: change.id,
    },
  });

  await prisma.monitor.update({
    where: { id: change.monitor.id },
    data:
      beforeParsed.field === "query"
        ? { query: beforeParsed.value }
        : beforeParsed.field === "message"
          ? { message: beforeParsed.value }
          : { priority: beforeParsed.value },
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
