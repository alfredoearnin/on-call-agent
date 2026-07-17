import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { IngestBundle } from "@/lib/ingest/types";
import { parseConfluence } from "@/lib/ingest/sources/confluence-parse";

const DIR = join(process.cwd(), "data", "confluence");

/** True when the on-call agent's Confluence markdown has been dropped in. */
export function hasConfluenceFiles(): boolean {
  try {
    return existsSync(DIR) && readdirSync(DIR).some((f) => f.endsWith(".md"));
  } catch {
    return false;
  }
}

/**
 * Token-free source: parse ALL of the on-call agent's weekly handoff markdown
 * files that the cloud automation (or a local run) drops into data/confluence/.
 * Each handoff page = one on-call week. Returns one bundle per week, sorted
 * oldest -> newest (by parsed window, else filename).
 */
export function buildConfluenceBundles(now: Date = new Date()): IngestBundle[] {
  if (!existsSync(DIR)) {
    throw new Error(`Confluence dir not found: ${DIR}`);
  }
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".md") && !/ledger/i.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`No handoff markdown in ${DIR}`);
  }
  const bundles = files.map((f) =>
    parseConfluence(readFileSync(join(DIR, f), "utf8"), now),
  );
  return bundles.sort((a, b) => {
    const as = a.window?.start?.getTime() ?? 0;
    const bs = b.window?.start?.getTime() ?? 0;
    return as - bs;
  });
}
