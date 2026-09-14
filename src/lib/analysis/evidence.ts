import { DateTime } from "luxon";
import type { MetricPoint } from "@/lib/clients/datadog";
import type {
  IncidentIoAlert,
  IncidentIoEscalation,
} from "@/lib/clients/incidentio";
import type {
  AggregationFinding,
  MonitorThresholds,
  ParsedMonitorQuery,
  WarnRoutingFinding,
} from "./monitor-query";

/**
 * The evidence one monitor's analysis rests on.
 *
 * Gathered deterministically from Datadog and incident.io, then handed to a
 * model for interpretation. The split matters: a model that cannot query cannot
 * invent a metric, and everything below is reproducible from the same two APIs
 * at the same timestamps. It is also the artifact a reviewer checks the
 * recommendation against, which is why it is persisted with the analysis.
 *
 * Carries metric aggregates, alert metadata and responder display names. Never
 * request bodies, customer identifiers, or email addresses.
 */
export interface MonitorEvidence {
  collectedAtIso: string;
  window: { fromIso: string; toIso: string; days: number };
  timezone: string;
  monitor: MonitorFacts;
  pages: PageFacts;
  metric: MetricFacts;
  infra?: InfraFacts;
  /** Findings the rules already reached, so the model reasons from them. */
  findings: {
    warnRouting: WarnRoutingFinding;
    aggregation: AggregationFinding;
    percentileStability?: PercentileStability;
    probeContamination?: ProbeContamination;
  };
}

export interface MonitorFacts {
  id: string;
  name: string;
  query: string;
  /** Routing text. Handles only — the runbook link and prose are kept. */
  message?: string;
  state?: string;
  service?: string;
  tags?: string[];
  thresholds: MonitorThresholds;
  options?: Record<string, unknown>;
  parsed: ParsedMonitorQuery;
}

export interface Firing {
  atIso: string;
  /** Hour of day in the team's timezone — the on-call burden, not UTC. */
  localHour: number;
  localIso: string;
  /** Alert title level, e.g. `Triggered` or `Warn`. */
  level: string;
  priority?: string;
  resolvedAtIso?: string;
  minutesToResolve?: number;
  hadIncident: boolean;
}

export interface Page {
  atIso: string;
  localHour: number;
  status?: string;
  ackSeconds?: number;
  pagedCount: number;
  escalationPath?: string;
}

export interface PageFacts {
  firings: Firing[];
  totalFirings: number;
  byLevel: Record<string, number>;
  /** Firings attached to an incident. Zero is the headline number. */
  withIncident: number;
  autoResolvedPct?: number;
  selfResolveMinutes?: Stats;
  escalations: Page[];
  totalPages: number;
  /** Pages outside 09:00-18:00 in the team's timezone. */
  pagesOutsideWorkHours: number;
  /** Pages between 00:00 and 06:00 in the team's timezone. */
  pagesOvernight: number;
  ackSeconds?: Stats;
}

export interface MetricFacts {
  query: string;
  /** Baseline over the whole window, flattened across series. */
  baseline?: Stats;
  /** Per-series breakdown when the query grouped. */
  byResource?: ResourceSeries[];
  /** Requests per evaluation interval, when a hit count was readable. */
  volume?: { perInterval: Stats; intervalSeconds: number };
}

export interface ResourceSeries {
  scope: string;
  baseline: Stats;
  peak: number;
  peakAtIso?: string;
  /** Peak divided by the median. A probe stall shows orders of magnitude. */
  peakOverMedian?: number;
}

export interface InfraFacts {
  cpuThrottledPeriods?: Stats;
  containerRestarts?: Stats;
  memoryUsagePct?: Stats;
}

export interface Stats {
  count: number;
  p50: number;
  p90: number;
  max: number;
  min: number;
}

/**
 * Whether the percentile has enough samples per interval to mean anything.
 *
 * A p90 over n samples is the ceil(n/10)-th slowest. At n=15 that is the second
 * slowest request, so the "90th percentile" tracks the extreme tail and behaves
 * like a maximum — one slow call moves it by orders of magnitude. This is a
 * different defect from a loose threshold and from a spike-sensitive window,
 * and it is the reason a percentile monitor on a low-traffic service is
 * mis-specified rather than mis-tuned.
 */
