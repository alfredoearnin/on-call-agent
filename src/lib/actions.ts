"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/ingest/run";
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
