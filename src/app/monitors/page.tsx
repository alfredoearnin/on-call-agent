import Link from "next/link";
import { getConfig, hasDatadogRead } from "@/lib/config";
import { getMonitorList, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalyzeMonitorButton } from "@/components/analyze-monitor-button";
import { reconcileStaleAnalyses } from "@/lib/analysis-actions";
import { RerunAutomationButton } from "@/components/rerun-automation-button";
import { AutomationKey } from "@/lib/constants";
import {
  automationEnvNames,
  canTriggerAutomation,
} from "@/lib/automations/secrets";
import { monitorStateTone, priorityTone, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The monitor index.
 *
 * It exists because the Analyse button had nowhere to be found. A monitor page
 * was only reachable from a link on a recommendation, an alert or a config
 * edit, so a monitor nobody had analysed yet — having none of those — could
 * only be opened by typing its id into the URL. The monitors most worth a first
 * look were the only unreachable ones.
 *
 * Ordered by firings, then by monitors with no recommendation yet, so the
 * unexamined ones surface rather than sinking below the ones already handled.
 */
export default async function MonitorsPage() {
  const cfg = getConfig();
  // Settle any run the platform killed mid-request before rendering a status.
  await reconcileStaleAnalyses();
  const [monitors, settings] = await Promise.all([
    getMonitorList(),
    getSyncSettings(),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;

  const missingAnalysisEnv = hasDatadogRead(cfg)
    ? []
    : ["DD_API_KEY", "DD_APP_KEY"];
  const analyzeMode: "real" | "blocked" =
    missingAnalysisEnv.length === 0 ? "real" : "blocked";

  // Gated on its own credentials, independently of the rule-based analysis:
  // one needs Datadog, the other needs the Cursor webhook, and either can be
  // available without the other.
  const investigateMode: "real" | "blocked" = canTriggerAutomation(
    AutomationKey.CauseInvestigation,
  )
    ? "real"
    : "blocked";

  const unexamined = monitors.filter((m) => m.lastAnalysisAt === null).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monitors.length} monitor{monitors.length === 1 ? "" : "s"} ·{" "}
            {unexamined} never analysed
            {analyzeMode === "blocked"
              ? ` · analysis disabled (set ${missingAnalysisEnv.join(" and ")})`
              : ""}
          </p>
        </div>
        {/* Two different things, so two buttons, and the difference is stated
            rather than implied. The per-row Analyse runs here and now; this one
            hands work to a cloud agent that picks its own candidates, because a
            Cursor webhook trigger carries no monitor id. Putting it only in
            Settings hid it where nobody would look for it. */}
        <div className="flex flex-col items-end gap-1">
          <RerunAutomationButton
            automationKey={AutomationKey.CauseInvestigation}
            mode={investigateMode}
            missingEnv={automationEnvNames(AutomationKey.CauseInvestigation)}
            warning={null}
            label="Investigate causes"
            pendingLabel="Requesting…"
            idleTitle="Ask the Cursor agent to work out why services behind these monitors misbehave. It selects its own candidates and files Jira tickets."
          />
          <span className="max-w-xs text-right text-xs text-muted-foreground">
            Runs in Cursor, not here. Files Jira tickets and posts to Slack.
          </span>
        </div>
      </header>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No monitors ingested yet. Run a sync from Settings first — this list
            reads the local database, not Datadog.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All monitors</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {monitors.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/monitors/${m.id}`}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {m.name}
                    </Link>
                    <Badge tone={monitorStateTone(m.currentState)}>
                      {m.currentState}
                    </Badge>
                    <Badge tone={priorityTone(m.priority)}>{m.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.id}
                    {m.service ? ` · ${m.service}` : ""}
                    {` · ${m.alertCount} recorded firing${m.alertCount === 1 ? "" : "s"}`}
                    {m.recommendationCount > 0
                      ? ` · ${m.recommendationCount} recommendation${m.recommendationCount === 1 ? "" : "s"}` +
                        // An applyable count of zero is the interesting case:
                        // advice exists but nothing can act on it.
                        (m.applyableCount > 0
                          ? ` (${m.applyableCount} applyable)`
                          : " (none applyable)")
                      : " · no recommendation yet"}
                    {m.lastAnalysisAt
                      ? ` · analysed ${fmtDateTime(m.lastAnalysisAt, tz)}${
                          m.lastAnalysisStatus &&
                          m.lastAnalysisStatus !== "done"
                            ? ` (${m.lastAnalysisStatus})`
                            : ""
                        }`
                      : ""}
                  </p>
                </div>
                <AnalyzeMonitorButton
                  monitorId={m.id}
                  mode={analyzeMode}
                  missingEnv={missingAnalysisEnv}
                  last={null}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
