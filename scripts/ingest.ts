/**
 * CLI: run one sync now. Used by `npm run ingest`, OS cron/launchd, and init.sh.
 */
import "@/lib/load-env";
import { runSync } from "@/lib/ingest/run";
import { SyncTrigger } from "@/lib/constants";

async function main() {
  const started = Date.now();
  console.log("[ingest] starting sync...");
  const outcome = await runSync({ trigger: SyncTrigger.ManualCLI });

  if (outcome.skipped) {
    console.log(`[ingest] skipped: ${outcome.message}`);
    process.exit(0);
  }
  if (!outcome.ok) {
    console.error(`[ingest] FAILED: ${outcome.message}`);
    process.exit(1);
  }
  const k = outcome.kpis;
  console.log(
    `[ingest] done in ${Date.now() - started}ms — status=${outcome.status}` +
      (k
        ? ` | alerts=${k.totalAlerts} (H${k.highAlerts}/L${k.lowAlerts}) active=${k.activeFiring} stale=${k.staleFiring} runRate=${k.runRateWeekly}/wk`
        : ""),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[ingest] unexpected error:", err);
  process.exit(1);
});
