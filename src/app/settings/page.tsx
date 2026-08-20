import { getConfig, canApply } from "@/lib/config";
import {
  getAutomationHealth,
  getLastAutomationTriggers,
  getRuns,
  getSourceSummary,
} from "@/lib/queries";
import { AUTOMATIONS, staleHealthCheckWarning } from "@/lib/automations/meta";
import {
  automationEnvNames,
  canTriggerAutomation,
} from "@/lib/automations/secrets";
import { AutomationKey } from "@/lib/constants";
import {
  AutomationPanel,
  type AutomationRow,
} from "@/components/automation-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncNowButton } from "@/components/sync-now-button";
import { RefreshSourceButton } from "@/components/refresh-source-button";
import { fmtDateTime, fmtDate, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

function runTone(status: string): "ok" | "warn" | "alert" | "neutral" {
  if (status === "success") return "ok";
  if (status === "partial") return "warn";
  if (status === "failed") return "alert";
  return "neutral";
}

export default async function SettingsPage() {
  const cfg = getConfig();
  const now = new Date();
  const [{ weeksIngested, latest }, runs, health, lastTriggers] =
    await Promise.all([
      getSourceSummary(),
      getRuns(15),
      getAutomationHealth(now),
      getLastAutomationTriggers(),
    ]);
  const tz = cfg.team.timezone;

  // Only scalars reach the panel — never cfg, whose automations block sits beside
  // the secrets module and whose spread into a client component would leak.
  const automationRows: AutomationRow[] = health.length
    ? AUTOMATIONS.map((meta): AutomationRow => {
        const lastHealthCheck =
          lastTriggers[AutomationKey.HealthCheck]?.triggeredAt ?? null;
        return {
          key: meta.key,
          step: meta.step,
          label: meta.label,
          produces: meta.produces,
          promptFile: meta.promptFile,
          consoleUrl: cfg.automations.consoleUrl[meta.key],
          mode: canTriggerAutomation(meta.key) ? "real" : "blocked",
          missingEnv: automationEnvNames(meta.key),
          health: health.find((h) => h.key === meta.key),
          lastTriggeredAt: lastTriggers[meta.key]?.triggeredAt ?? null,
          warning:
            meta.key === AutomationKey.DashboardRefresh
              ? staleHealthCheckWarning(lastHealthCheck, now)
              : null,
        };
      })
    : [];

  const sourceLabel = cfg.demoMode
    ? "Demo (bundled sample data)"
    : cfg.syncSource === "live"
      ? "Live (Datadog + incident.io)"
      : "Confluence (on-call agent handoff pages)";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Where the dashboard&apos;s data comes from, how it stays fresh, and the
          apply write-path status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Data source</CardTitle>
            <Badge tone="primary">
              {cfg.demoMode ? "demo" : cfg.syncSource === "live" ? "live" : "confluence"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Source">{sourceLabel}</Row>
            <Row label="Weeks ingested">{weeksIngested}</Row>
            <Row label="Latest week">
              {latest?.windowStart
                ? `${fmtDate(latest.windowStart, tz)} → ${fmtDate(latest.windowEnd, tz)}`
                : "—"}
            </Row>
            <Row label="Last synced">{timeAgo(latest?.startedAt)}</Row>
            <p className="pt-1 text-xs text-muted-foreground">
              Datadog is used <strong>only</strong> for the Apply write path — not
              as a data source. No incident.io / Jira credentials are needed here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apply (Datadog write)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status">
              <Badge tone={canApply(cfg) ? "info" : "neutral"}>
                {canApply(cfg) ? "enabled" : "disabled"}
              </Badge>
            </Row>
            <p className="text-xs text-muted-foreground">
              The one guarded write path. Gated by <code>APPLY_ENABLED</code> +
              <code> DD_APP_KEY_WRITE</code>; used only from the Apply button on a
              recommendation. Everything else is read-only.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>How data refreshes</CardTitle>
          <div className="flex items-center gap-2">
            <RefreshSourceButton />
            <SyncNowButton />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Refresh from source</strong> runs <code>git pull</code> to fetch
            the latest memory the daily automation already pushed to{" "}
            <code>main</code> (Confluence → ingest → PR → auto-merge). No local
            credentials needed; it fast-forwards the committed <code>oncall.db</code>.
          </p>
          <p>
            <strong>Sync now</strong> re-parses the Confluence markdown already in{" "}
            <code>data/confluence/</code> into SQLite — useful after editing those
            files locally; it does not fetch anything remote.
          </p>
        </CardContent>
      </Card>

      <AutomationPanel rows={automationRows} />

      <Card>
        <CardHeader>
          <CardTitle>Sync history</CardTitle>
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
      <span>{children}</span>
    </div>
  );
}
