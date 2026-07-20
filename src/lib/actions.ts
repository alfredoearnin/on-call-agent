"use server";

import { revalidatePath } from "next/cache";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runSync } from "@/lib/ingest/run";
import { prisma } from "@/lib/db";
import { SyncTrigger } from "@/lib/constants";

const exec = promisify(execFile);

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
 * "Refresh from source": `git pull` the latest memory from `main`. The daily
 * automation already fetches Confluence, rebuilds `prisma/oncall.db`, and pushes
 * to `main` — so a fast-forward pull is all the local dashboard needs to catch up.
 */
export async function refreshFromSourceAction() {
  const cwd = process.cwd();
  try {
    // Drop the transient SQLite churn (the live read connection touches the
    // file) so the pull can fast-forward the committed DB.
    await exec("git", ["checkout", "--", "prisma/oncall.db"], { cwd }).catch(
      () => {},
    );
    const { stdout } = await exec("git", ["pull", "--ff-only"], { cwd });
    // Reconnect Prisma so the next query reads the freshly pulled DB file.
    await prisma.$disconnect().catch(() => {});
    revalidatePath("/", "layout");
    const updated = !/already up to date/i.test(stdout);
    return {
      ok: true,
      message: updated
        ? "Pulled the latest from main — dashboard updated."
        : "Already up to date.",
    };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const raw = (e.stderr && e.stderr.trim()) || e.message || String(err);
    const line = raw.split("\n").filter(Boolean).pop() ?? raw;
    return { ok: false, message: `git pull failed: ${line}` };
  }
}
