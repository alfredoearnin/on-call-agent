import "server-only";

import { readFileSync, readdirSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import type { PageState } from "@/lib/constants";
import {
  parsePageState,
  parseRefreshedAt,
  parseWindow,
} from "@/lib/ingest/sources/confluence-parse";

/**
 * What the archived handoff pages say about themselves.
 *
 * The dashboard cannot see Confluence, but the health-check automation commits a
 * copy of every page it writes into data/confluence/, so the archive on disk is
 * the only evidence channel for "was this week ever closed?". Reading it is
 * deliberately passive — same arrangement, and same reasoning, as
 * readGitEvidence: a page render must not make a network call, and must not
 * mutate anything to reach a verdict.
 *
 * Note this reads the files, not the ingested DB. The DB keeps page metadata for
 * the newest week only, and a stale `npm run ingest` would make an unclosed week
 * look fine. The files are the archive as it stands right now.
 */
export interface ArchivedWeek {
  file: string;
  /** The window the page states — not the one its filename implies. */
  window?: { start: Date; end: Date };
  /** Its state banner. Undefined on pages published before the banner existed. */
  state?: PageState;
  /** Resolved instant of its own refresh stamp, for the arithmetic. */
  refreshedAt?: Date;
  /** That stamp verbatim, so a verdict can always quote the page. */
  refreshedText?: string;
}

export interface PageArchive {
  /** Oldest -> newest by stated window, falling back to filename. */
  weeks: ArchivedWeek[];
  /** Why the archive could not be read. Absence here proves nothing. */
  error?: string;
}

const DIR = join("data", "confluence");
/**
 * The archive grows by one page a week, so this is generous — but it bounds the
 * work a render can be made to do if the directory is ever used for something else.
 */
const MAX_FILES = 200;
/**
 * A handoff page is ~30 KB. Anything this large is not one, and both the read and
 * the parse block the event loop — so an oversized file would stall every
 * concurrent request, not just the render that asked for it.
 */
const MAX_BYTES = 1_000_000;

/**
 * Read every archived handoff page's window, banner and refresh stamp. Never throws.
 *
 * `tz` is the fallback zone for a page that names none, matching the ingest so the
 * two agree on which local day a window ends.
 */
export function readPageArchive(
  tz: string,
  cwd: string = process.cwd(),
): PageArchive {
  const dir = join(cwd, DIR);
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // The errno alone. Node's message embeds the absolute path of the directory,
    // and this string is rendered in the UI — see assessWeekClose.
    const code = (err as NodeJS.ErrnoException).code ?? "unknown";
    return { weeks: [], error: `data/confluence could not be read (${code})` };
  }

  const files = entries
    // isFile() is lstat-based, so this also rejects a symlink out of the repo.
    .filter(
      (e) => e.isFile() && e.name.endsWith(".md") && !/ledger/i.test(e.name),
    )
    .map((e) => e.name)
    .sort()
    .slice(-MAX_FILES);

  const weeks: ArchivedWeek[] = [];
  for (const file of files) {
    try {
      const path = join(dir, file);
      if (statSync(path).size > MAX_BYTES) continue;
      const md = readFileSync(path, "utf8");
      const refresh = parseRefreshedAt(md, tz);
      weeks.push({
        file,
        window: parseWindow(md, tz),
        state: parsePageState(md),
        refreshedAt: refresh?.at,
        refreshedText: refresh?.text,
      });
    } catch {
      // One unreadable page must not blind us to the rest — and must never throw
      // out of here, because that would take down the whole Settings render.
      continue;
    }
  }

  weeks.sort(
    (a, b) =>
      (a.window?.start?.getTime() ?? 0) - (b.window?.start?.getTime() ?? 0),
  );
  return { weeks };
}
