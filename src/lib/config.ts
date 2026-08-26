import { AutomationKey } from "@/lib/constants";

/**
 * Central configuration, mirroring the YAML block in the agent prompt (agents/) (lines 48-88).
 * Values come from the environment with the the agent prompt in agents/ defaults as fallbacks.
 * Server-only module.
 */

export function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface AppConfig {
  demoMode: boolean;
  /** "auto" | "confluence" | "demo" | "live". auto = confluence files, else demo/live. */
  syncSource: string;
  team: {
    tag: string;
    label: string;
    timezone: string;
  };
  /**
   * When the rotation actually changes hands, which is the real boundary of an
   * on-call week.
   *
   * Deliberately NOT midnight in team.timezone. The handoff happens Tuesdays at
   * 11:00 in Mexico City, so a week modelled as midnight-to-midnight PT starts
   * and ends ~10h early and mis-attributes every Tuesday-morning page to the
   * primary who was still asleep. `America/Mexico_City` has had no DST since
   * 2022, so this instant is a fixed 17:00 UTC year-round.
   */
  handoff: {
    /** Luxon weekday: Mon=1 ... Sun=7. */
    weekday: number;
    hour: number;
    minute: number;
    timezone: string;
  };
  links: {
    dashboardUrl: string;
    bugsOoslaUrl: string;
    vulnerabilitiesUrl: string;
  };
  datadog: {
    site: string;
    apiBase: string;
    appBase: string;
    apiKey: string;
    appKey: string;
    appKeyWrite: string;
  };
  incidentio: {
    apiBase: string;
    apiKey: string;
  };
  jira: {
    baseUrl: string;
    email: string;
    apiToken: string;
    vulnFilterId: string;
    /**
     * Numeric project and issue-type ids for the prefilled ownership hand-off
     * draft. Jira's `CreateIssueDetails!init.jspa` prefill needs numeric ids,
     * not a project key, and there is no way to derive one from the other
     * without a write-scoped API call. Both empty (the default) degrades to
     * Jira's plain create page plus a copy-ready note, so the feature never
     * depends on this being configured.
     */
    handoffProjectId: string;
    handoffIssueTypeId: string;
  };
  confluence: {
    spaceKey: string;
    titlePrefix: string;
  };
  apply: {
    enabled: boolean;
    operator: string;
  };
  /**
   * The two Cursor Automations that produce this dashboard's data.
   *
   * NON-SECRET ONLY. The webhook URL and API key that can actually start a run
   * live in `src/lib/automations/secrets.ts`, which is `server-only`. Keeping
   * them out of AppConfig is structural: getConfig() is called in every Server
   * Component, so a stray `{...cfg}` spread into a client component would
   * otherwise publish a private endpoint.
   */
  automations: {
    /** The daily slot both automations run in. */
    hour: number;
    minute: number;
    /**
     * IANA zone the slot is expressed in. Deliberately NOT team.timezone: the
     * dashboard displays in PT, but Cursor's scheduler labels this slot "CST"
     * and holds it at a fixed UTC-6 with no DST shift. Measured on origin/main:
     * scheduled `Daily refresh` commits land in a 16:08-16:18 UTC band, i.e. ~10
     * min after a 16:00 UTC slot, not ~70 min after a 15:00 UTC one. So the zone
     * is UTC-6 year-round, which `America/Mexico_City` expresses exactly — and
     * naming it that way keeps the slot pinned to the handoff's own zone.
     */
    timezone: string;
    /**
     * How long after the slot a run may still legitimately be in flight.
     *
     * Sized to span BOTH automations, not one run's latency: `hour` is the
     * earlier slot (health check) and the dashboard refresh follows an hour
     * later, so the last evidence can arrive ~80 min in. A run itself only takes
     * 10-20 min.
     */
    graceMinutes: number;
    /** Header the webhook API key is sent in. Cursor's docs do not name it. */
    authHeader: string;
    /** Optional scheme prefix, e.g. "Bearer" when the header is Authorization. */
    authScheme: string;
    /** cursor.com links, safe to render. */
    consoleUrl: Record<AutomationKey, string>;
  };
  cronSecret: string;
  /** Noise/tuning thresholds (the agent prompt in agents/). */
  thresholds: {
    noiseMinFiresPerWeek: number;
    noiseMinRecurringWeeks: number;
    flagAutoresolvedNoAck: boolean;
    flagNightPages: boolean;
    nodataStaleDays: number;
    lookbackWeeks: number;
    topNInReport: number;
    /** On-call sleeping hours (local tz) for the night-page bar. */
    nightStartHour: number;
    nightEndHour: number;
  };
}

