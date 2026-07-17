import {
  type AppConfig,
  hasDatadogRead,
  hasIncidentIo,
  hasJira,
} from "@/lib/config";
import {
  Priority,
  MonitorState,
  AlertDisposition,
  FiringKind,
  IncidentClass,
  SourceStatus,
} from "@/lib/constants";
import {
  DatadogClient,
  type DatadogMonitor,
  type DatadogEvent,
} from "@/lib/clients/datadog";
import { IncidentIoClient } from "@/lib/clients/incidentio";
import { JiraClient } from "@/lib/clients/jira";
import type {
  IngestBundle,
  NormalizedAlert,
  NormalizedIncident,
  NormalizedMonitor,
} from "@/lib/ingest/types";
import { toEpochSeconds, type OpsWindow } from "@/lib/ingest/window";

function mapState(overall?: string): MonitorState {
  switch ((overall ?? "").toLowerCase()) {
    case "ok":
      return MonitorState.OK;
    case "alert":
      return MonitorState.Alert;
    case "warn":
      return MonitorState.Warn;
    case "no data":
      return MonitorState.NoData;
    default:
      return MonitorState.Unknown;
  }
}

function mapPriority(m: DatadogMonitor): Priority {
  // Datadog's explicit monitor priority (P1-P5) wins when set.
  if (m.priority != null) return m.priority <= 2 ? Priority.High : Priority.Low;
  // Otherwise infer from routing handles. Precise per-alert High/Low needs
  // incident.io; this is a monitor-level approximation.
  const msg = (m.message ?? "").toLowerCase();
  const high = msg.includes("incidentio-high") || msg.includes("pagerduty");
  const low = msg.includes("incidentio-low");
  if (low && !high) return Priority.Low;
  return high ? Priority.High : Priority.Low;
}

function deriveEnv(query?: string): string {
  const q = query ?? "";
  if (/env:prod|cluster_flavor:prod/.test(q)) return "prod";
  if (/dev-eks|env:dev|cluster_flavor:dev/.test(q)) return "dev";
  return "unscoped";
}

function deriveCluster(query?: string): string | undefined {
  const m = /kube_cluster_name:([\w-]+)/.exec(query ?? "");
  if (m) return m[1];
  if ((query ?? "").includes("production-eks")) return "production-eks-cluster";
  return undefined;
}

function deriveService(m: DatadogMonitor): string | undefined {
  const svc = /service:([\w-]+)/.exec(m.query ?? "");
  if (svc) return svc[1];
  const job = /\[([\w-]+)\]/.exec(m.name);
  return job?.[1];
}

function mapMonitors(raw: DatadogMonitor[], dd: DatadogClient): NormalizedMonitor[] {
  return raw.map((m) => ({
    id: String(m.id),
    name: m.name,
    service: deriveService(m),
    priority: mapPriority(m),
    tags: m.tags ?? [],
    state: mapState(m.overall_state),
    query: m.query,
    message: m.message,
    datadogUrl: dd.monitorUrl(m.id),
    envScope: deriveEnv(m.query),
    cluster: deriveCluster(m.query),
    modifiedAt: m.modified ? new Date(m.modified) : undefined,
    options: m.options,
  }));
}

