"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { MonitorEditSource } from "@/lib/constants";
import { recordMonitorEditNoteAction } from "@/lib/edit-note-actions";
import type { MonitorEdit } from "@/lib/monitor-edits";

export function MonitorEditCard({
  edit,
  tz,
  showMonitorLink = true,
}: {
  edit: MonitorEdit;
  tz: string;
  showMonitorLink?: boolean;
}) {
  const fromDashboard = edit.source === MonitorEditSource.DashboardApply;
  const actorUnknown = !edit.actorName && !fromDashboard;

  return (
    <article className="space-y-3 rounded-md border border-border p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {showMonitorLink ? (
            <Link
              href={`/monitors/${edit.monitorId}`}
              className="text-sm font-semibold hover:underline"
            >
              {edit.monitorName}
            </Link>
          ) : (
            <div className="text-sm font-semibold">{edit.monitorName}</div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            Monitor {edit.monitorId}
            {edit.datadogUrl ? (
              <>
                {" · "}
                <a
                  href={edit.datadogUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Datadog ↗
                </a>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={fromDashboard ? "info" : "warn"} className="normal-case">
            {fromDashboard ? "Dashboard apply" : "Datadog (detected)"}
          </Badge>
          {edit.why?.source === "recommendation" ? (
            <Badge tone="ok">Matches recommendation</Badge>
          ) : null}
        </div>
      </header>

      <div className="text-xs text-muted-foreground">
        Detected {fmtDateTime(edit.detectedAt, tz)}
        {edit.actorName ? (
          <>
            {" · "}Edited by {edit.actorName}
            {edit.actorAt ? ` at ${fmtDateTime(edit.actorAt, tz)}` : ""}
          </>
        ) : actorUnknown ? (
          <> · Edited by Unknown (audit not available)</>
        ) : null}
      </div>

      {edit.diffs.map((d) => (
        <div key={d.field} className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Before · {d.field}
            </div>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-[11px]">
              {d.before || "(empty)"}
            </pre>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              After · {d.field}
            </div>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-[11px]">
              {d.after || "(empty)"}
            </pre>
          </div>
        </div>
      ))}

      <WhyBlock edit={edit} tz={tz} />
    </article>
  );
}

function WhyBlock({ edit, tz }: { edit: MonitorEdit; tz: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    setMessage(null);
    const res = await recordMonitorEditNoteAction(edit.monitorId, edit.afterHash, note);
    setPending(false);
    setMessage(res.message);
    if (res.ok) setOpen(false);
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Why
      </div>
      {edit.why ? (
        <div className="mt-1 space-y-1 text-sm">
          <div className="font-medium">{edit.why.title}</div>
          {edit.why.summary === edit.why.title ? null : (
            <p className="text-muted-foreground">{edit.why.summary}</p>
          )}
          {edit.why.coverage ? (
            <p className="text-xs text-muted-foreground">Coverage: {edit.why.coverage}</p>
          ) : null}
          {edit.why.expectedImpact ? (
            <p className="text-xs text-muted-foreground">
              Expected: {edit.why.expectedImpact}
            </p>
          ) : null}
        </div>
      ) : null}

      {edit.note ? (
        <div className={edit.why ? "mt-3 border-t border-border/60 pt-2" : "mt-1"}>
          <div className="text-xs text-muted-foreground">
            Note from {edit.note.operator} · {fmtDateTime(edit.note.at, tz)}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{edit.note.text}</p>
        </div>
      ) : null}

      {!edit.why && !edit.note ? (
        <p className="mt-1 text-sm text-muted-foreground">No explanation yet.</p>
      ) : null}

      {edit.source === MonitorEditSource.DatadogDetected && (
        <div className="mt-2">
          {open ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
                placeholder="Why was this monitor changed?"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={onSave}>
                  Save explanation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
              {edit.note ? "Replace explanation" : "Add explanation"}
            </Button>
          )}
          {message ? (
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
