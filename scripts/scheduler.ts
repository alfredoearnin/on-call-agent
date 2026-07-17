/**
 * Automatic sync worker. Run with `npm run scheduler`. A long-lived node-cron
 * process that fires the sync on the configured schedule — but only when the
 * user has set Settings.mode = "automatic" and enabled = true. Re-reads settings
 * on every tick so toggling from the UI takes effect without code changes.
 *
 * Change the cron expression from the Settings page, then restart this worker.
 */
import "@/lib/load-env";
import cron from "node-cron";
import { prisma } from "@/lib/db";
import { ensureSyncSettings, runSync } from "@/lib/ingest/run";
import { SyncMode, SyncTrigger } from "@/lib/constants";

async function main() {
  const settings = await ensureSyncSettings();

  if (!cron.validate(settings.scheduleCron)) {
    console.error(
      `[scheduler] invalid cron "${settings.scheduleCron}" — fix it on the Settings page.`,
    );
    process.exit(1);
  }

  console.log(
    `[scheduler] started. schedule="${settings.scheduleCron}" tz=${settings.timezone} ` +
      `mode=${settings.mode} enabled=${settings.enabled}`,
  );
  console.log("[scheduler] waiting for scheduled ticks (Ctrl+C to stop)...");

  cron.schedule(
    settings.scheduleCron,
    async () => {
      const current = await ensureSyncSettings();
      if (current.mode !== SyncMode.Automatic || !current.enabled) {
        console.log(
          `[scheduler] tick skipped (mode=${current.mode} enabled=${current.enabled}).`,
        );
        return;
      }
      console.log(`[scheduler] tick — running sync at ${new Date().toISOString()}`);
      const outcome = await runSync({ trigger: SyncTrigger.Scheduler });
      console.log(
        `[scheduler] sync ${outcome.ok ? "ok" : "not ok"} status=${outcome.status ?? outcome.message}`,
      );
    },
    { timezone: settings.timezone },
  );
}

main().catch((err) => {
  console.error("[scheduler] fatal:", err);
  process.exit(1);
});
