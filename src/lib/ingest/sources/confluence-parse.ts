import { DateTime } from "luxon";
import { getConfig } from "@/lib/config";
import { GROWTH_TEAM_SERVICES } from "@/lib/team-services";
import {
  Coverage,
  CoverageRole,
  Priority,
  MonitorState,
  AlertDisposition,
  FiringKind,
  IssueType,
  Confidence,
  RecommendationStatus,
  SourceStatus,
  PageState,
} from "@/lib/constants";
import type {
  IngestBundle,
  NormalizedAlert,
  NormalizedMonitor,
  NormalizedRecommendation,
  CoverageEntry,
  NormalizedSchedule,
  PageCoverage,
  PageRefresh,
  ProposedPatch,
} from "@/lib/ingest/types";

/**
 * Parses the on-call agent's Confluence pages (weekly handoff + tuning ledger,
 * in the markdown the Atlassian tools return) into the dashboard's normalized
 * structures. Defensive: every section is optional and skipped if not found.
 */

/** Strip markdown links/bold/status macros to plain text. */
function clean(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/<custom[^>]*>(.*?)<\/custom>/gis, "$1") // status macros
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function monitorIdFrom(text: string): string | undefined {
  const m = /\b(\d{5,})\b/.exec(text);
  return m?.[1];
}

function alertIdFrom(text: string): string | undefined {
  const m = /\b(01[0-9A-HJKMNP-TV-Z]{24})\b/.exec(text); // ULID
  return m?.[1];
}

// ── Event times ─────────────────────────────────────────────────────────────

/**
 * When an alert fired, read out of the finding prose.
 *
 * The pages write `Aug 7 15:00 UTC`, `Fri Jul 31 18:23 PT`, `~2:18 AM PT Thu Aug
 * 20`, `2026-08-26 16:53 UTC`, or just `Mon Aug 17` with no clock time at all —
 * and crucially both UTC and PT appear, 7 hours apart, so flattening them into
 * the team zone is a real error.
 *
 * Two rules carry the honesty here:
 *
 * 1. The zone label on the page wins. `09:17 UTC` and `09:17 PT` are different
 *    instants and must not be conflated.
 * 2. A time the page did not state is NOT invented. `timeKnown: false` means the
 *    day is known but the clock time is not, and callers must render it as such
 *    rather than showing a confident wrong time. Returning `undefined` means we
 *    know nothing — the previous `?? new Date()` fallback stamped alerts with
 *    their ingest time, which is how a 02:17 AM page came to read as 11:10 AM.
 *
 * Quantifiers are bounded throughout, per the ReDoS discipline used by the other
 * parsers in this file.
 */
export interface ParsedEventTime {
  at: Date;
  /** False when the page gave a date but no clock time. */
  timeKnown: boolean;
  /** The zone the instant was resolved in, for the record. */
  zone: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Zone abbreviations the pages use. PT/PST/PDT resolve via the team zone. */
const UTC_LABEL = /^(utc|gmt|z)$/i;

const ISO_AT =
  /(\d{4}-\d{2}-\d{2})(?:[\sT]{1,3}(\d{1,2}):(\d{2}))?(?:\s{0,3}(utc|gmt|z)\b)?/i;
/** `Aug 20 09:17 UTC`, `Fri Jul 31 18:23 PT`, `Mon Aug 17` */
const MONTH_DAY_AT = new RegExp(
  String.raw`(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]{0,6}\s{1,3})?` +
    String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]{0,7}\s{1,3}(\d{1,2})` +
    String.raw`(?:\s{1,3}~?(\d{1,2}):(\d{2})\s{0,3}(am|pm)?\s{0,3}([a-z]{2,4})?)?`,
  "i",
);
/** `~2:18 AM PT Thu Aug 20` — time first, date later in the sentence. */
const TIME_FIRST = new RegExp(
  String.raw`~?(\d{1,2}):(\d{2})\s{0,3}(am|pm)\s{0,3}([a-z]{2,4})?` +
    String.raw`[^0-9]{0,40}?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]{0,6}\s{1,3})?` +
    String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]{0,7}\s{1,3}(\d{1,2})`,
  "i",
);
/** Prefer a timestamp introduced by a "fired" cue over acks and resolutions. */
const FIRED_CUE = /fired(?:\s{1,3}(?:at|on))?\s{0,3}/i;
const CUE_WINDOW = 60;

/** `(1)`, `(2)` — how a finding enumerates a monitor's repeat firings. */
const FIRING_MARKER = /\((?:\d{1,2})\)\s{0,3}/g;
/** A marker's stamp sits at the head of its clause; enough room for `2026-08-26 16:53 UTC`. */
const MARKER_WINDOW = 34;

export function parseEventTime(
  text: string,
  opts: { tz: string; window?: { start: Date; end: Date } },
): ParsedEventTime | undefined {
  const { tz, window } = opts;
  const flat = text.replace(/\s+/g, " ");

  // A "fired at …" clause is the authoritative one; acks and resolutions come
  // later in the same sentence and must not win.
  const cue = FIRED_CUE.exec(flat);
  if (cue) {
    const scoped = flat.slice(cue.index, cue.index + CUE_WINDOW);
    const hit = matchAny(scoped, tz, window);
    if (hit) return hit;
  }
  return matchAny(flat, tz, window);
}

