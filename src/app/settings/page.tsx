import { getConfig, canApply } from "@/lib/config";
import { getSyncSettings, getRuns } from "@/lib/queries";
import { ensureSyncSettings } from "@/lib/ingest/run";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/settings-form";
import { SyncNowButton } from "@/components/sync-now-button";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function runTone(status: string): "ok" | "warn" | "alert" | "neutral" {
  if (status === "success") return "ok";
  if (status === "partial") return "warn";
  if (status === "failed") return "alert";
  return "neutral";
}

function sourceTone(status: string): "ok" | "warn" | "alert" | "neutral" {
  if (status === "ok") return "ok";
  if (status === "unavailable") return "alert";
  return "neutral";
}

export default async function SettingsPage() {
  await ensureSyncSettings();
  const cfg = getConfig();
  const [settings, runs] = await Promise.all([getSyncSettings(), getRuns(15)]);
  const tz = settings?.timezone ?? cfg.team.timezone;
  const latest = runs[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Sync control center — choose manual or automatic, run on demand, and
          review history and source health.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daily sync</CardTitle>
          <SyncNowButton />
        </CardHeader>
        <CardContent>
          <SettingsForm
            mode={settings?.mode ?? "manual"}
            scheduleCron={settings?.scheduleCron ?? "0 8 * * *"}
            timezone={tz}
            enabled={settings?.enabled ?? false}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source health (latest run)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latest ? (
              <>
                <Row label="Datadog">
                  <Badge tone={sourceTone(latest.datadogStatus)}>
                    {latest.datadogStatus}
                  </Badge>
                </Row>
                <Row label="incident.io">
                  <Badge tone={sourceTone(latest.incidentioStatus)}>
                    {latest.incidentioStatus}
                  </Badge>
                </Row>
                <Row label="Jira">
                  <Badge tone={sourceTone(latest.jiraStatus)}>
                    {latest.jiraStatus}
                  </Badge>
                </Row>
                <Row label="Apply (Datadog write)">
                  <Badge tone={canApply(cfg) ? "info" : "neutral"}>
                    {canApply(cfg) ? "enabled" : "disabled"}
                  </Badge>
                </Row>
                <Row label="Mode">
                  <Badge tone={cfg.demoMode ? "warn" : "ok"}>
                    {cfg.demoMode ? "demo (sample data)" : "live"}
                  </Badge>
                </Row>
              </>
            ) : (
              <p className="text-muted-foreground">No runs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automatic sync (worker)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Start the in-app worker to run on the schedule above:
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
              npm run scheduler
            </pre>
            <p>Or set-and-forget via OS cron (no long-lived process):</p>
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">
              {`0 8 * * *  cd ${process.cwd()} && npm run ingest`}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4">Started</th>
                    <th className="py-2 pr-4">Trigger</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Alerts</th>
                    <th className="py-2 pr-4">Active / Stale</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{fmtDateTime(r.startedAt, tz)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {r.trigger}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={runTone(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {r.totalAlerts} (H{r.highAlerts}/L{r.lowAlerts})
                      </td>
                      <td className="py-2 pr-4">
                        {r.activeFiring} / {r.staleFiring}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
