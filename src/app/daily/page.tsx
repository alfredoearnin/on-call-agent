import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getDailyView, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCard } from "@/components/alert-card";
import { AlertTimeline } from "@/components/alert-timeline";
import { DayPicker } from "@/components/day-picker";
import { Badge } from "@/components/ui/badge";
import { IncidentClass } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string; view?: string }>;
}) {
  const { week: weekParam, day: dayParam, view: viewParam } = await searchParams;
  const cfg = getConfig();
  const [settings, data] = await Promise.all([
    getSyncSettings(),
    getDailyView(weekParam, dayParam),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  const prodIncidents = data.incidents.filter(
    (i) => i.classification === IncidentClass.ProductionCustomerImpact,
  );
  const opsIncidents = data.incidents.filter(
    (i) => i.classification === IncidentClass.Operational,
  );

  const shownAlerts =
    data.requiredHumanAttention.length + data.autoResolved.length;
  const isAllWeek = data.selectedDay === "all";
  const weekLabel =
    data.weeks.find((w) => w.start === data.selectedWeek)?.label ??
    data.selectedWeek;
  const scope = isAllWeek ? "week" : "day";
  const view = viewParam === "timeline" ? "timeline" : "list";
  const timelineAlerts = [...data.requiredHumanAttention, ...data.autoResolved];

  const tabHref = (v: string) => {
    const p = new URLSearchParams({ week: data.selectedWeek, day: data.selectedDay });
    if (v !== "list") p.set("view", v);
    return `/daily?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {isAllWeek ? "Weekly incidents & alerts" : "Daily incidents & alerts"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {shownAlerts} alert(s) · {data.incidents.length} incident(s){" "}
            {isAllWeek ? `· week ${weekLabel}` : `on ${data.selectedDay}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-input p-0.5 text-xs">
            <Link
              href={tabHref("list")}
              className={cn(
                "rounded px-2.5 py-1",
                view === "list"
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              List
            </Link>
            <Link
              href={tabHref("timeline")}
              className={cn(
                "rounded px-2.5 py-1",
                view === "timeline"
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Timeline
            </Link>
          </div>
          <DayPicker
            weeks={data.weeks}
            selectedWeek={data.selectedWeek}
            selectedDay={data.selectedDay}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Production incidents — customer impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prodIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No production incidents this {scope}.
              </p>
            ) : (
              prodIncidents.map((i) => (
                <div key={i.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i.title}</span>
                    <Badge tone="alert">{i.severity ?? "incident"}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    opened {fmtDateTime(i.openedAt, tz)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational incidents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {opsIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No operational incidents this {scope}.
              </p>
            ) : (
              opsIncidents.map((i) => (
                <div key={i.id} className="rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{i.title}</span>
                  <div className="mt-1 text-xs text-muted-foreground">
                    opened {fmtDateTime(i.openedAt, tz)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {view === "timeline" ? (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <p className="text-xs text-muted-foreground">
              By day, newest first · amber = human attention, green = auto-resolved
            </p>
          </CardHeader>
          <CardContent>
            <AlertTimeline alerts={timelineAlerts} tz={tz} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Section
            title="Required human attention"
            subtitle="Acknowledged by on-call"
            alerts={data.requiredHumanAttention}
            tz={tz}
            empty={`No alerts required human attention this ${scope}.`}
          />
          <Section
            title="Auto-resolved"
            subtitle="Escalation cancelled / no human ack"
            alerts={data.autoResolved}
            tz={tz}
            empty={`No alerts auto-resolved this ${scope}.`}
          />
        </>
      )}
      {data.other.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.other.length} carryover alert(s) open from prior weeks —{" "}
          <a href="/carryover" className="text-primary hover:underline">
            see Carryover
          </a>
          .
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  alerts,
  tz,
  empty,
}: {
  title: string;
  subtitle: string;
  alerts: Parameters<typeof AlertCard>[0]["alert"][];
  tz: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          alerts.map((a) => <AlertCard key={a.id} alert={a} tz={tz} />)
        )}
      </CardContent>
    </Card>
  );
}
