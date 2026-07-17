"use server";

import { revalidatePath } from "next/cache";
import cron from "node-cron";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { runSync, ensureSyncSettings } from "@/lib/ingest/run";
import { SyncMode, SyncTrigger } from "@/lib/constants";

/** Manual "Sync now" trigger from the UI. */
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

export interface SyncSettingsInput {
  mode: string;
  scheduleCron: string;
  timezone: string;
  enabled: boolean;
}

export async function updateSyncSettingsAction(input: SyncSettingsInput) {
  await ensureSyncSettings();

  const mode =
    input.mode === SyncMode.Automatic ? SyncMode.Automatic : SyncMode.Manual;

  if (!cron.validate(input.scheduleCron)) {
    return { ok: false, error: `Invalid cron expression: "${input.scheduleCron}"` };
  }

  let nextRunAt: Date | null = null;
  if (mode === SyncMode.Automatic && input.enabled) {
    const parts = input.scheduleCron.trim().split(/\s+/);
    if (parts.length === 5 && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
      const minute = Number.parseInt(parts[0], 10) || 0;
      const hour = Number.parseInt(parts[1], 10) || 0;
      let next = DateTime.now()
        .setZone(input.timezone)
        .set({ hour, minute, second: 0, millisecond: 0 });
      if (next.toMillis() <= Date.now()) next = next.plus({ days: 1 });
      nextRunAt = next.toJSDate();
    } else {
      nextRunAt = DateTime.now().plus({ days: 1 }).toJSDate();
    }
  }

  await prisma.syncSettings.update({
    where: { id: "singleton" },
    data: {
      mode,
      scheduleCron: input.scheduleCron,
      timezone: input.timezone,
      enabled: input.enabled,
      nextRunAt,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