export interface PercentileStability {
  percentile: number;
  samplesPerInterval: number;
  /** How many samples sit at or above the percentile in one interval. */
  samplesAbovePercentile: number;
  /** At or below two samples, the percentile is effectively an extreme. */
  behavesAsExtreme: boolean;
}

/**
 * Infrastructure endpoints whose latency is in the same metric as business
 * traffic.
 *
 * Kubernetes liveness and readiness probes answer in well under a millisecond
 * and run constantly, so they make up a large share of a service's request
 * count while contributing nothing about customer experience. When the process
 * stalls they stall with it, and a probe going from 0.5ms to 111s is not
 * latency — it is the pod not running. Left in the metric they turn a latency
 * SLI into a liveness check with a latency threshold.
 */
export interface ProbeContamination {
  /** Series that look like infrastructure probes. */
  probeScopes: string[];
  /** Probe series that spiked far above their own baseline in the window. */
  stalledProbeScopes: string[];
  /** True when a stalled probe coincides with the business-endpoint spike. */
  allEndpointsDegradedTogether: boolean;
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const NIGHT_START_HOUR = 0;
const NIGHT_END_HOUR = 6;

/** A probe answers in well under a millisecond when the process is healthy. */
const PROBE_MEDIAN_CEILING_SECONDS = 0.005;
/** A stall is orders of magnitude, not a slow request. */
const PROBE_STALL_FACTOR = 100;

export function summarize(values: number[]): Stats | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: quantile(sorted, 50),
    p90: quantile(sorted, 90),
  };
}

/** Linear-interpolated quantile over a pre-sorted array. */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** The level a Datadog alert title carries: `[Warn]`, `[Triggered]`, ... */
export function levelFromTitle(title: string | undefined): string {
  const m = /^\s*\[([^\]]+)\]/.exec(title ?? "");
  return m ? m[1].trim() : "Unknown";
}

export function shapeFirings(
  alerts: IncidentIoAlert[],
  timezone: string,
): Firing[] {
  return alerts
    .map((a) => {
      const at = a.created_at ? new Date(a.created_at) : undefined;
      if (!at || Number.isNaN(at.getTime())) return undefined;
      const resolved = a.resolved_at ? new Date(a.resolved_at) : undefined;
      const local = DateTime.fromJSDate(at, { zone: timezone });
      const minutes =
        resolved && !Number.isNaN(resolved.getTime())
          ? (resolved.getTime() - at.getTime()) / 60_000
          : undefined;

      return {
        atIso: at.toISOString(),
        localHour: local.hour,
        localIso: local.toISO() ?? at.toISOString(),
        level: levelFromTitle(a.title),
        priority: a.priority?.name,
        resolvedAtIso: resolved?.toISOString(),
        minutesToResolve:
          minutes != null ? Math.round(minutes * 10) / 10 : undefined,
        hadIncident: false,
      } satisfies Firing;
    })
    .filter((f): f is Firing => f !== undefined)
    .sort((a, b) => a.atIso.localeCompare(b.atIso));
}

export function shapePages(
  escalations: IncidentIoEscalation[],
  timezone: string,
): Page[] {
  return escalations
    .map((e) => {
      const at = e.created_at ? new Date(e.created_at) : undefined;
      if (!at || Number.isNaN(at.getTime())) return undefined;
      const acked = e.acked_at ? new Date(e.acked_at) : undefined;
      const local = DateTime.fromJSDate(at, { zone: timezone });

      return {
        atIso: at.toISOString(),
        localHour: local.hour,
        status: e.status,
        ackSeconds:
          acked && !Number.isNaN(acked.getTime())
            ? Math.round((acked.getTime() - at.getTime()) / 1000)
            : undefined,
        pagedCount: e.paged_users?.length ?? 0,
        escalationPath: e.escalation_path?.name,
      } satisfies Page;
    })
    .filter((p): p is Page => p !== undefined)
    .sort((a, b) => a.atIso.localeCompare(b.atIso));
}

