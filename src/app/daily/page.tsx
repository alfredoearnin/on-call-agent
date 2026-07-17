import { getConfig } from "@/lib/config";
import { getDailyData, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCard } from "@/components/alert-card";
import { DayPicker } from "@/components/day-picker";
import { Badge } from "@/components/ui/badge";
import { IncidentClass } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayParam } = await searchParams;
  const cfg = getConfig();
  const [settings, data] = await Promise.all([
    getSyncSettings(),
    getDailyData(dayParam),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  const prodIncidents = data.incidents.filter(
    (i) => i.classification === IncidentClass.ProductionCustomerImpact,
  );
  const opsIncidents = data.incidents.filter(
    (i) => i.classification === IncidentClass.Operational,
  );

  const totalAlerts =
    data.requiredHumanAttention.length +
    data.autoResolved.length +
    data.other.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Daily incidents & alerts</h1>
          <p className="text-sm text-muted-foreground">
            {totalAlerts} alert(s) · {data.incidents.length} incident(s) on {data.day}
          </p>
        </div>
        <DayPicker days={data.days} selected={data.day} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Production incidents — customer impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {prodIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No production incidents this day.
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
                No operational incidents this day.
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

      <Section
        title="Required human attention"
        subtitle="Acknowledged by on-call"
        alerts={data.requiredHumanAttention}
        tz={tz}
        empty="No alerts required human attention this day."
      />
      <Section
        title="Auto-resolved"
        subtitle="Escalation cancelled / no human ack"
        alerts={data.autoResolved}
        tz={tz}
        empty="No alerts auto-resolved this day."
      />
      {data.other.length > 0 && (
        <Section
          title="Other alerts (firing / carryover)"
          subtitle="Still firing or unclassified"
          alerts={data.other}
          tz={tz}
          empty=""
        />
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
