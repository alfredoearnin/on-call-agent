/**
 * Central configuration, mirroring the YAML block in on-call.md (lines 48-88).
 * Values come from the environment with the on-call.md defaults as fallbacks.
 * Server-only module.
 */

function str(key: string, fallback: string): string {
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
  };
  confluence: {
    spaceKey: string;
    titlePrefix: string;
  };
  apply: {
    enabled: boolean;
    operator: string;
  };
  cronSecret: string;
  /** Noise/tuning thresholds (on-call.md lines 76-88). */
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
