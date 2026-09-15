import { getConfig, hasDatadogRead } from "@/lib/config";
import { getMonitorList, getSyncSettings } from "@/lib/queries";
import { MonitorBrowser } from "@/components/monitor-browser";
import { reconcileStaleAnalyses } from "@/lib/analysis-actions";
import { AutomationKey } from "@/lib/constants";
import { canTriggerAutomation } from "@/lib/automations/secrets";
import { parseMonitorSort } from "@/lib/monitor-sort";

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
 * The page's own job is now just to read the ordering from the URL and fetch:
 * ordering needs the whole set and belongs on the server, while searching runs
 * in the browser over rows already sent. Both live in MonitorBrowser, which is
 * where the reasoning for that split is written down.
 */
export default async function MonitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort: sortParam, q } = await searchParams;
  const sort = parseMonitorSort(sortParam);
  const cfg = getConfig();
  // Settle any run the platform killed mid-request before rendering a status.
  await reconcileStaleAnalyses();
  const [monitors, settings] = await Promise.all([
    getMonitorList(sort),
    getSyncSettings(),
  ]);

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

  // Describes the install rather than the filtered set, so it is passed down as
  // text instead of being recomputed as the list narrows.
  const configNote =
    (analyzeMode === "blocked"
      ? ` · analysis disabled (set ${missingAnalysisEnv.join(" and ")})`
      : "") +
    (investigateConfigured
      ? " · Analyse also asks the Cursor agent for the cause"
      : "");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Monitors</h1>
      </header>

      <MonitorBrowser
        rows={monitors}
        initialQuery={q ?? ""}
        sort={sort}
        tz={settings?.timezone ?? cfg.team.timezone}
        analyzeMode={analyzeMode}
        missingEnv={missingAnalysisEnv}
        investigateConfigured={investigateConfigured}
        configNote={configNote}
      />
    </div>
  );
}