export function shapePageFacts(firings: Firing[], pages: Page[]): PageFacts {
  const byLevel: Record<string, number> = {};
  for (const f of firings) byLevel[f.level] = (byLevel[f.level] ?? 0) + 1;

  const resolveTimes = firings
    .map((f) => f.minutesToResolve)
    .filter((m): m is number => m != null);

  const autoResolved = firings.filter((f) => f.resolvedAtIso).length;
  const ackTimes = pages
    .map((p) => p.ackSeconds)
    .filter((s): s is number => s != null);

  return {
    firings,
    totalFirings: firings.length,
    byLevel,
    withIncident: firings.filter((f) => f.hadIncident).length,
    autoResolvedPct:
      firings.length > 0
        ? Math.round((autoResolved / firings.length) * 100)
        : undefined,
    selfResolveMinutes: summarize(resolveTimes),
    escalations: pages,
    totalPages: pages.length,
    pagesOutsideWorkHours: pages.filter(
      (p) => p.localHour < WORK_START_HOUR || p.localHour >= WORK_END_HOUR,
    ).length,
    pagesOvernight: pages.filter(
      (p) => p.localHour >= NIGHT_START_HOUR && p.localHour < NIGHT_END_HOUR,
    ).length,
    ackSeconds: summarize(ackTimes),
  };
}

export function shapeResourceSeries(
  bySeries: Map<string, MetricPoint[]>,
): ResourceSeries[] {
  const out: ResourceSeries[] = [];
  for (const [scope, points] of bySeries) {
    const stats = summarize(points.map((p) => p.value));
    if (!stats) continue;
    const peakPoint = points.reduce<MetricPoint | undefined>(
      (best, p) => (!best || p.value > best.value ? p : best),
      undefined,
    );
    out.push({
      scope,
      baseline: stats,
      peak: stats.max,
      peakAtIso: peakPoint ? new Date(peakPoint.at).toISOString() : undefined,
      peakOverMedian:
        stats.p50 > 0 ? Math.round((stats.max / stats.p50) * 10) / 10 : undefined,
    });
  }
  return out.sort((a, b) => b.peak - a.peak);
}

export function analyzePercentileStability(
  parsed: ParsedMonitorQuery,
  samplesPerInterval: number | undefined,
): PercentileStability | undefined {
  if (!parsed.isPercentile || samplesPerInterval == null) return undefined;
  const pct = Number.parseInt((parsed.spaceAgg ?? "").slice(1), 10);
  if (!Number.isFinite(pct)) return undefined;

  const tailFraction = (100 - pct) / 100;
  const above = Math.max(1, Math.ceil(samplesPerInterval * tailFraction));

  return {
    percentile: pct,
    samplesPerInterval: Math.round(samplesPerInterval),
    samplesAbovePercentile: above,
    behavesAsExtreme: above <= 2,
  };
}

export function analyzeProbeContamination(
  series: ResourceSeries[],
): ProbeContamination | undefined {
  if (series.length < 2) return undefined;

  const probes = series.filter(
    (s) => s.baseline.p50 > 0 && s.baseline.p50 <= PROBE_MEDIAN_CEILING_SECONDS,
  );
  if (probes.length === 0) return undefined;

  const stalled = probes.filter(
    (s) => s.peakOverMedian != null && s.peakOverMedian >= PROBE_STALL_FACTOR,
  );

  // A business endpoint is any series that is not a sub-millisecond probe.
  const business = series.filter((s) => !probes.includes(s));
  const businessSpiked = business.some(
    (s) => s.peakOverMedian != null && s.peakOverMedian >= 10,
  );

  return {
    probeScopes: probes.map((p) => p.scope),
    stalledProbeScopes: stalled.map((p) => p.scope),
    allEndpointsDegradedTogether: stalled.length > 0 && businessSpiked,
  };
}
