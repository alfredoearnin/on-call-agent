import "server-only";

import {
  DatadogClient,
  type DatadogMonitor,
  type MetricPoint,
} from "@/lib/clients/datadog";
import { IncidentIoClient } from "@/lib/clients/incidentio";
import { getConfig, hasDatadogRead, hasIncidentIo } from "@/lib/config";
import type { Episode } from "./counterfactual";
import {
  analyzePercentileStability,
  analyzeProbeContamination,
  shapeFirings,
  shapePageFacts,
  shapePages,
  shapeResourceSeries,
  summarize,
  type MonitorEvidence,
  type ResourceSeries,
} from "./evidence";
import {
  analyzeAggregation,
  analyzeWarnRouting,
  parseMonitorQuery,
  thresholdsFrom,
} from "./monitor-query";

/**
 * Gathering everything one monitor's analysis needs, from the source systems.
 *
 * The shape of this module is dictated by a Datadog behaviour that is easy to
 * miss: the resolution of a metric query depends on its time range. A 60-day
 * query comes back in 8-hour buckets, which smooths a 90-second spike out of
 * existence — the very thing being investigated. So the baseline is fetched
 * wide and coarse, and each past firing is fetched again as its own narrow,
 * fine-grained window. Reading only the wide query is how a monitor that has
 * paged fourteen times looks perfectly healthy.
 */

/** How many recent firings to re-query at fine resolution. */
const MAX_EPISODES = 6;
/** Minutes either side of a firing. Wide enough for a 15-minute window. */
const EPISODE_PAD_MINUTES = 25;
/** Days of history for the baseline and the firing list. */
const BASELINE_DAYS = 60;
/** Datadog's finest rollup for APM metrics over a short range. */
const METRIC_RESOLUTION_SECONDS = 20;

export interface CollectedAnalysis {
  evidence: MonitorEvidence;
  /**
   * Fine-grained series per firing window, kept out of the evidence bundle.
   * The counterfactual needs every sample; the interpretation needs summaries,
   * and sending thousands of raw points would crowd out the reasoning.
   */
  episodes: Episode[];
  /** The monitor as Datadog returned it, for storing options locally. */
  monitor: DatadogMonitor;
}

export class AnalysisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisUnavailableError";
  }
}

const epoch = (d: Date) => Math.floor(d.getTime() / 1000);

/** `service:x` from a monitor's tag scope. */
function serviceFromScope(scope: string | undefined): string | undefined {
  const m = /\bservice:([\w.-]+)/.exec(scope ?? "");
  return m?.[1];
}

/** Drop the `env:` / `service:` scope into a reusable filter string. */
function metricQueries(
  spaceAgg: string,
  metric: string,
  scope: string,
): { baseline: string; grouped: string; volume: string } {
  return {
    baseline: `${spaceAgg}:${metric}{${scope}}`,
    grouped: `${spaceAgg}:${metric}{${scope}} by {resource_name}`,
    volume: `sum:${metric}.hits{${scope}}.as_count()`,
  };
}

function infraQueries(service: string): Record<string, string> {
  const scope = `env:prod,kube_service:${service}`;
  return {
    cpuThrottledPeriods: `avg:container.cpu.throttled.periods{${scope}}`,
    containerRestarts: `sum:kubernetes.containers.restarts{${scope}}.as_count()`,
    memoryUsagePct: `avg:kubernetes.memory.usage_pct{${scope}}`,
  };
}

/** A query that failed is absent evidence, not zero. */
async function tryQuery(
  fn: () => Promise<number[]>,
): Promise<number[] | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

async function tryGrouped(
  fn: () => Promise<Map<string, MetricPoint[]>>,
): Promise<Map<string, MetricPoint[]> | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