/**
 * Every firing a finding enumerates, in page order.
 *
 * A monitor that pages twice gets ONE row in the page's table, so reading a row as
 * a single alert drops every firing after the first — the page's own count said "2
 * records" while the timeline showed one. The repeats are enumerated as
 * `(1) <stamp> …; (2) <stamp> …`, the only per-firing structure the pages carry.
 *
 * Deliberately narrow, because the alternative is inventing pages that never
 * happened: a marker counts only when a timestamp follows it closely, only bare
 * `(n)` counts as a marker, and stamps outside the on-call week are dropped so
 * evidence quoted about earlier weeks cannot become this week's firings. Returns
 * fewer than two entries when the finding describes a single firing, which is the
 * signal for callers to keep their existing one-row-one-alert behaviour.
 */
export function parseFiringTimes(
  text: string,
  opts: { tz: string; window?: { start: Date; end: Date } },
): ParsedEventTime[] {
  const { tz, window } = opts;
  const flat = text.replace(/\s+/g, " ");
  const out: ParsedEventTime[] = [];
  const seen = new Set<number>();

  for (const marker of flat.matchAll(FIRING_MARKER)) {
    const from = (marker.index ?? 0) + marker[0].length;
    const hit = matchAny(flat.slice(from, from + MARKER_WINDOW), tz, window);
    if (!hit) continue;
    if (window && (hit.at < window.start || hit.at > window.end)) continue;
    const instant = hit.at.getTime();
    if (seen.has(instant)) continue;
    seen.add(instant);
    out.push(hit);
  }
  return out;
}

function matchAny(
  flat: string,
  tz: string,
  window?: { start: Date; end: Date },
): ParsedEventTime | undefined {
  const iso = ISO_AT.exec(flat);
  if (iso) {
    // Rule 1 above applies here too. This branch used to hardcode the team zone,
    // so `2026-08-26 16:53 UTC` was read as 16:53 PT and stored seven hours late.
    // A label with no clock time is ignored on purpose: UTC midnight is the
    // previous evening in the team zone, so honouring it would move a bare date
    // to the wrong day — and rule 2 only promises the day, not a time.
    const labelled = Boolean(iso[2]) && Boolean(iso[4]) && UTC_LABEL.test(iso[4]);
    const zone = labelled ? "utc" : tz;
    const dt = iso[2]
      ? DateTime.fromISO(`${iso[1]}T${iso[2].padStart(2, "0")}:${iso[3]}`, { zone })
      : DateTime.fromISO(iso[1], { zone }).startOf("day");
    if (dt.isValid) return { at: dt.toJSDate(), timeKnown: Boolean(iso[2]), zone };
  }

  const timeFirst = TIME_FIRST.exec(flat);
  if (timeFirst) {
    const built = build({
      month: timeFirst[5], day: timeFirst[6],
      hour: timeFirst[1], minute: timeFirst[2],
      meridiem: timeFirst[3], label: timeFirst[4], tz, window,
    });
    if (built) return built;
  }

  const md = MONTH_DAY_AT.exec(flat);
  if (md) {
    const built = build({
      month: md[1], day: md[2],
      hour: md[3], minute: md[4], meridiem: md[5], label: md[6], tz, window,
    });
    if (built) return built;
  }

  return undefined;
}

function build(p: {
  month: string; day: string;
  hour?: string; minute?: string; meridiem?: string; label?: string;
  tz: string; window?: { start: Date; end: Date };
}): ParsedEventTime | undefined {
  const month = MONTHS[p.month.slice(0, 3).toLowerCase()];
  const day = Number.parseInt(p.day, 10);
  if (!month || !Number.isFinite(day)) return undefined;

  // The pages never write a year on alert times, so take it from the on-call week
  // and roll over when the month sits before the window (a Dec→Jan week).
  const anchor = p.window?.start ?? new Date();
  const anchorDt = DateTime.fromJSDate(anchor, { zone: p.tz });
  const year = month < anchorDt.month - 6 ? anchorDt.year + 1 : anchorDt.year;

  const timeKnown = Boolean(p.hour && p.minute);
  let hour = timeKnown ? Number.parseInt(p.hour!, 10) : 0;
  const minute = timeKnown ? Number.parseInt(p.minute!, 10) : 0;
  const mer = p.meridiem?.toLowerCase();
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;

  // The zone label on the page wins over the team zone. Anything unrecognised
  // (or absent) falls back to the team zone, which is what the pages default to.
  const zone = p.label && UTC_LABEL.test(p.label) ? "utc" : p.tz;

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone },
  );
  if (!dt.isValid) return undefined;
  return {
    at: timeKnown ? dt.toJSDate() : dt.startOf("day").toJSDate(),
    timeKnown,
    zone,
  };
}

