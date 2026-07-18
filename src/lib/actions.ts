"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/ingest/run";
import { getConfig } from "@/lib/config";
import { SyncTrigger } from "@/lib/constants";

/** Manual "Sync now" trigger from the UI (re-parses the current source). */
export async function syncNowAction() {
  const outcome = await runSync({ trigger: SyncTrigger.ManualUI });
  revalidatePath("/", "layout");
  return {
    ok: outcome.ok,
    skipped: outcome.skipped ?? false,
    status: outcome.status ?? null,
    message: outcome.message ?? null,
  };
}

/**
 * "Refresh from source": POST to the cloud Health Check agent's webhook, which
 * regenerates the Confluence pages and (chained) runs the daily sync. This is
 * asynchronous — the cloud run takes minutes, then pushes the updated SQLite to
 * main; run `git pull` afterward to see it locally.
 */
export async function refreshFromSourceAction() {
  const cfg = getConfig();
  if (!cfg.refresh.webhookUrl) {
    return {
      ok: false,
      message:
        "Refresh webhook not configured. Set HEALTHCHECK_WEBHOOK_URL (+ optional HEALTHCHECK_WEBHOOK_SECRET).",
    };
  }
  try {
    const res = await fetch(cfg.refresh.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.refresh.webhookSecret
          ? { Authorization: `Bearer ${cfg.refresh.webhookSecret}` }
          : {}),
      },
      body: JSON.stringify({ source: "dashboard", reason: "manual refresh" }),
    });
    if (!res.ok) {
      return { ok: false, message: `Webhook returned HTTP ${res.status}.` };
    }
    return {
      ok: true,
      message:
        "Refresh started — the cloud agent is regenerating Confluence and syncing. Run `git pull` in a few minutes to see it.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Failed to trigger refresh: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
