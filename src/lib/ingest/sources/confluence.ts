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
 * Token-free source: parse the on-call agent's Confluence markdown files that
 * the cloud automation (or a local run) drops into data/confluence/. Uses
 * handoff.md if present, else the newest non-ledger .md file.
 */
export function buildConfluenceBundle(now: Date = new Date()): IngestBundle {
  if (!existsSync(DIR)) {
    throw new Error(`Confluence dir not found: ${DIR}`);
  }
  let file = join(DIR, "handoff.md");
  if (!existsSync(file)) {
    const candidates = readdirSync(DIR)
      .filter((f) => f.endsWith(".md") && !/ledger/i.test(f))
      .sort();
    if (candidates.length === 0) {
      throw new Error(`No handoff markdown in ${DIR}`);
    }
    file = join(DIR, candidates[candidates.length - 1]);
  }
  const md = readFileSync(file, "utf8");
  return parseConfluence(md, now);
}
