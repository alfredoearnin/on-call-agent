/**
 * Turns the handoff page's coverage check into a per-role verdict for the banner.
 *
 * Pure: imports only constants and types, takes `now` as an argument, touches no DB,
 * network, or clock. Same discipline as automations/health.ts, and for the same
 * reason — the honesty rules below are the part worth testing, so they must be
 * testable without a fixture server.
 *
 * The rule that matters: absence of a coverage check is `Unknown`, never
 * `Available`. A dashboard that says "available" when it simply did not ask is the
 * failure this feature exists to prevent.
 */

import { Coverage, CoverageRole } from "@/lib/constants";
import type { CoverageEntry, PageCoverage } from "@/lib/ingest/types";

export interface CoverageAssessment {
  state: Coverage;
  /**
   * One sentence stating what the page said, or why nothing is known. Rendered
   * verbatim — the UI must not paraphrase it.
   */
  evidence: string;
  /** Absence start, when the page stated one. */
  from?: Date;
  /** Absence end, when the page stated one. Used for "back on …". */
  to?: Date;
  /** The page said the underlying status had no expiry. */
  openEnded?: boolean;
}

export type CoverageAssessments = Record<CoverageRole, CoverageAssessment>;

const ROLES: CoverageRole[] = [
  CoverageRole.Primary,
  CoverageRole.Secondary,
  CoverageRole.NextPrimary,
  CoverageRole.NextSecondary,
];

const NO_CHECK =
  "The handoff page carried no coverage check, so availability was not verified.";

export function assessCoverage(input: {
  coverage?: PageCoverage;
  now: Date;
}): CoverageAssessments {
  const { coverage, now } = input;

  if (!coverage) return everyRole({ state: Coverage.Unknown, evidence: NO_CHECK });

  if (coverage.unavailableReason) {
    return everyRole({
      state: Coverage.Unknown,
      evidence: `Coverage could not be checked (${coverage.unavailableReason}) — verify availability manually.`,
    });
  }

  const out = {} as CoverageAssessments;
  for (const role of ROLES) {
    out[role] = assessRole(coverage.roles[role], now);
  }
  return out;
}

function assessRole(entry: CoverageEntry | undefined, now: Date): CoverageAssessment {
  if (!entry) {
    return { state: Coverage.Unknown, evidence: NO_CHECK };
  }

  if (entry.state === Coverage.Unknown) {
    return {
      state: Coverage.Unknown,
      evidence:
        entry.evidence ??
        "The coverage check did not report on this role, so availability is unknown.",
    };
  }

  if (entry.state === Coverage.Available) {
    return {
      state: Coverage.Available,
      evidence: entry.evidence ?? "The coverage check reported this role as available.",
    };
  }

  // A lapsed absence is not absence: someone who was out last week is back.
  if (entry.to && entry.to.getTime() < now.getTime()) {
    return {
      state: Coverage.Available,
      evidence: entry.evidence
        ? `${entry.evidence} — that absence has ended.`
        : "The stated absence has already ended.",
    };
  }

  // Still to come, or happening now. Both are coverage gaps worth flagging: an
  // absence starting mid-week is exactly what you want to fix before it starts.
  return {
    state: Coverage.OutOfOffice,
    evidence: entry.evidence ?? "The coverage check reported this role as out of office.",
    from: entry.from,
    to: entry.to,
    openEnded: entry.openEnded,
  };
}

function everyRole(a: CoverageAssessment): CoverageAssessments {
  return {
    [CoverageRole.Primary]: a,
    [CoverageRole.Secondary]: a,
    [CoverageRole.NextPrimary]: a,
    [CoverageRole.NextSecondary]: a,
  };
}

/** True when the absence has not started yet, so the banner can say "from" not "until". */
export function isUpcoming(a: { from?: Date }, now: Date): boolean {
  return Boolean(a.from && a.from.getTime() > now.getTime());
}

// ── DB round-trip ───────────────────────────────────────────────────────────

/**
 * Stored on IngestionRun.coverageJson. Dates go over as ISO strings, so the shape
 * is spelled out rather than cast — a malformed or older payload must degrade to
 * `undefined` (⇒ Unknown), never throw on a page render.
 */
interface StoredEntry {
  state?: string;
  from?: string;
  to?: string;
  openEnded?: boolean;
  evidence?: string;
}
interface StoredCoverage {
  checkedAt?: string;
  unavailableReason?: string;
  roles?: Partial<Record<string, StoredEntry>>;
}

export function serializeCoverage(coverage: PageCoverage): string {
  const roles: Record<string, StoredEntry> = {};
  for (const role of ROLES) {
    const e = coverage.roles[role];
    roles[role] = {
      state: e.state,
      from: e.from?.toISOString(),
      to: e.to?.toISOString(),
      openEnded: e.openEnded,
      evidence: e.evidence,
    };
  }
  return JSON.stringify({
    checkedAt: coverage.checkedAt,
    unavailableReason: coverage.unavailableReason,
    roles,
  });
}

export function deserializeCoverage(
  json: string | null | undefined,
): PageCoverage | undefined {
  if (!json) return undefined;
  let raw: StoredCoverage;
  try {
    raw = JSON.parse(json) as StoredCoverage;
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== "object") return undefined;

  const roles = {} as Record<CoverageRole, CoverageEntry>;
  for (const role of ROLES) {
    const e = raw.roles?.[role];
    roles[role] = {
      state: toCoverage(e?.state),
      from: toDate(e?.from),
      to: toDate(e?.to),
      openEnded: e?.openEnded,
      evidence: e?.evidence,
    };
  }
  return {
    checkedAt: raw.checkedAt,
    unavailableReason: raw.unavailableReason,
    roles,
  };
}

function toCoverage(value: string | undefined): Coverage {
  if (value === Coverage.Available) return Coverage.Available;
  if (value === Coverage.OutOfOffice) return Coverage.OutOfOffice;
  return Coverage.Unknown;
}

function toDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
