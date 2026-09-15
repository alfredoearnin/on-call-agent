import "server-only";

import { AutomationKey } from "@/lib/constants";
import { str } from "@/lib/config";

/**
 * The credentials that can actually start a Cursor Automation run.
 *
 * Deliberately NOT part of AppConfig. getConfig() is called in every Server
 * Component, so a stray `{...cfg}` spread would publish a private endpoint to the
 * browser. Keeping these behind a `server-only` module makes that a build error
 * instead of a review catch.
 *
 * `server-only` cannot go on config.ts itself: the package throws unless resolved
 * under the `react-server` export condition, and `scripts/ingest.ts` reaches
 * config.ts through runSync under plain tsx. Adding it there breaks
 * `npm run ingest` — and therefore the daily-refresh automation.
 *
 * Never log these, never return them from a server action, never persist them.
 */
export interface AutomationSecret {
  webhookUrl: string;
  apiKey: string;
  /**
   * How this automation wants the key presented, when it differs from the
   * global CURSOR_WEBHOOK_AUTH_HEADER / _SCHEME.
   *
   * Cursor does not use one scheme for every webhook. The two chain
   * automations authenticate with a bare `x-api-key`, and the
   * cause-investigation one rejects that with HTTP 401 and wants
   * `Authorization: Bearer`. A single global setting cannot express both, and
   * changing it to suit one would silently break the others — so the override
   * is per automation and the global values remain the default.
   */
  authHeader?: string;
  authScheme?: string;
}

interface AutomationEnvNames {
  url: string;
  key: string;
  /** Env var for a per-automation header override. */
  header: string;
  /** Env var for a per-automation scheme override. */
  scheme: string;
  /** Used when the override env vars are unset. Empty = use the global setting. */
  defaultHeader?: string;
  defaultScheme?: string;
}

const ENV_KEYS: Record<AutomationKey, AutomationEnvNames> = {
  [AutomationKey.HealthCheck]: {
    url: "CURSOR_HEALTH_CHECK_WEBHOOK_URL",
    key: "CURSOR_HEALTH_CHECK_API_KEY",
    header: "CURSOR_HEALTH_CHECK_AUTH_HEADER",
    scheme: "CURSOR_HEALTH_CHECK_AUTH_SCHEME",
  },
  [AutomationKey.DashboardRefresh]: {
    url: "CURSOR_DASHBOARD_REFRESH_WEBHOOK_URL",
    key: "CURSOR_DASHBOARD_REFRESH_API_KEY",
    header: "CURSOR_DASHBOARD_REFRESH_AUTH_HEADER",
    scheme: "CURSOR_DASHBOARD_REFRESH_AUTH_SCHEME",
  },
  [AutomationKey.CauseInvestigation]: {
    url: "CURSOR_CAUSE_INVESTIGATION_WEBHOOK_URL",
    key: "CURSOR_CAUSE_INVESTIGATION_API_KEY",
    header: "CURSOR_CAUSE_INVESTIGATION_AUTH_HEADER",
    scheme: "CURSOR_CAUSE_INVESTIGATION_AUTH_SCHEME",
    // Observed, not guessed: this endpoint returned HTTP 401 to the global
    // `x-api-key` and accepts `Authorization: Bearer`.
    defaultHeader: "Authorization",
    defaultScheme: "Bearer",
  },
};

export function automationSecret(key: AutomationKey): AutomationSecret {
  const names = ENV_KEYS[key];
  const authHeader = str(names.header, names.defaultHeader ?? "");
  const authScheme = str(names.scheme, names.defaultScheme ?? "");
  return {
    webhookUrl: str(names.url, ""),
    apiKey: str(names.key, ""),
    // Empty means "no override" — the client then uses the global setting.
    authHeader: authHeader || undefined,
    authScheme: authScheme || undefined,
  };
}

/**
 * True when this automation's webhook trigger is fully configured.
 *
 * There is no separate AUTOMATIONS_ENABLED flag on purpose. APPLY_ENABLED earns
 * its keep because DD_APP_KEY_WRITE could plausibly be present for another
 * reason; a Cursor webhook URL and key exist for no purpose other than starting
 * that one automation, so their presence IS the opt-in. This follows the
 * hasDatadogRead / hasIncidentIo precedent rather than canApply.
 */
export function canTriggerAutomation(key: AutomationKey): boolean {
  const { webhookUrl, apiKey } = automationSecret(key);
  return Boolean(webhookUrl && apiKey);
}

/** The env var names for one automation, for "how do I configure this" copy. */
export function automationEnvNames(key: AutomationKey): string[] {
  return [ENV_KEYS[key].url, ENV_KEYS[key].key];
}
