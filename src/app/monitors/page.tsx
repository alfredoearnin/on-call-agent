import Link from "next/link";
import { getConfig, hasDatadogRead } from "@/lib/config";
import { getMonitorList, getSyncSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalyzeMonitorButton } from "@/components/analyze-monitor-button";
import { MonitorSearchBox } from "@/components/monitor-search-box";
import { reconcileStaleAnalyses } from "@/lib/analysis-actions";
import { AutomationKey } from "@/lib/constants";
import { canTriggerAutomation } from "@/lib/automations/secrets";
import { monitorProgressBadges } from "@/lib/monitor-progress";
import { filterMonitors, searchTerms } from "@/lib/monitor-search";
import {
  MONITOR_SORT_LABELS,
  parseMonitorSort,
  DEFAULT_MONITOR_SORT,
  type MonitorSort,
} from "@/lib/monitor-sort";
import { cn } from "@/lib/utils";
import { monitorStateTone, priorityTone, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * A /monitors URL carrying only the params that are not at their default.
 *
 * Every control has to rebuild the whole query rather than set its own key,
 * or it drops the others — the failure the Daily page's DayPicker documents.
 * Keeping defaults out means plain /monitors stays the one spelling of the
 * default view instead of one of several.
 */
function sortHref(sort?: MonitorSort, q?: string): string {
  const p = new URLSearchParams();
  if (sort && sort !== DEFAULT_MONITOR_SORT) p.set("sort", sort);
  if (q?.trim()) p.set("q", q);
  const query = p.toString();
  return query ? `/monitors?${query}` : "/monitors";
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
 * Ordered by firings by default, then by monitors with no recommendation yet,
 * so the unexamined ones surface rather than sinking below the ones already
 * handled. The other orderings, and why each one is offered, are in
 * monitor-sort.ts.
 */
export default async function MonitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const { sort: sortParam, q } = await searchParams;
  const sort = parseMonitorSort(sortParam);
  const searching = searchTerms(q).length > 0;
  const cfg = getConfig();
  // Settle any run the platform killed mid-request before rendering a status.
  await reconcileStaleAnalyses();
  const [monitors, settings] = await Promise.all([
    getMonitorList(sort),
    getSyncSettings(),
  ]);
  const tz = settings?.timezone ?? cfg.team.timezone;
  // Filtered in the page rather than in the query, so both numbers survive:
  // the header needs the total to say "12 of 279", and a count that silently
  // became the filtered one would read as monitors having disappeared.
  const shown = filterMonitors(monitors, q);

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

  const unexamined = shown.filter((m) => m.lastAnalysisAt === null).length;
  // The number this dashboard exists to move. It sat at zero for months with
  // fifteen recommendations outstanding, and nothing on any page said so.
  const applied = shown.reduce(
    (sum, m) => sum + m.appliedCount + m.appliedOutOfBandCount,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Monitors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {searching
            ? `${shown.length} of ${monitors.length} monitors match “${q}”`
            : `${monitors.length} monitor${monitors.length === 1 ? "" : "s"}`}
          {` · ${unexamined} never analysed`}
          {applied > 0 ? ` · ${applied} recommendation(s) applied` : ""}
          {analyzeMode === "blocked"
            ? ` · analysis disabled (set ${missingAnalysisEnv.join(" and ")})`
            : ""}
          {investigateConfigured
            ? " · Analyse also asks the Cursor agent for the cause"
            : ""}
        </p>
      </header>

      {monitors.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <MonitorSearchBox initial={q ?? ""} />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sort</span>
            {/* Links rather than a client control: the choice belongs in the URL
                so it survives a refresh and can be shared, and this page is a
                server component that re-queries anyway. Same segmented shape as
                the Daily page's view tabs. */}
            <div className="inline-flex flex-wrap rounded-md border border-input p-0.5">
              {MONITOR_SORT_LABELS.map((o) => (
                <Link
                  key={o.sort}
                  href={sortHref(o.sort, q)}
                  title={o.title}
                  className={cn(
                    "rounded px-2.5 py-1",
                    sort === o.sort
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No monitors ingested yet. Run a sync from Settings first — this list
            reads the local database, not Datadog.
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        /* Distinct from the empty-database message above: "nothing matches
           what you typed" and "nothing has been ingested" ask for completely
           different next steps. */
        <Card>
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>
              No monitor matches <span className="text-foreground">“{q}”</span>.
              Searched name, monitor id and service.
            </p>
            <Link href={sortHref(sort)} className="text-primary hover:underline">
              Show all {monitors.length} monitors
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All monitors</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {shown.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  {/* The title owns its line. It used to share it with the
                      state and priority badges, which at a narrow width cost
                      the worst of both: the name truncated mid-word *and* the
                      badges wrapped anyway, giving three-line rows of varying
                      height. The name is the identifier — it wraps rather than
                      being cut. */}
                  <Link
                    href={`/monitors/${m.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {m.name}
                  </Link>
                  {/* State and priority belong with the identity line: they
                      classify the monitor, where the badges on the right track
                      the work on it. Kept as badges rather than folded into the
                      text so an Alert or a No Data still carries its colour. */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge tone={monitorStateTone(m.currentState)}>
                      {m.currentState}
                    </Badge>
                    <Badge tone={priorityTone(m.priority)}>{m.priority}</Badge>
                    <span>
                      {m.id}
                      {m.service ? ` · ${m.service}` : ""}
                      {` · ${m.alertCount} firing${m.alertCount === 1 ? "" : "s"}`}
                      {m.lastAnalysisAt
                        ? ` · analysed ${fmtDateTime(m.lastAnalysisAt, tz)}${
                            m.lastAnalysisStatus &&
                            m.lastAnalysisStatus !== "done"
                              ? ` (${m.lastAnalysisStatus})`
                              : ""
                          }${
                            m.recommendationCount === 0
                              ? " — nothing mechanical found"
                              : ""
                          }`
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {monitorProgressBadges(m).map((b) => (
                    <Badge key={b.label} tone={b.tone} title={b.title} className="normal-case">
                      {b.label}
                    </Badge>
                  ))}
                  <AnalyzeMonitorButton
                    monitorId={m.id}
                    mode={analyzeMode}
                    missingEnv={missingAnalysisEnv}
                    last={null}
                    alsoInvestigates={investigateConfigured}
                    emphasis="quiet"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
