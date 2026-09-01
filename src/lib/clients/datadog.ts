import { getConfig, type AppConfig } from "@/lib/config";
import { httpRequest } from "./http";

/** Partial shape of a Datadog monitor (only fields we consume). */
export interface DatadogMonitor {
  id: number;
  name: string;
  query: string;
  message?: string;
  overall_state?: string; // "OK" | "Alert" | "Warn" | "No Data" | ...
  priority?: number | null; // 1..5 (1 = highest) or null
  tags?: string[];
  modified?: string;
  options?: Record<string, unknown>;
  type?: string;
}

/** Partial shape of a Datadog v1 event (only fields we consume). */
export interface DatadogEvent {
  id?: number;
  id_str?: string; // precise id (the numeric `id` loses precision in JS)
  date_happened?: number; // epoch seconds
  alert_type?: string; // error | warning | success | recovery | info
  title?: string;
  text?: string;
  monitor_id?: number;
  tags?: string[];
  priority?: string;
}

function readHeaders(cfg: AppConfig): Record<string, string> {
  return {
    "DD-API-KEY": cfg.datadog.apiKey,
    "DD-APPLICATION-KEY": cfg.datadog.appKey,
  };
}

function writeHeaders(cfg: AppConfig): Record<string, string> {
  return {
    "DD-API-KEY": cfg.datadog.apiKey,
    "DD-APPLICATION-KEY": cfg.datadog.appKeyWrite,
  };
}

export class DatadogClient {
  private cfg: AppConfig;
  constructor(cfg: AppConfig = getConfig()) {
    this.cfg = cfg;
  }

  monitorUrl(id: number | string): string {
    return `${this.cfg.datadog.appBase}/monitors/${id}`;
  }

  /** List monitors scoped to the team tag. */
  async listMonitors(): Promise<DatadogMonitor[]> {
    return httpRequest<DatadogMonitor[]>(
      `${this.cfg.datadog.apiBase}/api/v1/monitor`,
      {
        headers: readHeaders(this.cfg),
        query: { monitor_tags: this.cfg.team.tag, page_size: 1000 },
      },
    );
  }

  async getMonitor(id: number | string): Promise<DatadogMonitor> {
    return httpRequest<DatadogMonitor>(
      `${this.cfg.datadog.apiBase}/api/v1/monitor/${monitorPath(id)}`,
      { headers: readHeaders(this.cfg) },
    );
  }

  /**
   * List alert events for the team over a window (epoch seconds), via the v1
   * events API (individual, unaggregated). Used to reconstruct monitor fire
   * history when incident.io is not configured.
   */
  async searchAlertEvents(
    fromEpoch: number,
    toEpoch: number,
  ): Promise<DatadogEvent[]> {
    const res = await httpRequest<{ events?: DatadogEvent[] }>(
      `${this.cfg.datadog.apiBase}/api/v1/events`,
      {
        headers: readHeaders(this.cfg),
        query: {
          start: fromEpoch,
          end: toEpoch,
          tags: this.cfg.team.tag,
          sources: "alert",
          unaggregated: "true",
        },
      },
    );
    return res.events ?? [];
  }

  /** Query a metric timeseries for baseline grounding (p50/p90/max). */
  async queryMetric(
    query: string,
    fromEpoch: number,
    toEpoch: number,
  ): Promise<number[]> {
    const res = await httpRequest<{
      series?: { pointlist?: [number, number][] }[];
    }>(`${this.cfg.datadog.apiBase}/api/v1/query`, {
      headers: readHeaders(this.cfg),
      query: { from: fromEpoch, to: toEpoch, query },
    });
    const points: number[] = [];
    for (const s of res.series ?? []) {
      for (const [, v] of s.pointlist ?? []) {
        if (typeof v === "number" && Number.isFinite(v)) points.push(v);
      }
    }
    return points;
  }

