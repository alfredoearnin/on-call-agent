/**
 * What the Overview owes its reader, ranked.
 *
 * The page presented nine KPI cards at identical visual weight, so the one card
 * that needed a human — four stale alerts, say — looked exactly like the eight
 * reading zero. A reader had to audit all nine to find the one. Ranking lives
 * here rather than in the page so the order is a tested property instead of an
 * accident of JSX order, and so "what needs attention" has one definition.
 *
 * Two rules carry the honesty:
 *
 * 1. The all-clear is a VALUE, not an absence. An empty list must render as
 *    "nothing owed" — blank space reads as an all-clear without ever having
 *    claimed to be one, which is the same trap `CoverageStrip` documents.
 * 2. A count of zero is not a signal. Nothing is gained by telling the reader
 *    about the absence of work; that is what the metric row below is for.
 *
 * Deliberately excluded: rotation coverage. `OnCallBanner` sits directly above
 * and already states it in its own warn-tone strip, so repeating it here would
 * double-report the same fact.
 */

export const SignalSeverity = {
  /** Something is wrong right now and someone should look. */
  Alert: "alert",
  /** Work is owed, but nothing is on fire. */
  Warn: "warn",
} as const;
export type SignalSeverity =
  (typeof SignalSeverity)[keyof typeof SignalSeverity];

export const SignalKey = {
  Incidents: "incidents",
  ActiveFiring: "activeFiring",
  ServicesToDrop: "servicesToDrop",
  StaleFiring: "staleFiring",
  OpenRecommendations: "openRecommendations",
  BoundaryDisputes: "boundaryDisputes",
} as const;
export type SignalKey = (typeof SignalKey)[keyof typeof SignalKey];

export interface OverviewSignal {
  key: SignalKey;
  severity: SignalSeverity;
  /** Count first, so the scale reads before the subject: `4 stale alerts`. */
  headline: string;
  /** Why it is owed, in one clause. */
  detail: string;
  href?: string;
}

/** Everything the ranking reads. Counts only — no formatting, no clock. */
export interface OverviewCounts {
  activeFiring: number;
  staleFiring: number;
  incidents: number;
  openRecommendations: number;
  servicesToDrop: number;
  boundaryDisputes: number;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

interface Rule {
  key: SignalKey;
  severity: SignalSeverity;
  count: (counts: OverviewCounts) => number;
  headline: (n: number) => string;
  detail: string;
  href?: string;
}

/**
 * Priority order, most urgent first — and the only place the order is decided.
 *
 * Alerts before warnings, and within a severity, ordered by how directly the
 * thing pages a human: an open incident outranks an alert still firing, which
 * outranks a rotation carrying services it should not.
 */
const RULES: readonly Rule[] = [
  {
    key: SignalKey.Incidents,
    severity: SignalSeverity.Alert,
    count: (c) => c.incidents,
    headline: (n) => plural(n, "incident"),
    detail: "declared this week",
  },
  {
    key: SignalKey.ActiveFiring,
    severity: SignalSeverity.Alert,
    count: (c) => c.activeFiring,
    headline: (n) => plural(n, "alert") + " firing now",
    detail: "prod Alert/Warn, unresolved",
    href: "/carryover",
  },
  {
    key: SignalKey.ServicesToDrop,
    severity: SignalSeverity.Alert,
    count: (c) => c.servicesToDrop,
    headline: (n) => plural(n, "service") + " should leave the rotation",
    detail: "still paging Growth, undecided",
    href: "/services",
  },
  {
    key: SignalKey.StaleFiring,
    severity: SignalSeverity.Warn,
    count: (c) => c.staleFiring,
    headline: (n) => plural(n, "stale alert"),
    detail: "orphaned incident.io alerts from prior weeks",
    href: "/carryover",
  },
  {
    key: SignalKey.OpenRecommendations,
    severity: SignalSeverity.Warn,
    count: (c) => c.openRecommendations,
    headline: (n) => plural(n, "open recommendation"),
    detail: "monitor tuning awaiting a decision",
    href: "/recommendations",
  },
  {
    key: SignalKey.BoundaryDisputes,
    severity: SignalSeverity.Warn,
    count: (c) => c.boundaryDisputes,
    headline: (n) =>
      plural(n, "ownership boundary", "ownership boundaries") + " unresolved",
    detail: "disputed with another team",
    href: "/services",
  },
];

export function collectSignals(counts: OverviewCounts): OverviewSignal[] {
  return RULES.flatMap((rule) => {
    const n = rule.count(counts);
    // `<= 0` rather than `=== 0`: a negative count is a data fault upstream, and
    // surfacing "-1 incidents" as something owed would be worse than omitting it.
    if (n <= 0) return [];
    return [
      {
        key: rule.key,
        severity: rule.severity,
        headline: rule.headline(n),
        detail: rule.detail,
        href: rule.href,
      },
    ];
  });
}

/**
 * The tone the panel carries as a whole: the worst severity present.
 *
 * Derived rather than read off `signals[0]`, so the panel does not silently
 * depend on `RULES` staying sorted.
 */
export function panelSeverity(
  signals: readonly OverviewSignal[],
): SignalSeverity | undefined {
  if (signals.some((s) => s.severity === SignalSeverity.Alert)) {
    return SignalSeverity.Alert;
  }
  return signals.length > 0 ? SignalSeverity.Warn : undefined;
}
