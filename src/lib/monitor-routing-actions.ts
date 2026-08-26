"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig, canApply } from "@/lib/config";
import { DatadogClient } from "@/lib/clients/datadog";
import { AppliedChangeStatus, TargetScope } from "@/lib/constants";
import {
  extractHandles,
  isTeamMonitor,
  isValidHandle,
  isValidMonitorId,
  isValidPriority,
  rerouteMessage,
} from "@/lib/monitor-routing";

/** One field per change, so the audit row stays revertable by the existing path. */
export type RoutingChange =
  | { kind: "reroute"; fromHandle: string; toHandle: string }
  | { kind: "priority"; to: number };

export type RoutingMode = "real" | "demo" | "blocked";

export interface RoutingPreview {
  ok: boolean;
  mode: RoutingMode;
  /** Handles found in the live monitor message, for the operator to pick from. */
  handles?: string[];
  field?: "message" | "priority";
  before?: string;
  after?: string;
  changed?: boolean;
  /** Live monitor name, so the modal names what it is about to edit. */
  monitorName?: string;
  message?: string;
}

function modeFor(): RoutingMode {
  const cfg = getConfig();
  if (canApply(cfg)) return "real";
  if (cfg.demoMode) return "demo";
  return "blocked";
}

/**
 * Read the live monitor and compute the exact before/after for a routing change.
 *
 * Always reads from Datadog rather than the local row: in Confluence mode
 * `Monitor.message` is empty (the weekly report carries titles, not bodies), and
 * a diff computed against an empty string would present "add a handle" when the
 * truth is "replace the four already there". No preview, no write.
 */
export async function previewMonitorRoutingAction(
  monitorId: string,
  change: RoutingChange | null,
): Promise<RoutingPreview> {
  const cfg = getConfig();
  const mode = modeFor();

  if (!isValidMonitorId(monitorId)) {
    return { ok: false, mode, message: "That is not a Datadog monitor id." };
  }

  let live;
  try {
    live = await new DatadogClient(cfg).getMonitor(monitorId);
  } catch (err) {
    return {
      ok: false,
      mode,
      message: `Could not read monitor ${monitorId} from Datadog: ${
        err instanceof Error ? err.message : String(err)
      }. A routing change is never written without reading the current value first.`,
    };
  }

  if (!isTeamMonitor(live.tags, cfg.team.tag)) {
    return {
      ok: false,
      mode,
      message: `Monitor ${monitorId} is not tagged ${cfg.team.tag}, so it belongs to another team. Rerouting it from here would move a pager we do not own.`,
    };
  }

  const currentMessage = live.message ?? "";
  const handles = extractHandles(currentMessage);

  if (!change) {
    return { ok: true, mode, handles, monitorName: live.name };
  }

  if (change.kind === "priority") {
    if (!isValidPriority(change.to)) {
      return { ok: false, mode, handles, message: "Priority must be 1–5." };
    }
    const before = live.priority == null ? "none" : String(live.priority);
    const after = String(change.to);
    return {
      ok: true,
      mode,
      handles,
      monitorName: live.name,
      field: "priority",
      before,
      after,
      changed: before !== after,
    };
  }

  if (!isValidHandle(change.toHandle)) {
    return {
      ok: false,
      mode,
      handles,
      monitorName: live.name,
      message:
        "That is not a valid Datadog handle. Use @slack-channel, @team-name, or @user@domain.",
    };
  }
  if (!handles.includes(change.fromHandle)) {
    return {
      ok: false,
      mode,
      handles,
      monitorName: live.name,
      message: `${change.fromHandle} is not in this monitor's message any more — it may already have been rerouted.`,
    };
  }

  const { message: after, replaced } = rerouteMessage(
    currentMessage,
    change.fromHandle,
    change.toHandle,
  );

  return {
    ok: true,
    mode,
    handles,
    monitorName: live.name,
    field: "message",
    before: currentMessage,
    after,
    changed: replaced > 0,
  };
}

export interface RoutingResult {
  ok: boolean;
  dryRun?: boolean;
  message: string;
}