function extractMonitorId(title: string): string | undefined {
  const m = /monitor\s*[#]?(\d{5,})/i.exec(title);
  return m?.[1];
}

/**
 * Build a normalized bundle from live sources. Each source is isolated so an
 * outage degrades gracefully (on-call.md fallbacks) instead of failing the run.
 * Recommendations are computed downstream by the tuning classifier.
 */
export async function buildLiveBundle(
  cfg: AppConfig,
  window: OpsWindow,
): Promise<IngestBundle> {
  const sourceStatus: IngestBundle["sourceStatus"] = {
    datadog: SourceStatus.Skipped,
    incidentio: SourceStatus.Skipped,
    jira: SourceStatus.Skipped,
  };
  const notes: string[] = [];

  const dd = new DatadogClient(cfg);
  let monitors: NormalizedMonitor[] = [];

  if (hasDatadogRead(cfg)) {
    try {
      const raw = await dd.listMonitors();
      monitors = mapMonitors(raw, dd);
      sourceStatus.datadog = SourceStatus.OK;
    } catch (err) {
      sourceStatus.datadog = SourceStatus.Unavailable;
      notes.push(`Datadog unavailable: ${(err as Error).message}`);
    }
  }
  const stateById = new Map(monitors.map((m) => [m.id, m.state] as const));

  // Datadog-derived alerts from monitor events (fire history). This is the
  // primary alert source when incident.io is not configured.
  let datadogAlerts: NormalizedAlert[] = [];
  if (sourceStatus.datadog === SourceStatus.OK) {
    try {
      const events = await dd.searchAlertEvents(
        toEpochSeconds(window.priorStart),
        toEpochSeconds(window.end),
      );
      datadogAlerts = deriveAlertsFromEvents(events, monitors);
    } catch (err) {
      notes.push(`Datadog events unavailable: ${(err as Error).message}`);
    }
  }

  const iioAlerts: NormalizedAlert[] = [];
  const incidents: NormalizedIncident[] = [];

  if (hasIncidentIo(cfg)) {
    const iio = new IncidentIoClient(cfg);
    try {
      const raw = await iio.listAlerts();
      for (const a of raw) {
        const firedAt = a.created_at ? new Date(a.created_at) : window.start;
        const resolvedAt = a.resolved_at ? new Date(a.resolved_at) : undefined;
        const status = a.status ?? (resolvedAt ? "resolved" : "firing");
        const title = a.title ?? "(untitled alert)";
        const monitorId = extractMonitorId(title);
        const monState = monitorId ? stateById.get(monitorId) : undefined;
        const firingKind =
          status === "resolved"
            ? FiringKind.Resolved
            : monState === MonitorState.Alert || monState === MonitorState.Warn
              ? FiringKind.Active
              : FiringKind.Stale;
        iioAlerts.push({
          id: a.id,
          monitorId,
          source: "incident.io",
          title,
          priority:
            (a.priority?.name ?? "").toLowerCase().includes("high") ||
            (a.priority?.name ?? "").toLowerCase().startsWith("p1") ||
            (a.priority?.name ?? "").toLowerCase().startsWith("p2")
              ? Priority.High
              : Priority.Low,
          status,
          disposition:
            status === "resolved" ? AlertDisposition.AutoResolved : undefined,
          firingKind,
          firedAt,
          resolvedAt,
          env: monitorId ? deriveEnvFromState(monState) : undefined,
          timesFired: 1,
        });
      }
      sourceStatus.incidentio = SourceStatus.OK;
    } catch (err) {
      sourceStatus.incidentio = SourceStatus.Unavailable;
      notes.push(`incident.io unavailable: ${(err as Error).message}`);
    }

    try {
      const rawInc = await iio.listIncidents();
      for (const inc of rawInc) {
        const openedAt = inc.created_at ? new Date(inc.created_at) : window.start;
        if (openedAt < window.start || openedAt > window.end) continue;
        const sevRank = inc.severity?.rank ?? 99;
        incidents.push({
          id: inc.id,
          title: inc.name ?? inc.summary ?? inc.reference ?? "(incident)",
          severity: inc.severity?.name,
          classification:
            sevRank <= 2
              ? IncidentClass.ProductionCustomerImpact
              : IncidentClass.Operational,
          service: inc.incident_type?.name,
          status: inc.status,
          openedAt,
          url: inc.permalink,
        });
      }
    } catch (err) {
      notes.push(`incident.io incidents unavailable: ${(err as Error).message}`);
    }
  }

  // Merge: prefer incident.io alerts (they carry ack/escalation detail); add
  // Datadog fires with no incident.io match (same monitor within ~10 min).
  const TEN_MIN = 10 * 60 * 1000;
  const unmatched = datadogAlerts.filter(
    (d) =>
      !iioAlerts.some(
        (i) =>
          !!i.monitorId &&
          i.monitorId === d.monitorId &&
          Math.abs(i.firedAt.getTime() - d.firedAt.getTime()) < TEN_MIN,
      ),
  );
  const alerts = [...iioAlerts, ...unmatched];

  let vuln: IngestBundle["vuln"];
  if (hasJira(cfg)) {
    try {
      const counts = await new JiraClient(cfg).vulnerabilityCounts();
      vuln = {
        ...counts,
        scope: "org-wide",
        source: `Jira filter ${cfg.jira.vulnFilterId}`,
      };
      sourceStatus.jira = SourceStatus.OK;
    } catch (err) {
      sourceStatus.jira = SourceStatus.Unavailable;
      notes.push(`Jira unavailable: ${(err as Error).message}`);
    }
  }

  return {
    monitors,
    alerts,
    incidents,
    recommendations: [], // filled by the classifier in run.ts
    vuln,
    sourceStatus,
    notes: notes.join(" | ") || undefined,
  };
}

/** Strip a leading "[Warn on …]" / "[Triggered]" / "[Recovered]" prefix. */
function cleanTitle(t: string): string {
  return t.replace(/^\[[^\]]*\]\s*/, "").trim();
}

