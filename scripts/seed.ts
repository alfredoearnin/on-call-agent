/**
 * Seed: ensure SyncSettings defaults exist, and populate the committed SQLite
 * "memory" DB with an initial snapshot if it is empty. Idempotent.
 */
import "@/lib/load-env";
import { prisma } from "@/lib/db";
import { ensureSyncSettings, runSync } from "@/lib/ingest/run";
import { SyncTrigger } from "@/lib/constants";

async function main() {
  await ensureSyncSettings();
  console.log("[seed] SyncSettings ready.");

  const runCount = await prisma.ingestionRun.count();
  if (runCount === 0) {
    console.log("[seed] empty DB — running an initial sync to seed memory...");
    const outcome = await runSync({ trigger: SyncTrigger.ManualCLI });
    console.log(`[seed] initial sync status=${outcome.status ?? "n/a"}`);
  } else {
    console.log(`[seed] DB already has ${runCount} run(s) — nothing to seed.`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[seed] error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
