import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig, canApply, hasDatadogRead } from "@/lib/config";
import {
  getLastMonitorAnalysis,
  getMonitorCauseFindings,
  getMonitorDetail,
  getSyncSettings,
} from "@/lib/queries";
import { verdictLabel } from "@/lib/analysis/cause-report";
import { AnalyzeMonitorButton } from "@/components/analyze-monitor-button";
import { reconcileStaleAnalyses } from "@/lib/analysis-actions";
import { AutomationKey } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCard } from "@/components/alert-card";
import { RecommendationCard } from "@/components/recommendation-card";
import { RevertButton } from "@/components/revert-button";
import { getMonitorEdits } from "@/lib/monitor-edits";
import { MonitorEditCard } from "@/components/monitor-edit-card";
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
  // A run the platform killed mid-request would otherwise sit in flight
  // forever; this settles it to `expired` before the status line is rendered.
  await reconcileStaleAnalyses();
  const [monitor, settings, edits, lastAnalysis, findings] = await Promise.all([
    getMonitorDetail(id),
    getSyncSettings(),
    getMonitorEdits({ monitorId: id }),
    getLastMonitorAnalysis(id),
    getMonitorCauseFindings(id),
  ]);
  if (!monitor) notFound();
  const tz = settings?.timezone ?? cfg.team.timezone;
  const applyMode: "real" | "demo" | "blocked" = canApply(cfg)
    ? "real"
    : cfg.demoMode
      ? "demo"
      : "blocked";

  // The analysis is rule-based, so the Datadog read credentials are the whole
  // requirement — there is no model to configure and no third-party runner.
  const missingAnalysisEnv = hasDatadogRead(cfg)
    ? []
    : ["DD_API_KEY", "DD_APP_KEY"];
  const analyzeMode: "real" | "blocked" =
    missingAnalysisEnv.length === 0 ? "real" : "blocked";

  return (
    <div className="space-y-6">
      <header>
        <Link href="/recommendations" className="text-xs text-primary hover:underline">
          ← Recommendations
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{monitor.name}</h1>
            <Badge tone={monitorStateTone(monitor.currentState)}>
              {monitor.currentState}
            </Badge>
            <Badge tone={priorityTone(monitor.priority)}>{monitor.priority}</Badge>
          </div>
          {/* In the header rather than beside the Recommendations list: that
              section only renders when a recommendation already exists, and the
              "Current configuration" card only when a query is stored — so
              either would hide this button on exactly the monitors worth
              analysing first. */}
          <AnalyzeMonitorButton
            monitorId={monitor.id}
            mode={analyzeMode}
            missingEnv={missingAnalysisEnv}
            last={
              lastAnalysis
                ? {
                    status: lastAnalysis.status,
                    requestedAtIso: lastAnalysis.requestedAt.toISOString(),
                    summary: lastAnalysis.resultSummary,
                    error: lastAnalysis.error,
                  }
                : null
            }
          />
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

      {(findings.report ||
        findings.url ||
        lastAnalysis?.investigationRequestedAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Cause investigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {findings.report ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      findings.report.verdict === "real_defect"
                        ? "danger"
                        : findings.report.verdict === "noise_only"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {verdictLabel(findings.report.verdict)}
                  </Badge>
                  {findings.updatedAtIso && (
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(findings.updatedAtIso, tz)}
                    </span>
                  )}
                  {/* The prompt must report whether the trigger delivered a
                      monitor id. Surfaced because it is the difference between
                      "this is about the monitor you clicked" and "the agent
                      chose for itself". */}
                  {findings.report.receivedMonitorId === false && (
                    <Badge tone="warning">
                      agent selected this monitor itself
                    </Badge>
                  )}
                </div>

                <p>
                  {findings.report.cause ??
                    "Cause not determined from available signals."}
                </p>

                {findings.report.tickets.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tickets: {findings.report.tickets.join(", ")}
                  </p>
                )}
                {findings.report.evidence.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Evidence: {findings.report.evidence.join(" · ")}
                  </p>
                )}
                {findings.report.limitations.length > 0 && (
                  <p className="text-xs text-warning">
                    The agent could not: {findings.report.limitations.join("; ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{findings.problem}</p>
            )}

            <p className="text-xs text-muted-foreground">
              {lastAnalysis?.investigationRequestedAt && (
                <>
                  Requested{" "}
                  {fmtDateTime(lastAnalysis.investigationRequestedAt, tz)}.{" "}
                </>
              )}
              {findings.url && (
                <>
                  <a
                    href={findings.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Read the full page ↗
                  </a>
                  {" · "}
                </>
              )}
              <a
                href={`${cfg.automations.consoleUrl[AutomationKey.CauseInvestigation]}/runs`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Open the run in Cursor ↗
              </a>
            </p>
          </CardContent>
        </Card>
      )}

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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Config edits</h2>
        {edits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No config edits recorded yet. They appear on the next sync after a
            Datadog Save, or when a recommendation is applied here.
          </p>
        ) : (
          edits.map((edit) => (
            <MonitorEditCard
              key={edit.id}
              edit={edit}
              tz={tz}
              showMonitorLink={false}
            />
          ))
        )}
      </section>
    </div>
  );
}
