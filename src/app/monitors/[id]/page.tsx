import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig, canApply } from "@/lib/config";
import { getMonitorDetail, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCard } from "@/components/alert-card";
import { RecommendationCard } from "@/components/recommendation-card";
import { RevertButton } from "@/components/revert-button";
import { monitorStateTone, priorityTone, fmtDateTime } from "@/lib/format";
import { AppliedChangeStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cfg = getConfig();
  const [monitor, settings] = await Promise.all([
    getMonitorDetail(id),
    getSyncSettings(),
  ]);
  if (!monitor) notFound();
  const tz = settings?.timezone ?? cfg.team.timezone;
  const applyMode: "real" | "demo" | "blocked" = canApply(cfg)
    ? "real"
    : cfg.demoMode
      ? "demo"
      : "blocked";

  return (
    <div className="space-y-6">
      <header>
        <Link href="/recommendations" className="text-xs text-primary hover:underline">
          ← Recommendations
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{monitor.name}</h1>
          <Badge tone={monitorStateTone(monitor.currentState)}>
            {monitor.currentState}
          </Badge>
          <Badge tone={priorityTone(monitor.priority)}>{monitor.priority}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor {monitor.id}
          {monitor.service ? ` · ${monitor.service}` : ""}
          {monitor.envScope ? ` · env: ${monitor.envScope}` : ""}
          {monitor.cluster ? ` · ${monitor.cluster}` : ""}
        </p>
        {monitor.datadogUrl && (
          <a
            href={monitor.datadogUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            Open in Datadog ↗
          </a>
        )}
      </header>

      {monitor.query && (
        <Card>
          <CardHeader>
            <CardTitle>Current configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Query</div>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs">
                {monitor.query}
              </pre>
            </div>
            {monitor.message && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Routing / message
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs">
                  {monitor.message}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {monitor.recommendations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recommendations</h2>
          {monitor.recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={{ ...rec, monitor: { datadogUrl: monitor.datadogUrl } }}
              applyMode={applyMode}
            />
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fire history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monitor.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fires recorded.</p>
            ) : (
              monitor.alerts.map((a) => (
                <AlertCard key={a.id} alert={{ ...a, monitor: null }} tz={tz} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Applied changes (audit trail)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {monitor.appliedChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No changes applied via the dashboard.
              </p>
            ) : (
              monitor.appliedChanges.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.changeSummary}</span>
                    <Badge
                      tone={
                        c.status === AppliedChangeStatus.Applied
                          ? "info"
                          : c.status === AppliedChangeStatus.Reverted
                            ? "neutral"
                            : "alert"
                      }
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {c.targetScope} · {c.operator} · {fmtDateTime(c.appliedAt, tz)}
                  </div>
                  {c.datadogResponse && (
                    <div className="mt-1 text-muted-foreground">{c.datadogResponse}</div>
                  )}
                  {c.status === AppliedChangeStatus.Applied && (
                    <div className="mt-2">
                      <RevertButton appliedChangeId={c.id} />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Config snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs">
            {monitor.snapshots.map((s, i) => {
              const prev = monitor.snapshots[i + 1];
              const changed = prev && prev.hash !== s.hash;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-border/40 py-1"
                >
                  <span className="text-muted-foreground">
                    {fmtDateTime(s.capturedAt, tz)}
                  </span>
                  <span className="font-mono text-[11px]">{s.hash}</span>
                  {changed ? (
                    <Badge tone="warn">changed</Badge>
                  ) : (
                    <Badge tone="neutral">stable</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
