"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalyzeMonitorButton } from "@/components/analyze-monitor-button";
import { filterMonitors, searchTerms } from "@/lib/monitor-search";
import {
  MONITOR_SORT_LABELS,
  DEFAULT_MONITOR_SORT,
  type MonitorSort,
} from "@/lib/monitor-sort";
import { cn } from "@/lib/utils";
import { monitorProgressBadges } from "@/lib/monitor-progress";
import { monitorStateTone, priorityTone, fmtDateTime } from "@/lib/format";
import type { MonitorListRow } from "@/lib/queries";

/**
 * A /monitors URL carrying only what is not at its default.
 *
 * Keeping defaults out means plain /monitors stays the one spelling of the
 * default view instead of one of several.
 */
function sortHref(sort: MonitorSort, query: string): string {
  const p = new URLSearchParams();
  if (sort !== DEFAULT_MONITOR_SORT) p.set("sort", sort);
  if (query.trim()) p.set("q", query.trim());
  const search = p.toString();
  return search ? `/monitors?${search}` : "/monitors";
}

/**
 * The searchable monitor list.
 *
 * Filtering runs here, over rows the server already sent, so typing narrows
 * the list on the keystroke with no request at all. The first version searched
 * on Enter and went back to the server for it, which worked but felt like
 * submitting a form to read a list you were already looking at.
 *
 * Debouncing a server round trip was the other option and is worse on both
 * counts: the page is `force-dynamic` and settles stale analyses on every
 * render, so it would have spent a database query and a write path per
 * keystroke to reach an answer the browser already had.
 *
 * The URL still carries the query — a filtered list stays shareable and
 * survives a refresh — but it is written with `history.replaceState` rather
 * than through the router, because involving the router means a navigation,
 * and a navigation is the round trip this exists to avoid. Replacing rather
 * than pushing so a search does not leave one history entry per character.
 *
 * Because this renders on the server with the initial query already applied, a
 * shared `?q=` link paints correctly, needs no JavaScript for that first view,
 * and does not flash the unfiltered list before hydration.
 */
export function MonitorBrowser({
  rows,
  initialQuery,
  sort,
  tz,
  analyzeMode,
  missingEnv,
  investigateConfigured,
  configNote,
}: {
  /** Every monitor, already ordered by the server. */
  rows: MonitorListRow[];
  initialQuery: string;
  /** The ordering the server applied. Owned by the URL, not by this component. */
  sort: MonitorSort;
  tz: string;
  analyzeMode: "real" | "blocked";
  missingEnv: string[];
  investigateConfigured: boolean;
  /** Trailing clauses that describe the install, not the filtered set. */
  configNote: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const shown = filterMonitors(rows, query);
  const searching = searchTerms(query).length > 0;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [query]);

  const unexamined = shown.filter((m) => m.lastAnalysisAt === null).length;
  const applied = shown.reduce(
    (sum, m) => sum + m.appliedCount + m.appliedOutOfBandCount,
    0,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {searching
          ? `${shown.length} of ${rows.length} monitors match “${query.trim()}”`
          : `${rows.length} monitor${rows.length === 1 ? "" : "s"}`}
        {` · ${unexamined} never analysed`}
        {applied > 0 ? ` · ${applied} recommendation(s) applied` : ""}
        {configNote}
      </p>

      {rows.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="relative w-full max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, id or service"
              aria-label="Search monitors by name, id or service"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-8 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* The ordering stays a set of links, because sorting happens on the
            server: it needs the whole set, not the page's slice. They live here
            rather than on the page so each one carries whatever is typed right
            now — built on the server they would have frozen the query as it was
            on load, and a sort click would have silently restored an older
            search. */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Sort</span>
            <div className="inline-flex flex-wrap rounded-md border border-input p-0.5">
              {MONITOR_SORT_LABELS.map((o) => (
                <Link
                  key={o.sort}
                  href={sortHref(o.sort, query)}
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

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No monitors ingested yet. Run a sync from Settings first — this list
            reads the local database, not Datadog.
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        /* Distinct from the empty-database message above: "nothing matches what
           you typed" and "nothing has been ingested" ask for completely
           different next steps. */
        <Card>
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>
              No monitor matches{" "}
              <span className="text-foreground">“{query.trim()}”</span>.
              Searched name, monitor id and service.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-primary hover:underline"
            >
              Show all {rows.length} monitors
            </button>
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
                    <Badge
                      key={b.label}
                      tone={b.tone}
                      title={b.title}
                      className="normal-case"
                    >
                      {b.label}
                    </Badge>
                  ))}
                  <AnalyzeMonitorButton
                    monitorId={m.id}
                    mode={analyzeMode}
                    missingEnv={missingEnv}
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
