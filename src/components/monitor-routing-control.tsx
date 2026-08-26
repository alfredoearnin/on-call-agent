"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  applyMonitorRoutingAction,
  previewMonitorRoutingAction,
  type RoutingChange,
  type RoutingPreview,
} from "@/lib/monitor-routing-actions";
import { PRIORITY_LABELS, isValidHandle } from "@/lib/monitor-routing";
import type { ServiceMonitorRef } from "@/lib/queries";

/**
 * "Move the pager" — the one remediation the dashboard can actually execute for
 * a service we decided to give away. Cortex stays manual; this changes who
 * Datadog wakes up.
 *
 * Every path is read-before-write: opening the modal fetches the live monitor,
 * the diff is computed on the server, and Confirm re-derives it. Nothing is
 * written from a stale preview.
 */
export function MonitorRoutingControl({
  monitors,
  targetTeam,
}: {
  monitors: ServiceMonitorRef[];
  /** The receiving team, used only to word the prompt. */
  targetTeam?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [monitorId, setMonitorId] = useState(monitors[0]?.id ?? "");
  const [kind, setKind] = useState<"reroute" | "priority">("reroute");
  const [fromHandle, setFromHandle] = useState("");
  const [toHandle, setToHandle] = useState("");
  const [priority, setPriority] = useState(4);
  const [preview, setPreview] = useState<RoutingPreview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (monitors.length === 0) return null;

  const change: RoutingChange | null =
    kind === "priority"
      ? { kind: "priority", to: priority }
      : fromHandle && toHandle
        ? { kind: "reroute", fromHandle, toHandle }
        : null;

  function load(id: string, next: RoutingChange | null) {
    startTransition(async () => {
      const p = await previewMonitorRoutingAction(id, next);
      setPreview(p);
      if (p.handles && p.handles.length > 0 && !fromHandle) {
        setFromHandle(p.handles[0]);
      }
    });
  }

  function openModal() {
    setMsg(null);
    setPreview(null);
    setOpen(true);
    load(monitorId, null);
  }

  function confirm() {
    if (!change) return;
    startTransition(async () => {
      const res = await applyMonitorRoutingAction(monitorId, change);
      setMsg(res.message);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  const blocked = preview?.mode === "blocked";
  const handleInvalid = Boolean(toHandle) && !isValidHandle(toHandle);

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        <Radio className="h-3 w-3" />
        Move the pager
      </button>

      {msg && <p className="mt-1 text-[11px] text-muted-foreground">{msg}</p>}

      <ConfirmDialog
        open={open}
        title={`Change who this monitor pages${targetTeam ? ` — handing to ${targetTeam}` : ""}`}
        blast="external"
        confirmLabel={
          preview?.mode === "demo" ? "Confirm (dry-run)" : "Write to Datadog"
        }
        confirmDisabled={
          blocked || !preview?.ok || !preview?.changed || handleInvalid
        }
        busy={isPending}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <div className="rounded-md border border-warn/40 bg-warn/5 p-3 text-xs">
          <p className="font-medium text-warn">
            This edits a live Datadog monitor.
          </p>
          <p className="mt-1 text-muted-foreground">
            It changes who gets woken up. The team you hand it to should know
            before you do this, otherwise the alert goes to a channel nobody is
            watching. Revertable from the monitor page afterwards.
          </p>
        </div>

        <label className="block text-xs">
          <span className="text-muted-foreground">Monitor</span>
          <select
            value={monitorId}
            onChange={(e) => {
              setMonitorId(e.target.value);
              setFromHandle("");
              load(e.target.value, null);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:border-ring"
          >
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} — {m.name.slice(0, 70)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-4 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={kind === "reroute"}
              onChange={() => {
                setKind("reroute");
                setPreview((p) => (p ? { ...p, changed: false } : p));
              }}
            />
            Reroute a handle
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              checked={kind === "priority"}
              onChange={() => {
                setKind("priority");
                load(monitorId, { kind: "priority", to: priority });
              }}
            />
            Change priority
          </label>
        </div>

        {kind === "reroute" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted-foreground">Replace this handle</span>
              <select
                value={fromHandle}
                onChange={(e) => setFromHandle(e.target.value)}
                disabled={!preview?.handles?.length}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:border-ring"
              >
                {(preview?.handles ?? []).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                {preview?.handles?.length === 0 && (
                  <option value="">no handles in this monitor</option>
                )}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">With</span>
              <input
                value={toHandle}
                onChange={(e) => setToHandle(e.target.value.trim())}
                placeholder="@slack-cashout-alerts"
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:border-ring"
              />
            </label>
          </div>
        ) : (
          <label className="block text-xs">
            <span className="text-muted-foreground">New priority</span>
            <select
              value={priority}
              onChange={(e) => {
                const to = Number(e.target.value);
                setPriority(to);
                load(monitorId, { kind: "priority", to });
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 outline-none focus:border-ring"
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        {handleInvalid && (
          <p className="text-xs text-alert">
            Not a valid Datadog handle. Use @slack-channel, @team-name, or
            @user@domain.
          </p>
        )}

        {kind === "reroute" && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!change || isPending || handleInvalid}
            onClick={() => load(monitorId, change)}
          >
            Preview the change
          </Button>
        )}

        {preview?.message && (
          <p className="text-xs text-alert">{preview.message}</p>
        )}

        {blocked && (
          <p className="text-xs text-warn">
            Writes are disabled here. Set APPLY_ENABLED=true and DD_APP_KEY_WRITE
            to move a monitor.
          </p>
        )}

        {preview?.mode === "demo" && (
          <p className="text-xs text-warn">
            Demo mode: this records the change and its audit row locally, without
            touching Datadog.
          </p>
        )}

        {preview?.before !== undefined && (
          <div className="space-y-2">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Before {preview.monitorName ? `— ${preview.monitorName}` : ""}
              </div>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs text-alert/90">
                {preview.before || "(empty)"}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                After
              </div>
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs text-ok">
                {preview.after || "(empty)"}
              </pre>
            </div>
            {!preview.changed && (
              <p className="text-xs text-muted-foreground">
                Nothing would change — pick a different handle or value.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
