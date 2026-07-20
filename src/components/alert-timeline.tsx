import Link from "next/link";
import { DateTime } from "luxon";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { priorityTone, fmtTime } from "@/lib/format";
import { AlertDisposition } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TimelineAlert {
  id: string;
  monitorId: string | null;
  title: string;
  priority: string;
  disposition: string | null;
  firedAt: Date;
  env: string | null;
  monitor?: { service: string | null; datadogUrl: string | null } | null;
}

/**
 * Chronological "what happened when" view of the week's alerts, grouped by
 * local day (newest first). Complements the disposition-grouped list.
 */
export function AlertTimeline({
  alerts,
  tz,
}: {
  alerts: TimelineAlert[];
  tz: string;
}) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No alerts fired in this period.
      </p>
    );
  }

  const sorted = [...alerts].sort(
    (a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime(),
  );

  const groups: { key: string; items: TimelineAlert[] }[] = [];
  for (const a of sorted) {
    const key =
      DateTime.fromJSDate(new Date(a.firedAt), { zone: tz }).toISODate() ?? "";
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(a);
    else groups.push({ key, items: [a] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {DateTime.fromISO(g.key, { zone: tz }).toFormat("cccc, LLL d")}
            </h3>
            <span className="text-xs text-muted-foreground">
              {g.items.length} alert{g.items.length === 1 ? "" : "s"}
            </span>
          </div>

          <ol className="relative space-y-4 border-l border-border">
            {g.items.map((a) => {
              const human =
                a.disposition === AlertDisposition.RequiredHumanAttention;
              return (
                <li key={a.id} className="relative ml-6">
                  <span
                    className={cn(
                      "absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full ring-4 ring-card",
                      human ? "bg-warn" : "bg-ok",
                    )}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtTime(a.firedAt, tz)}
                    </span>
                    <Badge tone={priorityTone(a.priority)}>{a.priority}</Badge>
                    <Badge tone={human ? "warn" : "ok"}>
                      {human ? "human attention" : "auto-resolved"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm font-medium">{a.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {a.monitor?.service && <span>svc: {a.monitor.service}</span>}
                    {a.env && <span>env: {a.env}</span>}
                    {a.monitorId && (
                      <Link
                        href={`/monitors/${a.monitorId}`}
                        className="text-primary hover:underline"
                      >
                        Monitor {a.monitorId} →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
