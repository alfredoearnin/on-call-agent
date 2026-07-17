import { getConfig } from "@/lib/config";
import { getCarryoverAlerts, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCard } from "@/components/alert-card";

export const dynamic = "force-dynamic";

export default async function CarryoverPage() {
  const cfg = getConfig();
  const [settings, alerts] = await Promise.all([
    getSyncSettings(),
    getCarryoverAlerts(),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Carryover</h1>
        <p className="text-sm text-muted-foreground">
          Still-firing incident.io alerts carried over from prior weeks — their
          Datadog source reads OK / No Data, so these are lingering alerts to
          clear, not new fires. {alerts.length} open.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Open incident.io alerts to clear</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No carryover alerts. Clean slate. ✓
            </p>
          ) : (
            alerts.map((a) => <AlertCard key={a.id} alert={a} tz={tz} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
