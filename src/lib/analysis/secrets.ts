import "server-only";

import { str } from "@/lib/config";

/**
 * The credential for the interpretation step.
 *
 * Deliberately NOT part of AppConfig, for the same reason as the Cursor webhook
 * secrets: getConfig() runs in every Server Component, so a stray `{...cfg}`
 * spread would publish the key to the browser. Keeping it behind a
 * `server-only` module makes that a build error rather than something a
 * reviewer has to catch.
 *
 * Never log it, never return it from a server action, never persist it.
 */
const ENV_KEY = "ANTHROPIC_API_KEY";

export function anthropicApiKey(): string {
  return str(ENV_KEY, "");
}

/**
 * True when the interpretation step is configured.
 *
 * Presence is the opt-in, following hasDatadogRead / canTriggerAutomation
 * rather than canApply: an API key exists for no purpose here other than
 * running an analysis, so there is nothing a separate enable flag would add.
 * Evidence collection is gated separately — it needs Datadog and incident.io
 * reads, and is useful on its own even when interpretation is unavailable.
 */
export function canInterpret(): boolean {
  return Boolean(anthropicApiKey());
}

/** The env var names, for "how do I configure this" copy. */
export function analysisEnvNames(): string[] {
  return [ENV_KEY];
}
