import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const LOCK_PATH = join(process.cwd(), ".sync.lock");
const TTL_MS = 10 * 60 * 1000; // stale after 10 minutes

/** Acquire the sync run-lock. Returns false if a fresh lock is already held. */
export function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    try {
      const raw = readFileSync(LOCK_PATH, "utf8");
      const ts = Number.parseInt(raw.split("|")[1] ?? "0", 10);
      if (Number.isFinite(ts) && Date.now() - ts < TTL_MS) return false;
    } catch {
      // corrupt lock — treat as stale and override
    }
  }
  writeFileSync(LOCK_PATH, `${process.pid}|${Date.now()}`);
  return true;
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH)) rmSync(LOCK_PATH);
  } catch {
    // best-effort
  }
}
