/**
 * Cursor Automations — webhook trigger client.
 *
 * Cursor exposes no API to list automations, read a run's status, or re-run a
 * failed run. The only supported external entry point is an automation's webhook
 * trigger: POST a private URL to start a run. The response carries no run id and
 * no status, so this client is fire-and-forget BY CONSTRUCTION — there is
 * deliberately no read method to pair with the trigger, and callers must never
 * present a 2xx as "the run succeeded".
 *
 * The webhook URL and its API key are secrets. They are never logged, never
 * placed in a returned message, and never persisted. (Note the repo has a logs/
 * directory: if request logging is ever added to http.ts, the webhook URL would
 * go to disk.)
 */

import { getConfig, type AppConfig } from "@/lib/config";
import { httpRequest, HttpError } from "@/lib/clients/http";
import { AutomationKey } from "@/lib/constants";
import { automationSecret } from "@/lib/automations/secrets";
import { triggerFailureMessage } from "@/lib/automations/meta";

export interface TriggerOutcome {
  ok: boolean;
  /** Safe user-facing text. Never contains the URL, the key, or a response body. */
  message: string;
  /** HTTP status when Cursor returned one; absent for timeouts and network errors. */
  status?: number;
}

/** TRIGGER headers — the only outbound header set this client builds. */
function triggerHeaders(cfg: AppConfig, apiKey: string): Record<string, string> {
  const { authHeader, authScheme } = cfg.automations;
  return { [authHeader]: authScheme ? `${authScheme} ${apiKey}` : apiKey };
}

export class CursorAutomationsClient {
  private cfg: AppConfig;

  constructor(cfg: AppConfig = getConfig()) {
    this.cfg = cfg;
  }

  /**
   * TRIGGER — start a run of `key`'s automation via its webhook.
   *
   * `ok: true` means Cursor ACCEPTED the request, not that the run succeeded.
   * Never throws; never leaks the endpoint or the key into the result.
   */
  async triggerAutomation(
    key: AutomationKey,
    label: string,
  ): Promise<TriggerOutcome> {
    const { webhookUrl, apiKey } = automationSecret(key);
    try {
      await httpRequest<unknown>(webhookUrl, {
        method: "POST",
        headers: triggerHeaders(this.cfg, apiKey),
        // Cursor's docs do not specify a body for webhook triggers. `{}` is the
        // minimal valid JSON payload and makes httpRequest set Content-Type.
        body: {},
        timeoutMs: 10_000,
        // retries: 0 — a webhook POST is NOT idempotent and Cursor offers no
        // idempotency key. httpRequest otherwise retries 429, 5xx AND network or
        // abort errors, so a retry after a gateway timeout on a request that
        // actually landed would start a SECOND concurrent run. For automation #2
        // that means two agents each opening and merging a PR to main — exactly
        // the conflict failure mode daily-refresh.md's "Why the merge is
        // synchronous" section documents. A duplicate run is strictly worse than a
        // failed trigger: the user is standing at the button and can click again
        // knowingly. Do not "fix" this to the 3-retry default.
        retries: 0,
      });
      return { ok: true, message: `${label} triggered in Cursor.` };
    } catch (err) {
      return {
        ok: false,
        message: triggerFailureMessage(err, label),
        status: err instanceof HttpError ? err.status : undefined,
      };
    }
  }
}
