import "server-only";

import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * What this checkout can see of the daily-refresh automation's output.
 *
 * The automation's only observable product is a `Daily refresh <date>` commit on
 * main, so git is the evidence channel. Reading it is deliberately passive: no
 * fetch, no pull, no checkout. See readGitEvidence for why.
 */
export interface GitCommit {
  sha: string;
  committedAt: Date;
  subject: string;
}

export interface GitEvidence {
  ref: string;
  /** Commits on the remote-tracking ref — what the automation managed to land. */
  commits: GitCommit[];
  /**
   * Commits reachable from HEAD — what has actually been pulled into this working
   * tree, and therefore what the ingested DB could have seen. `git fetch` advances
   * `commits` without touching this, so the two genuinely differ.
   */
  localCommits: GitCommit[];
  /**
   * When this checkout last had a chance to see new commits. Undefined means we
   * have never looked — which is why absence of a commit can only ever mean
   * "unknown", not "failed".
   */
  lastFetchedAt?: Date;
  /** Git's own last stderr line when the ref could not be read. */
  error?: string;
}

/** A local `git log` is milliseconds; anything slower means git is wedged. */
const GIT_TIMEOUT_MS = 3_000;
/** ~2 weeks of activity on main — enough to also name the newest refresh we did see. */
const LOG_DEPTH = "40";
/**
 * Read the remote-tracking ref by name, never HEAD. A local commit, a dirty
 * prisma/oncall.db, or a detached checkout must never read as a successful cloud
 * run. This also makes the detached-HEAD and dirty-tree cases simply irrelevant
 * rather than special-cased.
 */
const REMOTE_REF = "origin/main";
/** Unit separator — safe against any character a commit subject may contain. */
const FMT = "%H%x1f%cI%x1f%s";

/**
 * Read the local view of `origin/main`. Never throws.
 *
 * Deliberately does NOT fetch. A page render must not make a network call — this
 * runs on every force-dynamic Settings render, and `git fetch` over SSH has an
 * unbounded tail — and a fetch also *mutates* the repo, rewriting FETCH_HEAD and
 * moving remote-tracking refs. So the render reads only what is already local,
 * and when the local view is too old to support a conclusion it says so. The
 * fetch belongs in refreshFromSourceAction, whose `git pull --ff-only` already
 * updates origin/main; after the user clicks "Refresh from source" the next
 * render has a fresh view.
 */
export async function readGitEvidence(
  cwd: string = process.cwd(),
): Promise<GitEvidence> {
  try {
    const { stdout } = await exec(
      "git",
      ["log", REMOTE_REF, "-n", LOG_DEPTH, `--format=${FMT}`],
      { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 1_000_000 },
    );
    const [localCommits, lastFetchedAt] = await Promise.all([
      readLog("HEAD", cwd).catch(() => []),
      lastFetchAt(cwd),
    ]);
    return { ref: REMOTE_REF, commits: parseLog(stdout), localCommits, lastFetchedAt };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    const raw = (e.stderr && e.stderr.trim()) || e.message || String(err);
    const line = raw.split("\n").filter(Boolean).pop() ?? raw;
    return { ref: REMOTE_REF, commits: [], localCommits: [], error: line };
  }
}

function parseLog(stdout: string): GitCommit[] {
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, iso, subject] = line.split("\x1f");
      return { sha, committedAt: new Date(iso), subject };
    });
}

async function readLog(ref: string, cwd: string): Promise<GitCommit[]> {
  const { stdout } = await exec(
    "git",
    ["log", ref, "-n", LOG_DEPTH, `--format=${FMT}`],
    { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 1_000_000 },
  );
  return parseLog(stdout);
}

/**
 * When this checkout last talked to origin.
 *
 * `.git/FETCH_HEAD` is rewritten by every fetch and pull, including one that
 * changed nothing, so its mtime is the closest thing git offers to "when did I
 * last look". (A remote-tracking ref's mtime only moves when its value changes,
 * which is not the same question.) It is a heuristic — but it is only ever used
 * to DOWNGRADE a would-be "failed" to "unknown", so reading it wrong makes the
 * dashboard claim less, never more.
 */
async function lastFetchAt(cwd: string): Promise<Date | undefined> {
  try {
    // --git-common-dir, not --git-dir, so a linked worktree finds the shared file.
    const { stdout } = await exec(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, timeout: GIT_TIMEOUT_MS },
    );
    return statSync(join(stdout.trim(), "FETCH_HEAD")).mtime;
  } catch {
    return undefined; // never fetched, or not a git dir — we have not looked
  }
}