/** Return the body of a section between a heading and the next heading. */
function section(md: string, headingPattern: RegExp): string | undefined {
  const lines = md.split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (h && headingPattern.test(h[2])) {
      start = i + 1;
      level = h[1].length;
      break;
    }
  }
  if (start === -1) return undefined;
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const h = /^(#{1,6})\s+/.exec(lines[i]);
    if (h && h[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

/** Parse a markdown table into rows of trimmed cells (skips header + divider). */
function parseTable(body: string): string[][] {
  const rows: string[][] = [];
  const lines = body.split("\n").filter((l) => l.trim().startsWith("|"));
  for (const line of lines) {
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue; // divider
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length) rows.push(cells);
  }
  // Drop the header row (first row) if present.
  return rows.length > 1 ? rows.slice(1) : rows;
}

// ── Week window (Tue -> Tue) ────────────────────────────────────────────────

/**
 * Every quantifier is bounded, for the same reason as the rotation and refresh
 * regexes — but here it is load-bearing beyond the ingest. Three unbounded lazy
 * `[^\n]*?` runs in sequence re-split against each other whenever the tail fails,
 * which is O(n²): a 440 KB line took 6.6 s to reject. parseWindow now also runs on
 * every archived page during a Settings render (readPageArchive), and both the read
 * and the match block the event loop, so one oversized page would stall every
 * concurrent request — not just the page that asked.
 *
 * The bounds are generous against real pages: the widest real gap is the frozen
 * banner's "on-call week has ended; see the next week's page (" at 37 characters.
 */
const WINDOW = new RegExp(
  String.raw`on-call week[^\n]{0,120}?(\d{4}-\d{2}-\d{2})(?:[ \t*]{1,4}(\d{1,2}:\d{2}))?` +
    String.raw`[^\n]{0,40}?(?:→|->)[^\n]{0,40}?(\d{4}-\d{2}-\d{2})(?:[ \t*]{1,4}(\d{1,2}:\d{2}))?` +
    String.raw`(?:[^\n]{0,24}?\(([A-Za-z]{2,12}\/[A-Za-z_]{2,20})\))?`,
  "i",
);

/**
 * Canonical IANA names keyed by lowercase, so a page's casing cannot multiply
 * luxon's zone cache.
 *
 * `IANAZone.isValidZone` accepts any casing, but luxon caches by the raw string
 * in module-level maps it never evicts — so each novel casing of one zone mints a
 * permanent ICU formatter (~73 KB, off-heap where a heap limit will not catch it).
 * Resolving to a single spelling collapses them to one entry. Legacy aliases like
 * `US/Pacific` are absent here and fall back to the team zone, which is the same
 * zone they named anyway.
 */
const CANONICAL_ZONE = new Map(
  Intl.supportedValuesOf("timeZone").map((z) => [z.toLowerCase(), z]),
);

/**
 * The state banner sits above the header and cites the *next* week's page ("a
 * new page opens for the next week", "see the next week's page (X → Y)"), so
 * taking the first window on the page reports the wrong week once a page
 * freezes. Prefer a line that is not talking about another week.
 */
function windowMatch(md: string): RegExpExecArray | null {
  for (const line of md.split("\n")) {
    if (NEXT_CUE.test(line)) continue;
    const m = WINDOW.exec(line);
    if (m) return m;
  }
  return WINDOW.exec(md);
}

/**
 * Read the window a page declares — including the boundary time, when it states
 * one.
 *
 * A bare date means midnight, and that is not a default so much as a fact about
 * the archive: pages written before the handoff boundary was modelled state only
 * dates, and the counts on them were queried midnight-to-midnight. Inferring the
 * real 11:00 handoff for those would label them with a window their own contents
 * never covered. So a stated time is honoured and a missing one stays midnight,
 * which lets the two generations of page coexist without a migration.
 *
 * `tz` is the fallback zone for a page that gives a time but names no zone.
 */
export function parseWindow(
  md: string,
  tz: string,
): { start: Date; end: Date } | undefined {
  const m = windowMatch(md);
  if (!m) return undefined;
  const [, startDate, startTime, endDate, endTime, statedZone] = m;
  const zone = (statedZone && CANONICAL_ZONE.get(statedZone.toLowerCase())) ?? tz;

  const at = (date: string, time?: string) =>
    time
      ? DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd H:mm", { zone })
      : DateTime.fromISO(date, { zone }).startOf("day");

  const start = at(startDate, startTime);
  const end = at(endDate, endTime);
  if (!start.isValid || !end.isValid) return undefined;
  return { start: start.toJSDate(), end: end.toJSDate() };
}

// ── Page state banner (live vs frozen) ──────────────────────────────────────

/**
 * The state banner the agent writes above the header (its Step 7, item 0):
 *
 *   🔄 **Live page** — refreshed daily during the on-call week (X → Y). …
 *   🔒 **Frozen — final state at week close (Y).** This on-call week has ended; …
 *
 * Read to answer exactly one question: did the Tuesday handoff close the week it
 * ended? A page still calling itself live after its own window has passed is the
 * evidence that the handoff's Phase A never ran.
 *
 * Confined to the lines ABOVE the `#` title, because both wordings recur in the
 * body with the opposite sense — a live page promises it "freezes at the Tuesday
 * handoff", a frozen one points to "the next week's page", and the footer says
 * "live, refreshed daily". Scanning the whole document matches both on both.
 */
const BANNER_FROZEN = /\bfrozen\b/i;
/** `Live page` as a phrase — the footer's bare "live," is not a state banner. */
const BANNER_LIVE = /\blive\s{1,4}page\b/i;
/** The banner is the first line or two; a cap keeps a title-less page bounded. */
const BANNER_MAX_LINES = 4;

function bannerLines(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    if (/^#\s/.test(line)) break; // the title ends the banner region
    if (!line.trim()) continue;
    out.push(line);
    if (out.length === BANNER_MAX_LINES) break;
  }
  return out;
}

export function parsePageState(md: string): PageState | undefined {
  for (const line of bannerLines(md)) {
    // Frozen wins within a line: the current frozen banner never says "Live
    // page", but a future wording carrying both should read as closed, not open.
    if (BANNER_FROZEN.test(line)) return PageState.Frozen;
    if (BANNER_LIVE.test(line)) return PageState.Live;
  }
  return undefined;
}

// ── Page refresh stamp ──────────────────────────────────────────────────────

/**
 * The page's own claim about when the health-check automation last rewrote it.
 * This is the ONLY evidence the dashboard has that automation 1 ran, so a silent
 * parse failure must degrade to "unknown", never to "failed".
 *
 * The label drifts, because an LLM writes each page: `Last refreshed **…**`,
 * `**Last refreshed: …**`, and on a frozen week `Final refresh completed **…**`.
 * `refresh` alone is deliberately NOT accepted — pages also say "New since the
 * last refresh (Jul 25 → Jul 26)", "at this morning's 08:02 AM refresh", and
 * "refreshed daily during the on-call week", none of which is a stamp.
 *
 * Every quantifier is bounded, for the same reason as the rotation regexes: an
 * unbounded `\s*` beside a capture lets the engine split a whitespace run
 * exponentially many ways and hang the ingest.
 */
const REFRESH_LABEL = String.raw`(?:last\s{1,4}refreshed|(?:final\s{1,4})?refresh(?:ed)?\s{1,4}completed)`;
/** `2026-08-19 8:00 AM PT (America/Los_Angeles)` — time, abbreviation and zone all optional. */
const REFRESH_STAMP =
  String.raw`(\d{4}-\d{2}-\d{2})(?:[\s*]{1,6}(\d{1,2}:\d{2})\s{0,4}(AM|PM))?` +
  String.raw`(?:\s{0,4}([A-Z]{2,4}))?(?:\s{0,4}\(([A-Za-z]{2,12}\/[A-Za-z_]{2,20})\))?`;
const REFRESHED_AT = new RegExp(
  `${REFRESH_LABEL}[\\s:*_—-]{0,8}${REFRESH_STAMP}`,
  "i",
);

/**
 * `tz` is the fallback zone used when the page names no IANA zone. The `PT`
 * abbreviation is deliberately ignored: it is ambiguous between PDT and PST, and
 * guessing would put the stamp an hour off across a DST boundary — enough to move
 * it across local midnight and flip a health verdict. The page's own
 * `(America/Los_Angeles)` is authoritative when present.
 */
export function parseRefreshedAt(
  md: string,
  tz: string,
): PageRefresh | undefined {
  for (const line of md.split("\n")) {
    const m = REFRESHED_AT.exec(line.replace(/\s+/g, " "));
    if (!m) continue;

    const [, date, time, meridiem, , namedZone] = m;
    const text = m[0]
      .replace(/\*\*/g, "")
      .replace(/\\/g, "")
      .replace(/^[^0-9]*/, "")
      .replace(/[.\s]+$/, "")
      .trim();

    const zone =
      namedZone && DateTime.local({ zone: namedZone }).isValid ? namedZone : tz;
    const dt =
      time && meridiem
        ? DateTime.fromFormat(`${date} ${time} ${meridiem}`, "yyyy-MM-dd h:mm a", {
            zone,
          })
        : DateTime.fromISO(date, { zone }).startOf("day");

    return {
      at: dt.isValid ? dt.toJSDate() : undefined,
      text,
      dateOnly: !time,
    };
  }
  return undefined;
}

// ── Coverage check (who on the rotation is out of office) ───────────────────

/**
 * The page's coverage check, written by the Health Check agent after it resolves
 * the rotation (see the agent prompt, Step 1). It is the only signal the dashboard has
 * that a named on-call is actually unavailable.
 *
 * Three properties matter more than tolerance here:
 *
 * 1. The header line is REQUIRED. Its absence means the check never ran, which is
 *    "unknown" — never "everyone is available". Those must not look the same.
 * 2. Role lines are read only from INSIDE the block. Scanning the whole page would
 *    misread ordinary prose like "* Primary shashank — acked in 13 s".
 * 3. A role the block does not mention is Unknown, not Available.
 *
 * Every quantifier is bounded, for the same reason as the rotation and refresh
 * regexes: an unbounded `\s*` next to a capture lets the engine split a whitespace
 * run exponentially many ways and hang the ingest.
 */
const COVERAGE_FAILED =
  /coverage\s{1,4}check\s{0,4}:\s{0,4}could\s{1,4}not\s{1,4}be\s{1,4}completed(?:\s{0,4}\(([^)]{0,80})\))?/i;
const COVERAGE_HEADER = /coverage\s{1,4}check(?:\s{0,4}\(([^)]{0,80})\))?\s{0,4}:/i;
/** A bullet naming one rotation slot. `next primary` must precede `primary`. */
const COVERAGE_ROLE =
  /^[*\-•\s]{1,6}(next\s{1,4}primary|next\s{1,4}secondary|primary|secondary)\b(.{0,160})$/i;