/**
 * The guarded write. Re-derives the diff from the live monitor rather than
 * trusting anything the client computed, so a preview the operator saw minutes
 * ago cannot be replayed against a monitor that has since changed.
 *
 * Records an AppliedChange in the same `{field, value}` shape the apply path
 * uses, which makes these reroutes revertable through the existing Revert
 * button instead of needing a second rollback path.
 */
export async function applyMonitorRoutingAction(
  monitorId: string,
  change: RoutingChange,
): Promise<RoutingResult> {
  const cfg = getConfig();
  const mode = modeFor();

  // Also checked in the preview this delegates to, but the id reaches a
  // credentialed PUT from here — the guard belongs at every entry point.
  if (!isValidMonitorId(monitorId)) {
    return { ok: false, message: "That is not a Datadog monitor id." };
  }

  if (mode === "blocked") {
    return {
      ok: false,
      message:
        "Writes are disabled. Set APPLY_ENABLED=true and DD_APP_KEY_WRITE to move a monitor.",
    };
  }

  const preview = await previewMonitorRoutingAction(monitorId, change);
  if (!preview.ok || !preview.field) {
    return { ok: false, message: preview.message ?? "Could not build the change." };
  }
  if (!preview.changed) {
    return {
      ok: false,
      message: "No-op: the monitor already reads that way.",
    };
  }

  const field = preview.field;
  const before = preview.before ?? "";
  const after = preview.after ?? "";
  const summary =
    change.kind === "reroute"
      ? `Reroute ${change.fromHandle} → ${change.toHandle}`
      : `Set priority to P${change.to}`;

  let datadogResponse = "(demo dry-run — no Datadog write)";

  if (mode === "real") {
    try {
      const dd = new DatadogClient(cfg);
      const res = await dd.updateMonitor(
        monitorId,
        field === "message" ? { message: after } : { priority: Number(after) },
      );
      datadogResponse = `Datadog updated monitor ${res.id}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordAudit({
        monitorId,
        summary,
        field,
        before,
        after,
        operator: cfg.apply.operator,
        status: AppliedChangeStatus.Failed,
        error: message,
      });
      return { ok: false, message: `Datadog write failed: ${message}` };
    }
  }

  await recordAudit({
    monitorId,
    summary,
    field,
    before,
    after,
    operator: cfg.apply.operator,
    status: AppliedChangeStatus.Applied,
    datadogResponse,
  });

  // Keep the local row in step so the page reflects the write immediately.
  await prisma.monitor
    .update({
      where: { id: monitorId },
      data: field === "message" ? { message: after } : { priority: after },
    })
    .catch(() => undefined);

  revalidatePath("/services");
  revalidatePath(`/monitors/${monitorId}`);
  revalidatePath("/", "layout");

  return {
    ok: true,
    dryRun: mode !== "real",
    message:
      mode === "real"
        ? `${summary} — written to monitor ${monitorId}.`
        : `${summary} — demo dry-run, no Datadog write.`,
  };
}

async function recordAudit(input: {
  monitorId: string;
  summary: string;
  field: "message" | "priority";
  before: string;
  after: string;
  operator: string;
  status: string;
  datadogResponse?: string;
  error?: string;
}) {
  const { field, before, after } = input;
  // A monitor seen only in the weekly Confluence report has no local row; the
  // audit still has to land, so the FK is left null in that case.
  const known = await prisma.monitor.findUnique({
    where: { id: input.monitorId },
    select: { id: true },
  });

  await prisma.appliedChange.create({
    data: {
      monitorId: known ? input.monitorId : null,
      targetScope: TargetScope.Prod,
      changeSummary: known
        ? input.summary
        : `${input.summary} (monitor ${input.monitorId})`,
      beforeJson: JSON.stringify({ field, value: before }),
      afterJson: JSON.stringify({ field, value: after }),
      diffJson: JSON.stringify({ field, before, after }),
      operator: input.operator,
      status: input.status,
      datadogResponse: input.datadogResponse,
      error: input.error,
    },
  });
}
