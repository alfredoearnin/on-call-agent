/**
 * Reading a Datadog monitor's own definition.
 *
 * Two of the most common reasons a monitor pages for nothing are legible in its
 * configuration alone, with no metric data at all:
 *
 *  - a `warning` threshold whose notification handle is not gated to the alert
 *    transition, so a sub-critical blip pages exactly like a critical one;
 *  - a window function that reaches the threshold on one outlier, which no
 *    change to the threshold number can fix.
 *
 * Both are decided here rather than by a model, because both are mechanical and
 * a rule that can be unit-tested is worth more than one that has to be trusted.
 */

/** The parts of `avg(last_10m):p90:metric{scope} > 1` we can act on. */
export interface ParsedMonitorQuery {
  /** The window function: `avg`, `min`, `max`, `sum`, `percentile`, ... */
  windowFn?: string;
  /** Evaluation window as written, e.g. `last_10m`. */
  window?: string;
  /** Window length in seconds, when `window` was recognised. */
  windowSeconds?: number;
  /** The space aggregation applied to the metric, e.g. `p90`, `avg`. */
  spaceAgg?: string;
  /** Metric name, when the query is a single-metric form. */
  metric?: string;
  /** Raw tag scope inside `{...}`, when present. */
  scope?: string;
  /** Comparison operator, e.g. `>`. */
  comparator?: string;
  /** Right-hand threshold in the query text, when numeric. */
  queryThreshold?: number;
  /** True when the metric is aggregated by a percentile rather than a mean. */
  isPercentile: boolean;
}

const WINDOW_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

/**
 * Parse the shapes this codebase actually meets, and degrade to `undefined`
 * fields rather than throwing on the ones it does not.
 *
 * A monitor query is not a grammar we control; composite and formula monitors
 * nest arbitrarily. Returning partial information is correct — a caller that
 * cannot see the window function must not conclude anything about it, which is
 * different from concluding the window function is fine.
 */
export function parseMonitorQuery(query: string): ParsedMonitorQuery {
  const out: ParsedMonitorQuery = { isPercentile: false };
  if (!query) return out;

  const head = /^\s*([a-z_]+)\(\s*(last_\d+[smhd])\s*\)\s*:/i.exec(query);
  if (head) {
    out.windowFn = head[1].toLowerCase();
    out.window = head[2].toLowerCase();
    out.windowSeconds = windowToSeconds(out.window);
  }

  const tail = /(<=|>=|<|>|==|!=)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(query);
  if (tail) {
    out.comparator = tail[1];
    out.queryThreshold = Number.parseFloat(tail[2]);
  }

  // Everything between the window prefix and the comparator is the expression.
  const exprStart = head ? head[0].length : 0;
  const exprEnd = tail ? query.length - tail[0].length : query.length;
  const expr = query.slice(exprStart, exprEnd).trim();

  // Single-metric form: `p90:trace.aspnet_core.request{env:prod,service:x}`.
  const single = /^([a-z0-9_]+)\s*:\s*([a-z0-9_.]+)\s*\{([^}]*)\}/i.exec(expr);
  if (single) {
    out.spaceAgg = single[1].toLowerCase();
    out.metric = single[2];
    out.scope = single[3].trim();
  } else {
    const scoped = /\{([^}]*)\}/.exec(expr);
    if (scoped) out.scope = scoped[1].trim();
  }

  out.isPercentile = /^p\d{1,2}$/.test(out.spaceAgg ?? "");
  return out;
}

function windowToSeconds(window: string): number | undefined {
  const m = /^last_(\d+)([smhd])$/.exec(window);
  if (!m) return undefined;
  const unit = WINDOW_UNITS[m[2]];
  return unit ? Number.parseInt(m[1], 10) * unit : undefined;
}

/** Datadog notification handles that reach a human rather than a channel. */
const PAGING_HANDLES = [/@pagerduty-/i, /@webhook-incidentio-high/i, /@opsgenie-/i];

export interface WarnRoutingFinding {
  /** A warning threshold is configured. */
  hasWarningThreshold: boolean;
  /** The message routes to at least one paging handle. */
  routesToPager: boolean;
  /**
   * Every paging handle sits inside an `{{#is_alert}}` block, so a warning
   * transition cannot page.
   */
  pagerGatedToAlert: boolean;
  /** The paging handles found, for the recommendation's before/after text. */
  pagingHandles: string[];
  /**
   * The defect: a warning threshold exists, a pager is routed, and nothing
   * gates it to the alert transition.
   */
  warnPagesLikeCritical: boolean;
}

/**
 * Whether a warning transition on this monitor pages a human.
 *
 * Datadog sends a monitor's whole message on every transition, including to
 * `warning`. Conditional blocks are the only thing that separates the two, so
 * an ungated `@pagerduty-...` or `@webhook-incidentio-high` means the warning
 * threshold is a second, lower, paging threshold — usually by accident, since
 * whoever set a warning threshold was signalling that it is *not* critical.
 */