const COVERAGE_OUT =
  /out\s{1,4}of\s{1,4}office\b[^0-9]{0,24}(\d{4}-\d{2}-\d{2})\s{0,4}(?:→|->|-|to)\s{0,4}(\d{4}-\d{2}-\d{2})/i;
const COVERAGE_UNCHECKED = /could\s{1,4}not\s{1,4}be\s{1,4}checked/i;
const COVERAGE_AVAILABLE = /\bavailable\b/i;
const COVERAGE_OPEN_ENDED = /open[\s-]{0,2}ended/i;
/** How far past the header to look for bullets before giving up. */
const COVERAGE_BLOCK_LINES = 12;

const ROLE_KEYS: Record<string, CoverageRole> = {
  primary: CoverageRole.Primary,
  secondary: CoverageRole.Secondary,
  nextprimary: CoverageRole.NextPrimary,
  nextsecondary: CoverageRole.NextSecondary,
};

const unknownRoles = (): Record<CoverageRole, CoverageEntry> => ({
  [CoverageRole.Primary]: { state: Coverage.Unknown },
  [CoverageRole.Secondary]: { state: Coverage.Unknown },
  [CoverageRole.NextPrimary]: { state: Coverage.Unknown },
  [CoverageRole.NextSecondary]: { state: Coverage.Unknown },
});

/** Strip markdown emphasis and escapes without the link pass `clean` also does. */
function flattenLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\\/g, "")
    .trim();
}