export async function collectMonitorEvidence(
  monitorId: string,
  now: Date = new Date(),
): Promise<CollectedAnalysis> {
  const cfg = getConfig();
  if (!hasDatadogRead(cfg)) {
    throw new AnalysisUnavailableError(
      "Datadog read credentials are not configured, so no evidence can be gathered.",
    );
  }

  const dd = new DatadogClient(cfg);
  const monitor = await dd.getMonitor(monitorId);

  const parsed = parseMonitorQuery(monitor.query ?? "");
  const thresholds = thresholdsFrom(monitor.options, parsed);
  const warnRouting = analyzeWarnRouting(monitor.message, thresholds);
  const service = serviceFromScope(parsed.scope);

  const from = new Date(now.getTime() - BASELINE_DAYS * 86_400_000);

  // --- Pages: the firing and escalation history ---------------------------
  const timezone = cfg.team.timezone;
  let firings = shapeFirings([], timezone);
  let pages = shapePages([], timezone);

  if (hasIncidentIo(cfg) && service) {
    const io = new IncidentIoClient(cfg);
    const [alerts, escalations] = await Promise.all([
      io.listAlertsForService(service, from),
      io.listEscalations(from),
    ]);
    firings = shapeFirings(alerts, timezone);
    const alertIds = new Set(alerts.map((a) => a.id));
    pages = shapePages(
      escalations.filter((e) => !e.alert_id || alertIds.has(e.alert_id)),
      timezone,
    );
  }

  // --- Metric: wide baseline, then each firing at fine resolution ---------
  let baseline: ReturnType<typeof summarize>;
  let byResource: ResourceSeries[] | undefined;
  let volume: MonitorEvidence["metric"]["volume"];
  const episodes: Episode[] = [];
  let metricQuery = monitor.query ?? "";

  if (parsed.spaceAgg && parsed.metric && parsed.scope) {
    const q = metricQueries(parsed.spaceAgg, parsed.metric, parsed.scope);
    metricQuery = q.baseline;

    const wide = await tryQuery(() =>
      dd.queryMetric(q.baseline, epoch(from), epoch(now)),
    );
    baseline = wide ? summarize(wide) : undefined;

    // Narrow windows around the most recent firings. Newest first, because a
    // recent window is both more relevant and more likely to still be
    // retained at full resolution.
    const recent = [...firings].reverse().slice(0, MAX_EPISODES);
    const windows = recent.map((f) => {
      const at = new Date(f.atIso);
      return {
        label: f.atIso,
        from: new Date(at.getTime() - EPISODE_PAD_MINUTES * 60_000),
        to: new Date(at.getTime() + EPISODE_PAD_MINUTES * 60_000),
      };
    });

    const perWindow = await Promise.all(
      windows.map(async (w) => ({
        window: w,
        points: await tryGrouped(() =>
          dd.queryMetricGrouped(q.baseline, epoch(w.from), epoch(w.to)),
        ),
        grouped: await tryGrouped(() =>
          dd.queryMetricGrouped(q.grouped, epoch(w.from), epoch(w.to)),
        ),
      })),
    );

    // Merge the per-resource series across windows so one breakdown covers
    // every episode, and keep the ungrouped points per episode for the replay.
    const mergedByResource = new Map<string, MetricPoint[]>();
    for (const entry of perWindow) {
      for (const [scope, points] of entry.grouped ?? []) {
        mergedByResource.set(scope, [
          ...(mergedByResource.get(scope) ?? []),
          ...points,
        ]);
      }
      const flat = [...(entry.points?.values() ?? [])].flat();
      if (flat.length > 0) {
        episodes.push({ label: entry.window.label, points: flat });
      }
    }
    if (mergedByResource.size > 0) {
      byResource = shapeResourceSeries(mergedByResource);
    }

    // Request volume over one recent narrow window, so the rollup is fine
    // enough for "samples per evaluation interval" to mean anything.
    const volFrom = new Date(now.getTime() - 60 * 60_000);
    const hits = await tryQuery(() =>
      dd.queryMetric(q.volume, epoch(volFrom), epoch(now)),
    );
    const perInterval = hits ? summarize(hits) : undefined;
    if (perInterval) {
      volume = { perInterval, intervalSeconds: METRIC_RESOLUTION_SECONDS };
    }
  }

  // --- Infrastructure: only meaningful once a service is known ------------
  let infra: MonitorEvidence["infra"];
  if (service) {
    const q = infraQueries(service);
    const windows = episodes.length > 0 ? episodes : [];
    const infraFrom =
      windows.length > 0
        ? new Date(
            Math.min(...windows.flatMap((e) => e.points.map((p) => p.at))),
          )
        : new Date(now.getTime() - 60 * 60_000);
    const infraTo =
      windows.length > 0
        ? new Date(
            Math.max(...windows.flatMap((e) => e.points.map((p) => p.at))),
          )
        : now;

    const [throttled, restarts, memory] = await Promise.all([
      tryQuery(() =>
        dd.queryMetric(q.cpuThrottledPeriods, epoch(infraFrom), epoch(infraTo)),
      ),
      tryQuery(() =>
        dd.queryMetric(q.containerRestarts, epoch(infraFrom), epoch(infraTo)),
      ),
      tryQuery(() =>
        dd.queryMetric(q.memoryUsagePct, epoch(infraFrom), epoch(infraTo)),
      ),
    ]);

    const shaped = {
      cpuThrottledPeriods: throttled ? summarize(throttled) : undefined,
      containerRestarts: restarts ? summarize(restarts) : undefined,
      memoryUsagePct: memory ? summarize(memory) : undefined,
    };
    if (Object.values(shaped).some((v) => v !== undefined)) infra = shaped;
  }

  // --- Findings the rules already reached ---------------------------------
  const peak = byResource?.[0]?.peak ?? baseline?.max;
  const aggregation = analyzeAggregation(
    parsed,
    monitor.options,
    peak,
    METRIC_RESOLUTION_SECONDS,
  );
  const samplesPerInterval = volume?.perInterval.p50;
  const percentileStability = analyzePercentileStability(
    parsed,
    samplesPerInterval,
  );
  const probeContamination = byResource
    ? analyzeProbeContamination(byResource)
    : undefined;

  const evidence: MonitorEvidence = {
    collectedAtIso: now.toISOString(),
    window: {
      fromIso: from.toISOString(),
      toIso: now.toISOString(),
      days: BASELINE_DAYS,
    },
    timezone,
    monitor: {
      id: String(monitor.id),
      name: monitor.name,
      query: monitor.query ?? "",
      message: monitor.message,
      state: monitor.overall_state,
      service,
      tags: monitor.tags,
      thresholds,
      options: monitor.options,
      parsed,
    },
    pages: shapePageFacts(firings, pages),
    metric: { query: metricQuery, baseline, byResource, volume },
    infra,
    findings: {
      warnRouting,
      aggregation,
      percentileStability,
      probeContamination,
    },
  };

  return { evidence, episodes, monitor };
}
