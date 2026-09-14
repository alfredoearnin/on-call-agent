import Link from "next/link";
import { getConfig, hasDatadogRead } from "@/lib/config";
import {
  getMonitorList,
  getSyncSettings,
  type MonitorListRow,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalyzeMonitorButton } from "@/components/analyze-monitor-button";
import { reconcileStaleAnalyses } from "@/lib/analysis-actions";
import { AutomationKey } from "@/lib/constants";
import { canTriggerAutomation } from "@/lib/automations/secrets";
import { monitorStateTone, priorityTone, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * One row's recommendation tally, in three numbers that each mean one thing.
 *
 * The row used to read "4 recommendations (3 applyable)" for a monitor whose
 * three changes were already in Datadog — "applyable" meant "the row has a
 * patch column", and nothing on the index said that the work had been done.
 * Whether the advice was taken is the question this list is for, so it is the
 * clause that comes first.
 *
 * Clauses are omitted when their count is zero rather than printed as a zero,
 * except "none applyable", which is the interesting case: advice is open and
 * nothing can act on it.
 */
function recommendationSummary(m: MonitorListRow): string {
  const parts = [
    `${m.recommendationCount} recommendation${m.recommendationCount === 1 ? "" : "s"}`,
  ];
  if (m.appliedCount > 0) parts.push(`${m.appliedCount} applied`);
  if (m.appliedOutOfBandCount > 0) {
    parts.push(`${m.appliedOutOfBandCount} applied out of band`);
  }
  if (m.openCount > 0) {
    parts.push(
      m.applyableCount > 0 ? `${m.applyableCount} applyable` : "none applyable",
    );
  }
  return parts.join(" · ");
}

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

  // One button, two halves, gated separately: the rules need the Datadog read
  // keys and the cause investigation needs the Cursor webhook pair. Either can
  // be configured without the other, so the caption says which is in play
  // rather than implying both always run.
  const investigateConfigured = canTriggerAutomation(
    AutomationKey.CauseInvestigation,
  );

  const unexamined = monitors.filter((m) => m.lastAnalysisAt === null).length;
  // The number this dashboard exists to move. It sat at zero for months with
  // fifteen recommendations outstanding, and nothing on any page said so.
  const applied = monitors.reduce(
    (sum, m) => sum + m.appliedCount + m.appliedOutOfBandCount,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Monitors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {monitors.length} monitor{monitors.length === 1 ? "" : "s"} ·{" "}
          {unexamined} never analysed
          {applied > 0 ? ` · ${applied} recommendation(s) applied` : ""}
          {analyzeMode === "blocked"
            ? ` · analysis disabled (set ${missingAnalysisEnv.join(" and ")})`
            : ""}
          {investigateConfigured
            ? " · Analyse also asks the Cursor agent for the cause"
            : ""}
        </p>
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
                      ? ` · ${recommendationSummary(m)}`
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
                  alsoInvestigates={investigateConfigured}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
