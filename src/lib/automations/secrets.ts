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
}

const ENV_KEYS: Record<AutomationKey, { url: string; key: string }> = {
  [AutomationKey.HealthCheck]: {
    url: "CURSOR_HEALTH_CHECK_WEBHOOK_URL",
    key: "CURSOR_HEALTH_CHECK_API_KEY",
  },
  [AutomationKey.DashboardRefresh]: {
    url: "CURSOR_DASHBOARD_REFRESH_WEBHOOK_URL",
    key: "CURSOR_DASHBOARD_REFRESH_API_KEY",
  },
};

export function automationSecret(key: AutomationKey): AutomationSecret {
  const names = ENV_KEYS[key];
  return { webhookUrl: str(names.url, ""), apiKey: str(names.key, "") };
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