export function getConfig(): AppConfig {
  const site = str("DD_SITE", "datadoghq.com");
  return {
    demoMode: bool("DEMO_MODE", true),
    syncSource: str("SYNC_SOURCE", "auto").toLowerCase(),
    team: {
      tag: str("TEAM_TAG", "team:l2-peng-growth"),
      label: str("TEAM_LABEL", "Growth Team"),
      timezone: str("TIMEZONE", "America/Los_Angeles"),
    },
    handoff: {
      weekday: int("HANDOFF_WEEKDAY", 2),
      hour: int("HANDOFF_HOUR", 11),
      minute: int("HANDOFF_MINUTE", 0),
      timezone: str("HANDOFF_TIMEZONE", "America/Mexico_City"),
    },
    links: {
      dashboardUrl: str(
        "DASHBOARD_URL",
        "https://app.datadoghq.com/dashboard/eu4-i7d-r48/peng-growth-ops-dashboard",
      ),
      bugsOoslaUrl: str(
        "BUGS_OOSLA_URL",
        "https://earnin.atlassian.net/jira/dashboards/10779",
      ),
      vulnerabilitiesUrl: str(
        "VULNERABILITIES_URL",
        "https://earnin.atlassian.net/issues/?filter=15295",
      ),
    },
    datadog: {
      site,
      apiBase: `https://api.${site}`,
      appBase: `https://app.${site}`,
      apiKey: str("DD_API_KEY", ""),
      // Accept DD_APP_KEY or the Datadog-style DD_APPLICATION_KEY.
      appKey: str("DD_APP_KEY", "") || str("DD_APPLICATION_KEY", ""),
      appKeyWrite: str("DD_APP_KEY_WRITE", ""),
    },
    incidentio: {
      apiBase: str("INCIDENT_IO_API_BASE", "https://api.incident.io"),
      apiKey: str("INCIDENT_IO_API_KEY", ""),
    },
    jira: {
      baseUrl: str("JIRA_BASE_URL", "https://earnin.atlassian.net"),
      email: str("JIRA_EMAIL", ""),
      apiToken: str("JIRA_API_TOKEN", ""),
      vulnFilterId: str("JIRA_VULN_FILTER_ID", "15295"),
      handoffProjectId: str("JIRA_HANDOFF_PROJECT_ID", ""),
      handoffIssueTypeId: str("JIRA_HANDOFF_ISSUE_TYPE_ID", ""),
    },
    confluence: {
      // On-call names are parsed from the weekly handoff page the on-call agent
      // publishes (uses the same Atlassian credentials as Jira).
      spaceKey: str(
        "CONFLUENCE_SPACE_KEY",
        "~712020cb7ebe6a714e411e98574e2fb19d5faa",
      ),
      titlePrefix: str(
        "CONFLUENCE_HANDOFF_TITLE_PREFIX",
        "Growth Team Ops Review — Weekly Handoff",
      ),
    },
    apply: {
      enabled: bool("APPLY_ENABLED", false),
      operator: str("OPERATOR_NAME", "local-operator"),
    },
    automations: {
      hour: int("AUTOMATION_HOUR", 12),
      minute: int("AUTOMATION_MINUTE", 0),
      timezone: str("AUTOMATION_TIMEZONE", "America/Mexico_City"),
      graceMinutes: int("AUTOMATION_GRACE_MINUTES", 180),
      authHeader: str("CURSOR_WEBHOOK_AUTH_HEADER", "x-api-key"),
      authScheme: str("CURSOR_WEBHOOK_AUTH_SCHEME", ""),
      consoleUrl: {
        [AutomationKey.HealthCheck]: str(
          "CURSOR_HEALTH_CHECK_URL",
          "https://cursor.com/automations/26df3cd5-bf0c-4b4c-ba6a-95e18eab3c69",
        ),
        [AutomationKey.DashboardRefresh]: str(
          "CURSOR_DASHBOARD_REFRESH_URL",
          "https://cursor.com/automations/ea0cbef2-8467-11f1-a7d1-d6b4613131ce",
        ),
      },
    },
    cronSecret: str("CRON_SECRET", ""),
    thresholds: {
      noiseMinFiresPerWeek: int("NOISE_MIN_FIRES_PER_WEEK", 3),
      noiseMinRecurringWeeks: int("NOISE_MIN_RECURRING_WEEKS", 2),
      flagAutoresolvedNoAck: bool("NOISE_FLAG_AUTORESOLVED_NO_ACK", true),
      flagNightPages: bool("NOISE_FLAG_NIGHT_PAGES", true),
      nodataStaleDays: int("NODATA_STALE_DAYS", 14),
      lookbackWeeks: int("TUNING_LOOKBACK_WEEKS", 6),
      topNInReport: int("TUNING_TOP_N_IN_REPORT", 5),
      nightStartHour: int("NIGHT_START_HOUR", 22),
      nightEndHour: int("NIGHT_END_HOUR", 7),
    },
  };
}

/** True when real Datadog read credentials are present. */
export function hasDatadogRead(cfg: AppConfig): boolean {
  return Boolean(cfg.datadog.apiKey && cfg.datadog.appKey);
}

/** True when real incident.io credentials are present. */
export function hasIncidentIo(cfg: AppConfig): boolean {
  return Boolean(cfg.incidentio.apiKey);
}

/** True when Jira vulnerability lookups are configured. */
export function hasJira(cfg: AppConfig): boolean {
  return Boolean(cfg.jira.email && cfg.jira.apiToken);
}

/** Confluence (on-call names) reuses the same Atlassian credentials as Jira. */
export function hasConfluence(cfg: AppConfig): boolean {
  return hasJira(cfg);
}

/** True when the guarded apply write path is fully enabled. */
export function canApply(cfg: AppConfig): boolean {
  return cfg.apply.enabled && Boolean(cfg.datadog.appKeyWrite);
}

/**
 * True when this install is fed by the two cloud Cursor Automations. In demo and
 * live mode there are no automations to judge, so the health card renders nothing.
 */
export function hasCloudAutomations(cfg: AppConfig): boolean {
  return cfg.syncSource === "confluence" || cfg.syncSource === "auto";
}