  /**
   * WRITE — used ONLY by the guarded apply feature. Uses the separate
   * write-scoped application key (least privilege).
   */
  async updateMonitor(
    id: number | string,
    patch: Record<string, unknown>,
  ): Promise<DatadogMonitor> {
    return httpRequest<DatadogMonitor>(
      `${this.cfg.datadog.apiBase}/api/v1/monitor/${monitorPath(id)}`,
      { method: "PUT", headers: writeHeaders(this.cfg), body: patch },
    );
  }

  /**
   * Best-effort Audit Trail: who last modified each monitor in a window.
   * 401/403 means the app key lacks audit_logs_read — callers degrade.
   */
  async searchMonitorAuditActors(
    from: Date,
    to: Date,
  ): Promise<Map<string, MonitorAuditActor>> {
    const res = await httpRequest<{ data?: unknown[] }>(
      `${this.cfg.datadog.apiBase}/api/v2/audit/events`,
      {
        headers: readHeaders(this.cfg),
        query: {
          "filter[from]": from.toISOString(),
          "filter[to]": to.toISOString(),
          "filter[query]": "@asset.type:monitor @action:modified",
          "page[limit]": 1000,
        },
      },
    );
    return parseMonitorAuditActors(res.data ?? []);
  }
}

/** Display name of a Datadog user who modified a monitor — never email. */
export interface MonitorAuditActor {
  name: string;
  at: Date;
}

/**
 * A monitor id safe to interpolate into a request path.
 *
 * `fetch` resolves `..` segments before sending, so an id like
 * `../../../api/v2/team` would point a request — a PUT with the write key
 * attached — at an endpoint the caller chose. Callers validate their input;
 * this encodes it anyway, because a single missed call site here is a
 * credentialed request to somewhere unintended.
 */
function monitorPath(id: number | string): string {
  return encodeURIComponent(String(id));
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  return v as Record<string, unknown>;
}

function walkMonitorIds(v: unknown, into: Set<string>, parentType?: string): void {
  const rec = asRecord(v);
  if (!rec) {
    if (Array.isArray(v)) {
      for (const item of v) walkMonitorIds(item, into, parentType);
    }
    return;
  }
  const type = typeof rec.type === "string" ? rec.type : parentType;
  if (type === "monitor" && rec.id != null && rec.id !== "") {
    into.add(String(rec.id));
  }
  for (const val of Object.values(rec)) {
    if (val && typeof val === "object") walkMonitorIds(val, into, type);
  }
}

/**
 * Display name only. Datadog's `usr.handle` is the user's email address and
 * `usr.uuid` is a stable personal identifier, so neither is an acceptable
 * fallback for a label that lands in the committed database — the UI already
 * reads a missing actor as "Unknown".
 */
function actorNameFrom(usr: Record<string, unknown> | undefined): string | undefined {
  if (!usr) return undefined;
  const name = typeof usr.name === "string" ? usr.name.trim() : "";
  return name || undefined;
}

/**
 * Newest modifier per monitor id. Emails are ignored — redact.ts would strip
 * them, and they must never land in the committed database.
 */
export function parseMonitorAuditActors(events: unknown[]): Map<string, MonitorAuditActor> {
  const byMonitor = new Map<string, MonitorAuditActor>();

  for (const raw of events) {
    const event = asRecord(raw);
    const attrs = asRecord(event?.attributes) ?? event;
    if (!attrs) continue;

    const inner = asRecord(attrs.attributes) ?? attrs;
    const timestampRaw =
      (typeof attrs.timestamp === "string" && attrs.timestamp) ||
      (typeof inner.timestamp === "string" && inner.timestamp) ||
      "";
    const at = timestampRaw ? new Date(timestampRaw) : undefined;
    if (!at || Number.isNaN(at.getTime())) continue;

    const usr = asRecord(inner.usr) ?? asRecord(attrs.usr);
    const name = actorNameFrom(usr);
    if (!name) continue;

    const ids = new Set<string>();
    walkMonitorIds(inner, ids);
    walkMonitorIds(attrs, ids);

    for (const id of ids) {
      const prev = byMonitor.get(id);
      if (!prev || prev.at < at) byMonitor.set(id, { name, at });
    }
  }

  return byMonitor;
}
