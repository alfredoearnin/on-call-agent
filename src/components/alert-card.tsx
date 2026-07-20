import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { priorityTone, fmtDateTime, fmtDate, splitFinding } from "@/lib/format";
import { FiringKind } from "@/lib/constants";

interface AlertLike {
  id: string;
  monitorId: string | null;
  title: string;
  priority: string;
  status: string;
  firingKind: string | null;
  firedAt: Date;
  resolvedAt: Date | null;
  ackedBy: string | null;
  escalationStatus: string | null;
  env: string | null;
  cluster: string | null;
  finding: string | null;
  monitor?: { name: string; service: string | null; datadogUrl: string | null } | null;
}

export function AlertCard({ alert, tz }: { alert: AlertLike; tz: string }) {
  const isStale = alert.firingKind === FiringKind.Stale;
  const { tldr, detail } = splitFinding(alert.finding);
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{alert.title}</span>
        <div className="flex items-center gap-1.5">
          <Badge tone={priorityTone(alert.priority)}>{alert.priority}</Badge>
          {isStale && <Badge tone="warn">stale</Badge>}
          {alert.status === "firing" && !isStale && (
            <Badge tone="alert">firing</Badge>
          )}
          {alert.status === "resolved" && <Badge tone="ok">resolved</Badge>}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {alert.monitor?.service && <span>svc: {alert.monitor.service}</span>}
        {alert.env && <span>env: {alert.env}</span>}
        {alert.cluster && <span>cluster: {alert.cluster}</span>}
        {isStale ? (
          <span>firing since {fmtDate(alert.firedAt, tz)} (not fired this week)</span>
        ) : (
          <span>fired: {fmtDateTime(alert.firedAt, tz)}</span>
        )}
        {alert.resolvedAt && !isStale && (
          <span>resolved: {fmtDateTime(alert.resolvedAt, tz)}</span>
        )}
        {alert.ackedBy && <span>acked by: {alert.ackedBy}</span>}
      </div>

      {(tldr || detail) && (
        <div className="mt-2 space-y-1">
          {tldr && (
            <p className="text-xs leading-relaxed text-foreground">
              <span className="font-semibold text-muted-foreground">
                TL;DR:{" "}
              </span>
              {tldr}
            </p>
          )}
          {detail && (
            <details className="group text-xs">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-primary hover:underline [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show what happened ▸</span>
                <span className="hidden group-open:inline">Hide details ▾</span>
              </summary>
              <p className="mt-1 leading-relaxed text-foreground/80">{detail}</p>
            </details>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-3 text-xs">
        {alert.monitorId && (
          <Link
            href={`/monitors/${alert.monitorId}`}
            className="text-primary hover:underline"
          >
            Monitor {alert.monitorId} →
          </Link>
        )}
        {alert.monitor?.datadogUrl && (
          <a
            href={alert.monitor.datadogUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:underline"
          >
            Open in Datadog ↗
          </a>
        )}
      </div>
    </div>
  );
}
