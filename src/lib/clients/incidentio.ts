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

/**
 * Partial incident.io v2 escalation — a page that actually reached a human.
 *
 * This is the only source for who was woken and how fast they responded. An
 * alert firing and a person being paged are different events: an alert whose
 * escalation was `cancelled` resolved before anyone had to look, which is the
 * difference between noise that cost someone their evening and noise that did
 * not. `paged_users` carries display names only — never handles or emails,
 * which redact.ts would strip and which must not reach the committed database.
 */
export interface IncidentIoEscalation {
  id: string;
  title?: string;
  status?: string; // triggered | acked | resolved | expired | cancelled | ...
  created_at?: string;
  acked_at?: string;
  acked_by?: { name?: string };
  paged_users?: { name?: string }[];
  priority?: { name?: string };
  escalation_path?: { id?: string; name?: string };
  alert_id?: string;
  alert_title?: string;
}

/**
 * Every string leaf under an alert's attribute values.
 *
 * The Service attribute's position and nesting are not part of the API
 * contract we depend on, so this walks rather than indexes. Comparison is
 * exact because service slugs nest: a substring match for `svc-user` would
 * also claim every `svc-user-state-*` alert.
 */
function attributeStrings(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    into.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) attributeStrings(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) attributeStrings(item, into);
  }
}

function alertMatchesService(alert: IncidentIoAlert, service: string): boolean {
  if (!alert.attribute_values) return false;
  const strings = new Set<string>();
  attributeStrings(alert.attribute_values, strings);
  return strings.has(service);
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
    stopAfterPage?: (page: T[]) => boolean,
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
      // The page is kept before stopping: a caller bounding by date wants the
      // page that straddles its cutoff, not only the pages fully inside it.
      if (stopAfterPage?.(items)) break;
    }
    return out;
  }

  listAlerts(): Promise<IncidentIoAlert[]> {
    return this.paginate<IncidentIoAlert>("/v2/alerts", "alerts");
  }

  /**
   * Alerts for one service since a cutoff.
   *
   * Filtering happens here rather than in the query string: the v2 list
   * endpoints' filter parameter names are not something this client has
   * verified, and an unrecognised parameter is ignored silently rather than
   * rejected — which would return every alert in the org while looking like it
   * had filtered. Paginating and filtering in code is slower and certainly
   * correct. `createdAfter` still bounds the work, because results arrive
   * newest-first and `paginate` stops at the first page that is entirely older.
   */
  async listAlertsForService(
    service: string,
    createdAfter: Date,
  ): Promise<IncidentIoAlert[]> {
    const alerts = await this.paginate<IncidentIoAlert>(
      "/v2/alerts",
      "alerts",
      {},
      (page) => page.every((a) => olderThan(a.created_at, createdAfter)),
    );
    return alerts.filter(
      (a) =>
        !olderThan(a.created_at, createdAfter) &&
        alertMatchesService(a, service),
    );
  }

  /**
   * Escalations since a cutoff — the pages that actually reached a human.
   *
   * Not filtered by service: an escalation carries the alert's title and id but
   * not its attributes, so callers join on `alert_id` against
   * `listAlertsForService`.
   */
  async listEscalations(createdAfter: Date): Promise<IncidentIoEscalation[]> {
    const escalations = await this.paginate<IncidentIoEscalation>(
      "/v2/escalations",
      "escalations",
      {},
      (page) => page.every((e) => olderThan(e.created_at, createdAfter)),
    );
    return escalations.filter((e) => !olderThan(e.created_at, createdAfter));
  }

  listIncidents(): Promise<IncidentIoIncident[]> {
    return this.paginate<IncidentIoIncident>("/v2/incidents", "incidents");
  }

  listSchedules(): Promise<IncidentIoSchedule[]> {
    return this.paginate<IncidentIoSchedule>("/v2/schedules", "schedules");
  }
}

/** True when a timestamp is missing or strictly before the cutoff. */
function olderThan(iso: string | undefined, cutoff: Date): boolean {
  if (!iso) return true;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) || at < cutoff;
}
