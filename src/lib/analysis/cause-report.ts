import * as z from "zod/v4";

/**
 * Reading the cause-investigation agent's findings out of a Confluence page.
 *
 * The page carries two things: prose for whoever opens it, and one fenced JSON
 * block for the dashboard. That split is deliberate and it is the lesson from
 * the handoff pipeline, where the dashboard extracted counts from English
 * sentences and lost twenty of twenty-three firings — not because the parser
 * was careless but because prose is not a data format. Numbers come from the
 * block; the page stays readable.
 *
 * A page without a block is still useful: the dashboard links to it and says
 * the findings are unstructured, rather than pretending nothing is there.
 */

const VERDICTS = ["noise_only", "real_defect", "undetermined"] as const;

/** The contract the prompt is required to emit. */
export const CauseReportSchema = z.object({
  monitorId: z.string().min(1),
  investigatedAt: z.string().min(1),
  verdict: z.enum(VERDICTS),
  /** One or two sentences. Null when the verdict is `undetermined`. */
  cause: z.string().nullable(),
  /** What the conclusion rests on — a trace id, a link, a metric window. */
  evidence: z.array(z.string()).default([]),
  /** Jira keys filed for real defects. */
  tickets: z.array(z.string()).default([]),
  /** Whether the trigger delivered a monitorId, which the prompt must report. */
  receivedMonitorId: z.boolean().optional(),
  /** Anything the agent could not do — missing tools, no repo access. */
  limitations: z.array(z.string()).default([]),
});

export type CauseReport = z.infer<typeof CauseReportSchema>;

export interface ParsedCausePage {
  /** The structured block, when the page carried a valid one. */
  report?: CauseReport;
  /**
   * Why there is no report, when there is none. Shown to the operator rather
   * than swallowed: "the agent wrote a page the dashboard could not read" and
   * "the agent found nothing" are different situations.
   */
  problem?: string;
}

/** Fenced blocks tagged json, which is what the prompt asks the agent to emit. */
const FENCED_JSON = /```(?:json)?\s*\n([\s\S]*?)```/g;

/**
 * Pull the first valid cause report out of a page body.
 *
 * Confluence storage format wraps code blocks in macro markup, and the export
 * the API returns depends on which representation was requested, so this scans
 * for fenced blocks anywhere in the text rather than assuming a structure. Any
 * block that is not a valid report is skipped, not fatal — a page may legitimately
 * contain other code samples.
 */
export function parseCausePage(body: string): ParsedCausePage {
  if (!body.trim()) return { problem: "The page is empty." };

  const candidates = [...body.matchAll(FENCED_JSON)].map((m) => m[1]);
  if (candidates.length === 0) {
    return {
      problem:
        "No structured block found on the page — open it to read the findings.",
    };
  }

  let sawJson = false;
  for (const raw of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    sawJson = true;
    const result = CauseReportSchema.safeParse(parsed);
    if (result.success) return { report: result.data };
  }

  return {
    problem: sawJson
      ? "The page's structured block does not match the expected shape."
      : "The page's code block is not valid JSON.",
  };
}

/** Human label for a verdict, for the dashboard. */
export function verdictLabel(verdict: CauseReport["verdict"]): string {
  switch (verdict) {
    case "noise_only":
      return "Noise only";
    case "real_defect":
      return "Real defect";
    case "undetermined":
      return "Undetermined";
  }
}

/**
 * The Confluence page title for one monitor's investigation.
 *
 * Keyed on the monitor id so the dashboard can find the page without storing
 * an id or being told a URL. The prefix is configurable and may be empty, in
 * which case the title is the bare id.
 */
export function causePageTitle(monitorId: string, prefix: string): string {
  return prefix ? `${prefix}${monitorId}` : monitorId;
}

/**
 * Whether a page title belongs to this monitor.
 *
 * Matches on the id as a whole token rather than a substring, because monitor
 * ids nest: `1435` would otherwise claim `143509449`. Accepts any surrounding
 * text so the agent can title the page readably without breaking the lookup.
 */
export function titleMatchesMonitor(title: string, monitorId: string): boolean {
  const escaped = monitorId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^0-9])${escaped}([^0-9]|$)`).test(title);
}
