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
      `${this.cfg.datadog.apiBase}/api/v1/monitor/${id}`,
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
      `${this.cfg.datadog.apiBase}/api/v1/monitor/${id}`,
      { method: "PUT", headers: writeHeaders(this.cfg), body: patch },
    );
  }
}
