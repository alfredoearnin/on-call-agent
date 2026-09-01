/**
 * Insert a reconstructed "before" config snapshot for one monitor.
 *
 * Only for edits that landed in Datadog before the dashboard ever captured
 * that monitor's config, which makes the real prior config unrecoverable from
 * the database. Everything except the replaced snippet is copied byte for byte
 * from the newest stored snapshot, so the resulting diff shows exactly the
 * block that changed and nothing else.
 *
 * Rows written here carry runId `manual-backfill` so a reconstructed snapshot
 * is always distinguishable from one an ingest produced.
 *
 * Usage:
 *   npx tsx scripts/backfill-pre-edit-snapshot.ts \
 *     --monitor 135119948 \
 *     --at 2026-08-31T22:00:00Z \
 *     --find /tmp/before-block.txt \
 *     --replace /tmp/after-block.txt
 *
 * `--find` holds the snippet as it exists in the stored message today, and
 * `--replace` holds what stood there before the edit.
 */

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { hashMonitorConfig } from "../src/lib/monitor-config";
import { redactString } from "../src/lib/redact";

const BACKFILL_RUN_ID = "manual-backfill";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? undefined : process.argv[i + 1];
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const monitorId = arg("monitor");
  const capturedAt = new Date(arg("at"));
  if (Number.isNaN(capturedAt.getTime())) throw new Error("--at is not a date");

  const find = readFileSync(arg("find"), "utf8").trim();
  const replace = readFileSync(arg("replace"), "utf8").trim();

  const template = await prisma.monitorConfigSnapshot.findFirst({
    where: { monitorId },
    orderBy: { capturedAt: "desc" },
  });
  if (!template) throw new Error(`No snapshot to copy for monitor ${monitorId}`);
  if (!template.message) throw new Error("Newest snapshot stores no message");
  if (template.capturedAt <= capturedAt) {
    throw new Error("--at must be earlier than the snapshot being reconstructed");
  }

  const occurrences = template.message.split(find).length - 1;
  if (occurrences !== 1) {
    throw new Error(`--find matched ${occurrences} times, expected exactly 1`);
  }

  // Operator-supplied notify text reaches the same column the ingest redacts.
  const message = redactString(template.message.replace(find, replace)).value;
  const hash = hashMonitorConfig({
    query: template.query,
    message,
    priority: template.priority,
    thresholds: parseJson(template.thresholds),
    options: parseJson(template.options),
  });

  const clash = await prisma.monitorConfigSnapshot.findFirst({
    where: { monitorId, hash },
  });
  if (clash) {
    throw new Error(`Monitor ${monitorId} already stores a snapshot with hash ${hash}`);
  }

  const created = await prisma.monitorConfigSnapshot.create({
    data: {
      monitorId,
      runId: BACKFILL_RUN_ID,
      capturedAt,
      query: template.query,
      message,
      priority: template.priority,
      thresholds: template.thresholds,
      options: template.options,
      hash,
    },
  });

  console.log(
    `Inserted ${created.id} for monitor ${monitorId} at ${capturedAt.toISOString()} (hash ${hash})`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