export function parseCoverage(
  md: string,
  tz: string,
): PageCoverage | undefined {
  const lines = md.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = flattenLine(lines[i]);
    if (!line) continue;

    // Checked before the header: the failure sentence also matches COVERAGE_HEADER.
    const failed = COVERAGE_FAILED.exec(line);
    if (failed) {
      return {
        unavailableReason: clean(failed[1] ?? "") || "reason not stated",
        roles: unknownRoles(),
      };
    }

    const header = COVERAGE_HEADER.exec(line);
    if (!header) continue;

    const roles = unknownRoles();
    for (let j = i + 1; j < Math.min(lines.length, i + 1 + COVERAGE_BLOCK_LINES); j++) {
      const raw = lines[j];
      if (/^\s*#/.test(raw)) break; // a heading ends the block
      const bullet = flattenLine(raw).replace(/^_+|_+$/g, "").trim();
      if (!bullet) continue;

      const m = COVERAGE_ROLE.exec(bullet);
      if (!m) continue;

      const key = m[1].toLowerCase().replace(/\s+/g, "");
      const role = ROLE_KEYS[key];
      if (!role) continue;

      roles[role] = coverageEntry(m[2], bullet, tz);
    }

    return { checkedAt: clean(header[1] ?? "") || undefined, roles };
  }

  return undefined;
}

function coverageEntry(rest: string, evidence: string, tz: string): CoverageEntry {
  const out = COVERAGE_OUT.exec(rest);
  if (out) {
    const from = DateTime.fromISO(out[1], { zone: tz }).startOf("day");
    const to = DateTime.fromISO(out[2], { zone: tz }).endOf("day");
    return {
      state: Coverage.OutOfOffice,
      from: from.isValid ? from.toJSDate() : undefined,
      to: to.isValid ? to.toJSDate() : undefined,
      openEnded: COVERAGE_OPEN_ENDED.test(rest) || undefined,
      evidence,
    };
  }
  // "could not be checked" is deliberately tested before "available", so a line
  // saying both never reads as available.
  if (COVERAGE_UNCHECKED.test(rest)) {
    return { state: Coverage.Unknown, evidence };
  }
  if (COVERAGE_AVAILABLE.test(rest)) {
    return { state: Coverage.Available, evidence };
  }
  // A bullet we cannot classify is Unknown, never Available.
  return { state: Coverage.Unknown, evidence };
}

// ── On-call schedule ────────────────────────────────────────────────────────

/**
 * The rotation is free prose and the wording drifts: three forms have shipped
 * so far — `primary: X; secondary: Y`, `Primary X, Secondary Y` (when
 * incident.io could not be reached), and `the new week's primary is X,
 * secondary Y`. Matching whole sentences broke on each new one, so instead find
 * every role label sitting next to an emphasised name and use a "next" cue to
 * separate the upcoming rotation from the current one. `the agent prompt in agents/` pins the
 * canonical wording; this is the tolerance around it.
 *
 * Every quantifier is bounded: a name may contain spaces, so an unbounded `\s*`
 * beside the capture lets the engine split a whitespace run exponentially many
 * ways and hang the ingest.
 */

/** An emphasised name — every page bolds the people it names. */
const BOLD_NAME = String.raw`\*\*\s{0,4}([\p{L}][^*\n;,()]{0,48}?)\s{0,4}\*\*`;
/** The little that may sit between a role label and its name. */
const LABEL = String.raw`\s{0,4}(?:is|:|—|–|-)?\s{0,4}`;

/** `primary: **X**`, `primary is **X**`, `Primary **X**`. */
const ROLE_THEN_NAME = new RegExp(
  String.raw`\b(primary|secondary)\b${LABEL}${BOLD_NAME}`,
  "gdiu",
);
/** `**X** primary` — the order the next-handoff line often uses. */
const NAME_THEN_ROLE = new RegExp(
  String.raw`${BOLD_NAME}\s{0,4}(primary|secondary)\b`,
  "gdiu",
);

/** Marks a rotation as the one starting at the upcoming handoff. */
const NEXT_CUE = /\b(?:next|new week|upcoming)\b/i;

/**
 * The paragraph whose job is to state the rotation: `On-call: …`,
 * `On-call (closing week): …`, `_This on-call week — …`. Confining the scan to
 * it keeps prose that merely credits someone with a role ("acked by **Grace
 * Hopper** primary within 30s") from being read as the rotation.
 */
const ROTATION_PARAGRAPH = /^[_*\s]*(?:this\s+)?on-call\b/i;

/**
 * Sentence boundary. The period must follow two non-period characters so that
 * `10:00 a.m. PT: primary **X**` stays joined to its "next" cue instead of
 * being split into a cue-less fragment and read as the current rotation.
 */
const SENTENCE_END = /(?<=[^\s.][^\s.]\.)\s/;

/** Wording that means "we could not confirm this against incident.io". */
const UNVERIFIED =
  /could not be verified|cannot be verified|unverified|last verified|carried (?:over )?from/i;

/** `Last verified (Aug 4)` or `last verified: 2026-08-04` → the date as written. */
const VERIFIED_AS_OF = /last verified\s*(?:\(([^)]+)\)|:\s*([^.;,]+))/i;

const flatten = (s: string) => s.replace(/\s+/g, " ");

type Role = "primary" | "secondary";

