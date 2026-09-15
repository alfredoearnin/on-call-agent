/**
 * Orderings for the monitor index.
 *
 * Chosen as questions rather than as columns. 279 rows is far past what anyone
 * reads, so an ordering is only worth an option if it puts a different set of
 * rows at the top:
 *
 *   Noisiest  — which monitors wake people most. The triage default.
 *   To apply  — what can be acted on right now. Turns the list into a queue.
 *   Open      — where advice is stuck: awaiting a decision with no usable
 *               patch, which needs a fresh analysis rather than a click.
 *   Applied   — what has actually been changed. The project's own scoreboard.
 *   Analysed  — what was looked at recently, and by omission what never was.
 *   Name      — for finding a specific monitor.
 *
 * Monitor id is deliberately not offered: the ids are arbitrary numbers, so
 * ordering by them answers nothing that Name does not answer better.
 *
 * Every ordering ends in the monitor name, and the counting ones fall back to
 * firings first. Without full tiebreakers the head of the list is arbitrary
 * among equals, which reads as a bug the moment two people compare screens.
 */

export const MonitorSort = {
  Firings: "firings",
  ToApply: "to-apply",
  Open: "open",
  Applied: "applied",
  Analysed: "analysed",
  Name: "name",
} as const;
export type MonitorSort = (typeof MonitorSort)[keyof typeof MonitorSort];

/** Triage order: the monitors costing the most sleep, first. */
export const DEFAULT_MONITOR_SORT: MonitorSort = MonitorSort.Firings;

/** Label for the sort control, in the order the options are offered. */
export const MONITOR_SORT_LABELS: { sort: MonitorSort; label: string; title: string }[] =
  [
    {
      sort: MonitorSort.Firings,
      label: "Noisiest",
      title: "Most recorded firings first",
    },
    {
      sort: MonitorSort.ToApply,
      label: "To apply",
      title: "Monitors with a recommended change ready to apply, first",
    },
    {
      sort: MonitorSort.Open,
      label: "Open",
      title:
        "Monitors with recommendations awaiting a decision, first — including those whose patch no longer fits and needs re-analysing",
    },
    {
      sort: MonitorSort.Applied,
      label: "Applied",
      title: "Monitors with the most recommendations already applied, first",
    },
    {
      sort: MonitorSort.Analysed,
      label: "Analysed",
      title: "Most recently analysed first; never-analysed monitors last",
    },
    { sort: MonitorSort.Name, label: "Name", title: "Alphabetical by name" },
  ];

/** The fields an ordering reads. Kept minimal so the comparators are testable. */
export interface SortableMonitor {
  name: string;
  alertCount: number;
  recommendationCount: number;
  appliedCount: number;
  appliedOutOfBandCount: number;
  openCount: number;
  applyableCount: number;
  lastAnalysisAt: Date | null;
}

/** An unknown or absent param falls back to the default rather than erroring. */
export function parseMonitorSort(raw: string | undefined): MonitorSort {
  const found = MONITOR_SORT_LABELS.find((o) => o.sort === raw);
  return found?.sort ?? DEFAULT_MONITOR_SORT;
}

function byName(a: SortableMonitor, b: SortableMonitor): number {
  return a.name.localeCompare(b.name);
}

function inPlace(m: SortableMonitor): number {
  return m.appliedCount + m.appliedOutOfBandCount;
}

function comparator(
  sort: MonitorSort,
): (a: SortableMonitor, b: SortableMonitor) => number {
  switch (sort) {
    case MonitorSort.ToApply:
      return (a, b) =>
        b.applyableCount - a.applyableCount ||
        b.openCount - a.openCount ||
        b.alertCount - a.alertCount ||
        byName(a, b);

    case MonitorSort.Open:
      return (a, b) =>
        b.openCount - a.openCount ||
        b.applyableCount - a.applyableCount ||
        b.alertCount - a.alertCount ||
        byName(a, b);

    case MonitorSort.Applied:
      return (a, b) =>
        inPlace(b) - inPlace(a) ||
        b.recommendationCount - a.recommendationCount ||
        b.alertCount - a.alertCount ||
        byName(a, b);

    case MonitorSort.Analysed:
      // Never-analysed rows sort last, not first: a null is the absence of a
      // date, and sorting it as though it were the oldest one would bury the
      // handful of analysed monitors under 278 that were never looked at.
      return (a, b) => {
        const at = a.lastAnalysisAt?.getTime();
        const bt = b.lastAnalysisAt?.getTime();
        if (at == null && bt == null) {
          return b.alertCount - a.alertCount || byName(a, b);
        }
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt - at || byName(a, b);
      };

    case MonitorSort.Name:
      return byName;

    case MonitorSort.Firings:
      return (a, b) =>
        b.alertCount - a.alertCount ||
        // Fewest recommendations first, so a monitor nobody has examined
        // surfaces above one already handled at the same firing count.
        a.recommendationCount - b.recommendationCount ||
        byName(a, b);
  }
}

/** Sorted copy. Never mutates the input. */
export function sortMonitors<T extends SortableMonitor>(
  rows: T[],
  sort: MonitorSort,
): T[] {
  return [...rows].sort(comparator(sort));
}