export function analyzeWarnRouting(
  message: string | undefined,
  thresholds: MonitorThresholds,
): WarnRoutingFinding {
  const text = message ?? "";
  const handles = PAGING_HANDLES.flatMap((re) => {
    const found = new RegExp(re.source + "[\\w.-]*", "gi");
    return text.match(found) ?? [];
  });
  const unique = [...new Set(handles)];

  // A handle is gated when every occurrence of it falls inside an is_alert
  // block. Anything less and the warning transition still reaches it.
  const alertBlocks = [...text.matchAll(/\{\{#is_alert\}\}([\s\S]*?)\{\{\/is_alert\}\}/g)]
    .map((m) => m[1])
    .join("\n");
  const gated =
    unique.length > 0 &&
    unique.every((h) => {
      const occurrences = countOccurrences(text, h);
      const inside = countOccurrences(alertBlocks, h);
      return occurrences > 0 && inside === occurrences;
    });

  const hasWarning = thresholds.warning != null;
  const routes = unique.length > 0;

  return {
    hasWarningThreshold: hasWarning,
    routesToPager: routes,
    pagerGatedToAlert: gated,
    pagingHandles: unique,
    warnPagesLikeCritical: hasWarning && routes && !gated,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export interface MonitorThresholds {
  critical?: number;
  warning?: number;
  critical_recovery?: number;
  warning_recovery?: number;
}

/** Read `options.thresholds`, falling back to the query's own comparison. */
export function thresholdsFrom(
  options: Record<string, unknown> | undefined,
  parsed: ParsedMonitorQuery,
): MonitorThresholds {
  const raw = options?.thresholds;
  const out: MonitorThresholds = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k as keyof MonitorThresholds] = v;
      }
    }
  }
  if (out.critical == null && parsed.queryThreshold != null) {
    out.critical = parsed.queryThreshold;
  }
  return out;
}

/**
 * Window functions that reach the threshold on a single interval.
 *
 * `avg` averages every point in the window, so one extreme interval raises the
 * average by its value divided by the number of intervals — which, for a large
 * enough outlier, clears the threshold on its own. `min` requires every point
 * to breach, so it fires only on a breach that persisted. `max` is the extreme
 * case of the same defect as `avg`.
 */
const SINGLE_POINT_WINDOW_FNS = new Set(["avg", "max", "sum", "percentile"]);

export interface AggregationFinding {
  /** The window function cannot distinguish a spike from a sustained breach. */
  singlePointSensitive: boolean;
  /** The metric is a percentile, so a thin sample behaves like a maximum. */
  percentileOnThinSample?: boolean;
  /** `options.require_full_window`, when set. */
  requiresFullWindow?: boolean;
  /**
   * How much a single interval at `peak` moves the window statistic, when the
   * window function is an average. Above the threshold means one outlier is
   * sufficient on its own — and therefore that no threshold increase short of
   * that contribution will help.
   */
  singleIntervalContribution?: number;
  /** Intervals in the evaluation window, given the metric's resolution. */
  intervalsInWindow?: number;
}

/**
 * Whether the aggregation, not the threshold, is what makes this monitor fire.
 *
 * `singleIntervalContribution` is the number that settles the argument. For an
 * averaged window, one interval at `peakValue` contributes
 * `peakValue / intervalsInWindow` to the statistic being compared. When that
 * alone exceeds the threshold, the monitor is reporting "one request was slow",
 * and raising the threshold to any value below that contribution changes
 * nothing — which is the trap a `threshold_too_loose` label leads people into.
 */
export function analyzeAggregation(
  parsed: ParsedMonitorQuery,
  options: Record<string, unknown> | undefined,
  peakValue?: number,
  metricResolutionSeconds = 20,
): AggregationFinding {
  const out: AggregationFinding = {
    singlePointSensitive: SINGLE_POINT_WINDOW_FNS.has(parsed.windowFn ?? ""),
  };

  const requireFull = options?.require_full_window;
  if (typeof requireFull === "boolean") out.requiresFullWindow = requireFull;

  if (parsed.windowSeconds && metricResolutionSeconds > 0) {
    out.intervalsInWindow = Math.max(
      1,
      Math.round(parsed.windowSeconds / metricResolutionSeconds),
    );
  }

  if (
    peakValue != null &&
    out.intervalsInWindow &&
    (parsed.windowFn === "avg" || parsed.windowFn === "sum")
  ) {
    out.singleIntervalContribution =
      parsed.windowFn === "sum" ? peakValue : peakValue / out.intervalsInWindow;
  }

  return out;
}