/**
 * Reconstruct alert fires from Datadog v1 monitor events. warning/error =
 * a fire; the next success event = its recovery. One AlertFire per fire event,
 * keyed by the event id (idempotent). Ack/escalation is unknown from Datadog
 * alone (that needs incident.io), so disposition is left unset.
 */
function deriveAlertsFromEvents(
  events: DatadogEvent[],
  monitors: NormalizedMonitor[],
): NormalizedAlert[] {
  const byId = new Map(monitors.map((m) => [m.id, m] as const));
  const groups = new Map<string, DatadogEvent[]>();
  for (const e of events) {
    if (!e.monitor_id || !e.date_happened) continue;
    const key = String(e.monitor_id);
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(e);
  }

  const out: NormalizedAlert[] = [];
  for (const [monId, evs] of groups) {
    evs.sort((a, b) => (a.date_happened ?? 0) - (b.date_happened ?? 0));
    const recoveries = evs
      .filter((e) => e.alert_type === "success")
      .map((e) => (e.date_happened ?? 0) * 1000);
    const mon = byId.get(monId);

    for (const e of evs) {
      if (e.alert_type !== "warning" && e.alert_type !== "error") continue;
      const firedMs = (e.date_happened ?? 0) * 1000;
      const recMs = recoveries.find((r) => r > firedMs);
      const status = recMs ? "resolved" : "firing";
      const firingKind =
        status === "resolved"
          ? FiringKind.Resolved
          : mon?.state === MonitorState.Alert || mon?.state === MonitorState.Warn
            ? FiringKind.Active
            : FiringKind.Stale;
      const firedAt = new Date(firedMs);
      const resolvedAt = recMs ? new Date(recMs) : undefined;
      out.push({
        id: `dd-${e.id_str ?? e.id}`,
        monitorId: byId.has(monId) ? monId : undefined,
        source: "datadog",
        title: mon?.name ?? cleanTitle(e.title ?? "(alert)"),
        priority: mon?.priority ?? Priority.Low,
        status,
        firingKind,
        firedAt,
        resolvedAt,
        env: mon?.envScope,
        cluster: mon?.cluster,
        timesFired: 1,
        finding: `Datadog ${e.alert_type} at ${firedAt.toISOString()}${
          resolvedAt ? `, recovered ${resolvedAt.toISOString()}` : ", still firing"
        }. Ack/escalation detail requires incident.io.`,
      });
    }
  }
  return out;
}

function deriveEnvFromState(state?: MonitorState): string | undefined {
  if (!state) return undefined;
  return state === MonitorState.OK || state === MonitorState.NoData
    ? "prod"
    : "prod";
}
