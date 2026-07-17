import { getConfig, type AppConfig } from "@/lib/config";
import { httpRequest } from "./http";

/** Partial incident.io v2 alert (only fields we consume). */
export interface IncidentIoAlert {
  id: string;
  title?: string;
  status?: string; // "firing" | "resolved"
  created_at?: string;
  resolved_at?: string;
  deduplication_key?: string;
  alert_source_id?: string;
  priority?: { name?: string };
  attribute_values?: Record<string, unknown>;
}

export interface IncidentIoIncident {
  id: string;
  reference?: string;
  name?: string;
  summary?: string;
  status?: string;
  severity?: { name?: string; rank?: number };
  incident_type?: { name?: string };
  created_at?: string;
  updated_at?: string;
  permalink?: string;
}

export interface IncidentIoSchedule {
  id: string;
  name?: string;
  current_shifts?: {
    user?: { name?: string };
    layer_id?: string;
  }[];
}

interface Paginated<T> {
  pagination_meta?: { after?: string; page_size?: number };
  [key: string]: unknown;
  // the array lives under a resource key (alerts / incidents / schedules)
}

export class IncidentIoClient {
  private cfg: AppConfig;
  constructor(cfg: AppConfig = getConfig()) {
    this.cfg = cfg;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.cfg.incidentio.apiKey}` };
  }

  private async paginate<T>(
    path: string,
    key: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T[]> {
    const out: T[] = [];
    let after: string | undefined;
    // Hard cap to respect rate limits / avoid runaway loops.
    for (let page = 0; page < 20; page++) {
      const res = await httpRequest<Paginated<T>>(
        `${this.cfg.incidentio.apiBase}${path}`,
        {
          headers: this.headers(),
          query: { page_size: 250, after, ...query },
        },
      );
      const items = (res[key] as T[]) ?? [];
      out.push(...items);
      after = res.pagination_meta?.after;
      if (!after || items.length === 0) break;
    }
    return out;
  }

  listAlerts(): Promise<IncidentIoAlert[]> {
    return this.paginate<IncidentIoAlert>("/v2/alerts", "alerts");
  }

  listIncidents(): Promise<IncidentIoIncident[]> {
    return this.paginate<IncidentIoIncident>("/v2/incidents", "incidents");
  }

  listSchedules(): Promise<IncidentIoSchedule[]> {
    return this.paginate<IncidentIoSchedule>("/v2/schedules", "schedules");
  }
}