/** Every `role → name` pairing in one sentence, in the order they appear. */
function rolesNamed(sentence: string): { role: Role; name: string }[] {
  const hits: { role: Role; name: string; at: number }[] = [];
  const taken: [number, number][] = [];

  for (const m of sentence.matchAll(ROLE_THEN_NAME)) {
    hits.push({ role: m[1].toLowerCase() as Role, name: m[2], at: m.index });
    taken.push(m.indices![2]!);
  }

  // `**X** primary` also matches inside `primary **X** secondary`, which would
  // give X both roles and discard the real secondary. Skip names already spoken for.
  for (const m of sentence.matchAll(NAME_THEN_ROLE)) {
    const [from, to] = m.indices![1]!;
    if (taken.some(([start, end]) => from < end && start < to)) continue;
    hits.push({ role: m[2].toLowerCase() as Role, name: m[1], at: m.index });
  }

  return hits.sort((a, b) => a.at - b.at);
}

export function parseOnCall(md: string): NormalizedSchedule | undefined {
  const current: Partial<Record<Role, string>> = {};
  const upcoming: Partial<Record<Role, string>> = {};
  /** The paragraph naming the current rotation, for the verified/carried check. */
  let context: string | undefined;

  const paragraphs = md.split(/\n\s*\n/).map(flatten);
  const declared = paragraphs.filter((p) => ROTATION_PARAGRAPH.test(p));

  for (const flat of declared.length ? declared : paragraphs) {
    // A paragraph can name both rotations, so classify sentence by sentence.
    for (const sentence of flat.split(SENTENCE_END)) {
      const named = rolesNamed(sentence);
      if (!named.length) continue;
      const isNext = NEXT_CUE.test(sentence);
      for (const { role, name } of named) {
        (isNext ? upcoming : current)[role] ??= clean(name);
      }
      if (!isNext) context ??= flat;
    }
  }

  if (!current.primary && !current.secondary && !upcoming.primary) return undefined;

  const unverified = Boolean(context) && UNVERIFIED.test(context!);
  const asOf = unverified ? VERIFIED_AS_OF.exec(context!) : null;

  return {
    primary: current.primary,
    secondary: current.secondary,
    nextPrimary: upcoming.primary,
    nextSecondary: upcoming.secondary,
    unverified,
    verifiedAsOf: clean(asOf?.[1] ?? asOf?.[2] ?? "") || undefined,
  };
}

// ── KPIs (alert-volume summary paragraph) ───────────────────────────────────

interface ParsedKpis {
  totalAlerts: number;
  highAlerts: number;
  lowAlerts: number;
  humanAttention: number;
  autoResolved: number;
  escalationNum: number;
  escalationDen: number;
  activeFiring: number;
  staleFiring: number;
}

