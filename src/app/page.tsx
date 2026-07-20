import Link from "next/link";
import { DateTime } from "luxon";
import { getConfig } from "@/lib/config";
import {
  getLatestRun,
  getTrendSeries,
  getLatestVuln,
  getRecommendations,
  getSyncSettings,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { TrendChart } from "@/components/trend-chart";
import { OnCallBanner } from "@/components/on-call-banner";
import { fmtDate, fmtDateTime, statusTone, statusLabel, trendArrow } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const cfg = getConfig();
  const [run, series, vuln, recs, settings] = await Promise.all([
    getLatestRun(),
    getTrendSeries(30),
    getLatestVuln(),
    getRecommendations(),
    getSyncSettings(),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  if (!run) {
    return (
      <EmptyState />
    );
  }

  const trendPoints = series.map((r) => ({
    label: DateTime.fromJSDate(r.startedAt, { zone: tz }).toFormat("MMM d"),
    alerts: r.totalAlerts,
    runRate: Math.round(r.runRateWeekly ?? 0),
    active: r.activeFiring,
    stale: r.staleFiring,
  }));

  const openRecs = recs.filter((r) =>
    ["strongly-recommend", "recommend", "regressed", "proposed"].includes(r.status),
  );
  const topRecs = recs.slice(0, 3);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          On-call week {fmtDate(run.windowStart, tz)} → {fmtDate(run.windowEnd, tz)} ·
          week-to-date · refreshed {fmtDateTime(run.startedAt, tz)}
        </p>
      </header>

      <OnCallBanner
        primary={run.primaryOnCall}
        secondary={run.secondaryOnCall}
        nextPrimary={run.nextPrimaryOnCall}
        nextSecondary={run.nextSecondaryOnCall}
        windowStart={run.windowStart}
        windowEnd={run.windowEnd}
        tz={tz}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Alerts (week-to-date)"
          value={run.totalAlerts}
          sub={`${run.highAlerts} High / ${run.lowAlerts} Low · run-rate ~${Math.round(
            run.runRateWeekly ?? 0,
          )}/wk ${trendArrow(run.trend)}`}
        />
        <KpiCard
          label="Active firing"
          value={run.activeFiring}
          tone={run.activeFiring > 0 ? "alert" : "ok"}
          sub="prod Alert/Warn now"
        />
        <KpiCard
          label="Stale firing"
          value={run.staleFiring}
          tone={run.staleFiring > 0 ? "warn" : "ok"}
          sub="orphaned incident.io alerts"
        />
        <KpiCard
          label="Escalation rate"
          value={`${run.escalationRateNum}/${run.escalationRateDen || 0}`}
          sub="alerts → incidents"
        />
        <KpiCard label="Human attention" value={run.humanAttention} />
        <KpiCard label="Auto-resolved" value={run.autoResolved} />
        <KpiCard label="Incidents" value={run.incidentsCount} tone={run.incidentsCount > 0 ? "alert" : "ok"} />
        <KpiCard
          label="Open recommendations"
          value={openRecs.length}
          tone={openRecs.length > 0 ? "warn" : "ok"}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Alert volume trend (from memory)</CardTitle>
          <span className="text-xs text-muted-foreground">
            {series.length} run(s)
          </span>
        </CardHeader>
        <CardContent>
          <TrendChart data={trendPoints} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top monitor tuning recommendations</CardTitle>
            <Link href="/recommendations" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRecs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tuning changes recommended. ✓
              </p>
            ) : (
              topRecs.map((r) => (
                <Link
                  key={r.id}
                  href={`/recommendations#${r.id}`}
                  className="block rounded-md border border-border p-3 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.monitorName}</span>
                    <Badge tone={statusTone(r.status)}>
                      {statusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.changeSummary}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SLOs / SLAs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <LinkRow href={cfg.links.dashboardUrl} label="PENG-Growth Ops Dashboard" />
              <LinkRow href={cfg.links.bugsOoslaUrl} label="PENG Bugs OOSLA (Jira)" />
              <LinkRow href={cfg.links.vulnerabilitiesUrl} label="Vulnerabilities (Jira)" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vulnerabilities</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {vuln ? (
                <div>
                  <div className="text-2xl font-semibold">{vuln.total}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {vuln.critical} Critical · {vuln.high} High · {vuln.scope}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No data.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block text-primary hover:underline"
    >
      {label} ↗
    </a>
  );
}

function EmptyState() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>No data yet</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Run a sync to populate the dashboard: use the “Sync now” button above or
        run <code>npm run ingest</code> in the terminal.
      </CardContent>
    </Card>
  );
}