function parseKpis(md: string): ParsedKpis | undefined {
  const t = md.replace(/\s+/g, " ");
  const total = /paging alerts:\s*\**(\d+)\s*total\**[^(]*\((\d+)\s*High,\s*(\d+)\s*Low\)/i.exec(t);
  if (!total) return undefined;
  const human = /Human-attention:\s*\**(\d+)/i.exec(t);
  const auto = /Auto-resolved[^:]*:\s*\**(\d+)/i.exec(t);
  const esc = /Escalation rate[^:]*:\s*\**(\d+)\/(\d+)/i.exec(t);
  const firing = /Still firing:\s*\**(\d+)\s*active\s*\/\s*(\d+)\s*stale/i.exec(t);
  return {
    totalAlerts: Number(total[1]),
    highAlerts: Number(total[2]),
    lowAlerts: Number(total[3]),
    humanAttention: human ? Number(human[1]) : 0,
    autoResolved: auto ? Number(auto[1]) : 0,
    escalationNum: esc ? Number(esc[1]) : 0,
    escalationDen: esc ? Number(esc[2]) : Number(total[1]),
    activeFiring: firing ? Number(firing[1]) : 0,
    staleFiring: firing ? Number(firing[2]) : 0,
  };
}

// ── Recommendations (tuning table) ──────────────────────────────────────────

function statusFrom(text: string): RecommendationStatus {
  const t = text.toLowerCase();
  if (t.includes("strongly")) return RecommendationStatus.StronglyRecommend;
  if (t.includes("validated")) return RecommendationStatus.Validated;
  if (t.includes("regressed")) return RecommendationStatus.Regressed;
  if (t.includes("applied")) return RecommendationStatus.Applied;
  if (t.includes("resolved")) return RecommendationStatus.Resolved;
  if (t.includes("recommend")) return RecommendationStatus.Recommend;
  return RecommendationStatus.Proposed;
}

function confidenceFrom(text: string): Confidence {
  const t = text.toLowerCase();
  if (t.startsWith("high") || t.includes("high")) return Confidence.High;
  if (t.startsWith("med") || t.includes("medium")) return Confidence.Medium;
  return Confidence.Low;
}

function issueTypeFrom(text: string): IssueType {
  const t = text.toLowerCase();
  if (/hpa|autoscal|saturation|utilization|cpu|memory/.test(t)) {
    if (/dev|non-prod|dev-eks/.test(t)) return IssueType.DevNoisePagingProd;
    return IssueType.InfraSaturationAutoscaled;
  }
  if (/apdex|anomal|ratio|volatile|deviation/.test(t)) return IssueType.VolatileDenominator;
  if (/no data|dead metric/.test(t)) return IssueType.DeadMetricNoData;
  if (/real failure|code bug|business-logic|do not tune/.test(t)) return IssueType.RecurringRealFailure;
  if (/duplicate|redundant/.test(t)) return IssueType.DuplicateRedundant;
  if (/stale|non-auto-resolving|lingering/.test(t)) return IssueType.StaleNonResolving;
  if (/ownership|routing review/.test(t)) return IssueType.OwnershipReview;
  return IssueType.ThresholdTooLoose;
}

/** Best-effort structured patch from the before -> after change text. */
function patchFrom(changeText: string, issueType: string): ProposedPatch | undefined {
  const t = changeText.toLowerCase();
  if (t.includes("incidentio-high") && t.includes("incidentio-low")) {
    return {
      target: "message",
      prod: { find: "@webhook-incidentio-high", replace: "@webhook-incidentio-low" },
    };
  }
  if (t.includes("last_5m") && t.includes("last_15m")) {
    return { target: "query", prod: { find: "last_5m", replace: "last_15m" } };
  }
  if (t.includes("last_2h") && t.includes("last_4h")) {
    return { target: "query", prod: { find: "last_2h", replace: "last_4h" } };
  }
  if (issueType === IssueType.InfraSaturationAutoscaled && t.includes("low")) {
    return {
      target: "message",
      prod: { find: "@webhook-incidentio-high", replace: "@webhook-incidentio-low" },
    };
  }
  return undefined;
}

function splitBeforeAfter(cell: string): { before: string; after: string; summary: string } {
  const summary = /^\s*\*\*(.+?)\*\*/.exec(cell)?.[1] ?? "";
  const before = /before:\s*(.+?)\s*after:/is.exec(cell)?.[1] ?? "";
  const after = /after:\s*(.+?)(?:_Coverage|_Impact|$)/is.exec(cell)?.[1] ?? "";
  return {
    before: clean(before) || "(see recommendation)",
    after: clean(after) || clean(cell),
    summary: clean(summary) || "Tuning recommendation",
  };
}

function parseRecommendations(md: string): NormalizedRecommendation[] {
  const sec = section(md, /Monitor Tuning Recommendations/i);
  if (!sec) return [];
  const rows = parseTable(sec);
  const out: NormalizedRecommendation[] = [];
  for (const cells of rows) {
    if (cells.length < 6) continue;
    const [monCell, issueCell, evidenceCell, changeCell, confCell, statusCell] = cells;
    const monitorId = monitorIdFrom(monCell);
    const monitorName = clean(monCell).replace(/^\d+\s*[—-]\s*/, "").trim() || `Monitor ${monitorId ?? "?"}`;
    const issue = clean(issueCell);
    const issueType = issueTypeFrom(issue + " " + changeCell);
    const { before, after, summary } = splitBeforeAfter(changeCell);
    out.push({
      monitorId,
      monitorKey: monitorId ?? clean(monCell).slice(0, 40),
      monitorName,
      issueType,
      title: summary,
      before,
      after,
      changeSummary: summary,
      evidence: clean(evidenceCell),
      confidence: confidenceFrom(clean(confCell)),
      status: statusFrom(statusCell),
      firesThisWeek: 0,
      patch: patchFrom(changeCell, issueType),
    });
  }
  return out;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

/**
 * `firedAt` is required by the schema, so an alert whose time the page never stated
 * still needs an instant. Anchor it to the start of the on-call week — defensible,
 * and it groups the alert into the right week — but record `firedAtTimeKnown: false`
 * so the UI shows no clock time rather than a confident wrong one. The previous
 * `?? new Date()` stamped these with the ingest time, which is how an alert that
 * paged at 02:17 came to read as 11:10.
 */
function firedAtFrom(
  text: string,
  tz: string,
  window?: { start: Date; end: Date },
): { firedAt: Date; firedAtTimeKnown: boolean } {
  const parsed = parseEventTime(text, { tz, window });
  if (parsed) {
    return { firedAt: parsed.at, firedAtTimeKnown: parsed.timeKnown };
  }
  return {
    firedAt: window?.start ?? new Date(),
    firedAtTimeKnown: false,
  };
}

/**
 * One record per firing when the finding enumerates repeats, else the single record
 * the page's row describes.
 *
 * The first firing keeps the row's own id: ids are the idempotency key for the
 * alert upsert and nothing prunes records that stop appearing, so minting a fresh
 * id for firing one would leave the previously stored row behind as a phantom
 * alert. Later firings take a suffix, stable as long as the page keeps them in
 * order.
 */
function perFiring(
  base: Omit<NormalizedAlert, "id" | "firedAt" | "firedAtTimeKnown">,
  id: string,
  finding: string,
  tz: string,
  window?: { start: Date; end: Date },
): NormalizedAlert[] {
  const firings = parseFiringTimes(finding, { tz, window });
  if (firings.length < 2) {
    return [{ ...base, id, ...firedAtFrom(finding, tz, window) }];
  }
  return firings.map((f, i) => ({
    ...base,
    id: i === 0 ? id : `${id}#${i + 1}`,
    firedAt: f.at,
    firedAtTimeKnown: f.timeKnown,
  }));
}

function parseRequiredAttention(
  md: string,
  tz: string,
  window?: { start: Date; end: Date },
): NormalizedAlert[] {
  const sec = section(md, /Required Human Attention/i);
  if (!sec) return [];
  const out: NormalizedAlert[] = [];
  for (const cells of parseTable(sec)) {
    if (cells.length < 5) continue;
    const [alertCell, priorityCell, serviceCell, , findingCell] = cells;
    const monitorId = monitorIdFrom(alertCell);
    const id = alertIdFrom(alertCell) ?? `cf-rha-${monitorId ?? clean(alertCell).slice(0, 12)}`;
    const finding = clean(findingCell);
    out.push(
      ...perFiring(
        {
          monitorId,
          source: "confluence",
          title: clean(alertCell).replace(/^Monitor\s*\d+\s*[—-]?\s*/i, "").trim() || "Alert",
          priority: /high/i.test(priorityCell) ? Priority.High : Priority.Low,
          status: /resolved|self-resolved|auto-resolved/i.test(finding) ? "resolved" : "firing",
          disposition: AlertDisposition.RequiredHumanAttention,
          firingKind: FiringKind.Resolved,
          env: clean(serviceCell) || undefined,
          timesFired: 1,
          finding,
        },
        id,
        finding,
        tz,
        window,
      ),
    );
  }
  return out;
}

function parseBulletAlerts(
  md: string,
  headingPattern: RegExp,
  disposition: string | undefined,
  firingKind: string,
  tz: string,
  window?: { start: Date; end: Date },
): NormalizedAlert[] {
  const sec = section(md, headingPattern);
  if (!sec) return [];
  const out: NormalizedAlert[] = [];
  for (const line of sec.split("\n")) {
    if (!/^\s*[*-]\s+/.test(line)) continue;
    const text = clean(line.replace(/^\s*[*-]\s+/, ""));
    const monitorId = monitorIdFrom(text);
    const id = alertIdFrom(text);
    if (!id && !monitorId) continue;
    out.push(
      ...perFiring(
        {
          monitorId,
          source: "confluence",
          title: text.slice(0, 140),
          priority: /high/i.test(text) ? Priority.High : Priority.Low,
          status: firingKind === FiringKind.Stale ? "firing" : "resolved",
          disposition: disposition as NormalizedAlert["disposition"],
          firingKind: firingKind as NormalizedAlert["firingKind"],
          timesFired: 1,
          finding: text,
        },
        id ?? `cf-${firingKind}-${monitorId}`,
        text,
        tz,
        window,
      ),
    );
  }
  return out;
}

// ── Vulnerabilities ─────────────────────────────────────────────────────────

function parseVuln(md: string): IngestBundle["vuln"] {
  const t = md.replace(/\s+/g, " ");
  const total = /Vulnerabilities:\**\s*\**(\d+)\s*open/i.exec(t);
  if (!total) return undefined;
  const ch = /(\d+)\s*Critical,\s*(\d+)\s*High/i.exec(t);
  return {
    total: Number(total[1]),
    critical: ch ? Number(ch[1]) : 0,
    high: ch ? Number(ch[2]) : 0,
    scope: "org-wide",
    source: "Confluence handoff",
  };
}

// ── Monitors (minimal, collected from recs + alerts for FK + links) ─────────

/**
 * Known service tags, longest first so the more specific tag wins: a title
 * naming `service-postman-internal` must not be attributed to `service-postman`.
 */
const KNOWN_SERVICE_TAGS = [
  ...new Set(GROWTH_TEAM_SERVICES.map((s) => s.name)),
].sort((a, b) => b.length - a.length);

/**
 * The weekly report has no service column, so a monitor's own title is the only
 * evidence tying it to a service.
 *
 * Matching is literal against the known catalog: a monitor is attributed only
 * when its title spells out that service's exact tag. Anything looser is left
 * unattributed on purpose — "OTGE" and "bank-transactions-neobank" both clearly
 * mean a catalog service to a human, but inferring it would let the ownership
 * view link a monitor to a service that does not own it, which is worse than
 * showing no link at all.
 */
export function serviceFromTitle(text: string): string | undefined {
  return KNOWN_SERVICE_TAGS.find((tag) => text.includes(tag));
}

function collectMonitors(
  recs: NormalizedRecommendation[],
  alerts: NormalizedAlert[],
): NormalizedMonitor[] {
  const appBase = getConfig().datadog.appBase;
  const byId = new Map<string, NormalizedMonitor>();
  const add = (id: string | undefined, name: string) => {
    if (!id) return;
    const existing = byId.get(id);
    if (existing) {
      // A monitor is mentioned in several places; a later one may name the
      // service the first omitted.
      existing.service ??= serviceFromTitle(name);
      return;
    }
    byId.set(id, {
      id,
      name,
      service: serviceFromTitle(name),
      priority: Priority.High,
      tags: [],
      state: MonitorState.Unknown,
      datadogUrl: `${appBase}/monitors/${id}`,
    });
  };
  for (const r of recs) add(r.monitorId, r.monitorName);
  for (const a of alerts) add(a.monitorId ?? undefined, a.title);
  return [...byId.values()];
}

// ── Top-level ───────────────────────────────────────────────────────────────

export function parseConfluence(
  handoffMd: string,
  now: Date = new Date(),
): IngestBundle {
  const tz = getConfig().team.timezone;
  const window = parseWindow(handoffMd, tz);
  const schedule = parseOnCall(handoffMd);
  const kpis = parseKpis(handoffMd);
  const pageRefresh = parseRefreshedAt(handoffMd, tz);
  const pageState = parsePageState(handoffMd);
  const coverage = parseCoverage(handoffMd, tz);
  const recommendations = parseRecommendations(handoffMd);
  const alerts = [
    ...parseRequiredAttention(handoffMd, tz, window),
    ...parseBulletAlerts(handoffMd, /Auto-Resolved/i, AlertDisposition.AutoResolved, FiringKind.Resolved, tz, window),
    ...parseBulletAlerts(handoffMd, /Open Going Into Handoff/i, undefined, FiringKind.Stale, tz, window),
  ];
  const vuln = parseVuln(handoffMd);
  const monitors = collectMonitors(recommendations, alerts);

  return {
    monitors,
    alerts,
    incidents: [], // handoff shows "No incidents" in the sample; extend if needed
    recommendations,
    vuln,
    schedule,
    kpis: kpis ?? undefined,
    window,
    pageRefresh,
    pageState,
    coverage,
    sourceStatus: {
      datadog: SourceStatus.Skipped,
      incidentio: SourceStatus.Skipped,
      jira: SourceStatus.Skipped,
    },
    notes: `Confluence source${kpis ? "" : " (KPI summary not parsed)"}${
      pageRefresh ? "" : " (no refresh stamp)"
    }`,
  };
}
