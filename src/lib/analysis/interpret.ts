import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { IssueType } from "@/lib/constants";
import type { MonitorEvidence } from "./evidence";
import { anthropicApiKey } from "./secrets";

/**
 * Interpreting an evidence bundle into one recommendation.
 *
 * The model never queries anything. Every number it reasons over was gathered
 * deterministically and is on the bundle, which means it cannot invent a metric
 * and a reviewer can check the conclusion against the same figures. What is
 * delegated is judgement: which of several true statements about a monitor is
 * the one worth acting on, whether the firing is noise or a real defect, and
 * what the patch should be.
 *
 * The rules in `monitor-query.ts` and `evidence.ts` have already settled the
 * mechanical questions and their findings arrive on the bundle. The prompt
 * tells the model to reason from them rather than re-derive them: a tested rule
 * is worth more than a re-litigated one.
 */

const MODEL = "claude-opus-5";
/** Non-streaming, so keep the ceiling under the SDK's HTTP timeout. */
const MAX_TOKENS = 16_000;

export const ANALYSIS_RULES = `You review Datadog monitors for an on-call rotation and decide what, if
anything, to change about one monitor.

You are given an evidence bundle gathered from Datadog and incident.io. You
cannot query anything. Every claim you make must be traceable to a field in
that bundle; if the bundle does not support a conclusion, say so rather than
supplying a plausible one.

The bundle already carries findings from deterministic rules under
\`findings\`. Treat them as established and reason from them. Do not restate
them as your own discovery, and do not contradict one without pointing at the
bundle field that shows it wrong.

## How to read the evidence

1. **Per-resource before anything else.** \`metric.byResource\` splits the
   alerting metric by endpoint. A spike confined to one business endpoint is a
   slow request. A spike that hits every endpoint at once — including
   Kubernetes liveness or readiness probes that normally answer in under a
   millisecond — is a stalled process, not latency. Those have different
   remedies and must not be conflated.

2. **When everything degraded together, look at infrastructure.**
   \`findings.probeContamination.allEndpointsDegradedTogether\` together with
   \`infra\` (CPU throttling, restarts, memory). CPU throttling with no
   restarts and flat memory is a container CPU limit, and the remedy is the
   limit, not the monitor's threshold.

3. **Sample size decides whether a percentile means anything.**
   \`findings.percentileStability\`. A p90 over a handful of samples per
   evaluation interval is the second-slowest request: it tracks the extreme
   tail and moves by orders of magnitude on one slow call. Such a monitor is
   mis-specified, not mis-tuned.

4. **The aggregation is a separate defect from the threshold.**
   \`findings.aggregation.singleIntervalContribution\` is how much one extreme
   interval adds to the window statistic on its own. **If that number already
   exceeds the critical threshold, do not recommend changing the threshold** —
   no value below that contribution can suppress the firing, so recommending
   one sends the team to do work that cannot help. Recommend the window
   function instead (an averaged window to a minimum, a longer window,
   \`require_full_window\`), or a narrower query scope.

5. **A warning threshold that pages is its own defect.**
   \`findings.warnRouting.warnPagesLikeCritical\`. The remedy is gating the
   paging handle to the alert transition, not moving either threshold.

6. **Count from the bundle.** \`pages\` holds the firing and page history.
   Never state a count you did not read there.

## Noise versus a real defect

A monitor that fires repeatedly, resolves itself in minutes, produces no
incident, and is acknowledged in seconds is reporting something true about a
transient condition and something false about its urgency. That is noise, and
the monitor should change.

A monitor that fires because the service genuinely misbehaves is not noise,
even when it self-resolves. Say so, set \`isNoise\` to false, and put the
engineering work in \`followUps\` — never tune a monitor to stop reporting a
real defect. Both can be true at once: a monitor can be mis-specified *and*
have surfaced a genuine bug.

## The patch

Return at most one patch, and only when a monitor edit is the right remedy.
A patch is a find/replace on the monitor's \`query\` or \`message\`, a new
\`priority\`, or values set under \`options\`. **The \`find\` string must appear
verbatim in the monitor's current text as given in the bundle** — it is applied
by literal substitution, so a \`find\` that does not match produces a no-op
that looks like a fix.

Leave \`patch\` null when the remedy is not a monitor edit: a code fix, a
capacity change, retiring a monitor, or a decision that needs a human. Explain
why in \`summary\` and use \`followUps\`.

Be specific and brief. \`summary\` is read by someone deciding whether to click
Apply.`;

const BranchSchema = z.object({
  find: z.string().min(1),
  replace: z.string(),
});

const PatchSchema = z.object({
  target: z.enum(["message", "query", "priority", "options"]),
  prod: BranchSchema.nullable(),
  dev: BranchSchema.nullable(),
  priorityValue: z.number().nullable(),
  options: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.union([z.boolean(), z.number(), z.string()]),
      }),
    )
    .nullable(),
});

/**
 * The response contract.
 *
 * Kept free of `.refine()` and other constructs that do not survive
 * translation into JSON Schema, because this same object is what constrains
 * the model. Semantic checks that cannot be expressed here run in
 * `patchProblem` after parsing.
 */
export const AnalysisResultSchema = z.object({
  issueType: z.enum(Object.values(IssueType) as [string, ...string[]]),
  title: z.string().min(1),
  summary: z.string().min(1),
  rootCause: z.string().nullable(),
  isNoise: z.boolean(),
  confidence: z.enum(["high", "med", "low"]),
  coveragePreserved: z.string(),
  expectedImpact: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  patch: PatchSchema.nullable(),
  followUps: z.array(
    z.object({
      kind: z.enum(["code_fix", "infra", "monitor_retirement", "investigation"]),
      summary: z.string().min(1),
    }),
  ),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AnalysisPatch = NonNullable<AnalysisResult["patch"]>;

/**
 * Why a patch cannot be applied, or null when it can.
 *
 * Two checks the schema cannot express, both of which would otherwise produce
 * an Apply button that does nothing:
 *
 *  - a patch with no change for its own target;
 *  - a `find` string that does not occur in the text it claims to edit, which
 *    the apply path would treat as a drift no-op.
 *
 * Catching these here means the recommendation is stored without a patch and
 * the UI says so, instead of offering a button that silently fails.
 */
export function patchProblem(
  patch: AnalysisPatch,
  monitor: { query?: string | null; message?: string | null },
): string | null {
  if (patch.target === "priority") {
    return patch.priorityValue == null
      ? "patch sets no priority value"
      : null;
  }
  if (patch.target === "options") {
    return (patch.options?.length ?? 0) === 0
      ? "patch sets no monitor options"
      : null;
  }

  const branch = patch.prod ?? patch.dev;
  if (!branch) return "patch carries no find/replace for its target";

  const current =
    (patch.target === "query" ? monitor.query : monitor.message) ?? "";
  if (!current.includes(branch.find)) {
    return `patch looks for text that is not in the monitor's ${patch.target}`;
  }
  if (branch.find === branch.replace) return "patch replaces text with itself";
  return null;
}

export interface InterpretOutcome {
  result: AnalysisResult;
  /** Zero across repeated runs means a silent cache invalidator in the rules. */
  cacheReadTokens?: number;
}

/**
 * One structured-output call over the evidence bundle.
 *
 * The rules go first behind a cache breakpoint and the volatile bundle after,
 * so repeated analyses reuse the prefix. Thinking is adaptive because the fixed
 * token budget was removed on this model tier; `effort` is the knob that
 * replaced it.
 */
export async function interpretEvidence(
  evidence: MonitorEvidence,
): Promise<InterpretOutcome> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });

  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: zodOutputFormat(AnalysisResultSchema),
    },
    system: [
      {
        type: "text",
        text: ANALYSIS_RULES,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Evidence bundle:\n\n${JSON.stringify(evidence, null, 2)}`,
      },
    ],
  });

  if (message.stop_reason === "refusal") {
    throw new Error("The interpretation request was declined.");
  }
  if (!message.parsed_output) {
    throw new Error(
      `No interpretation returned (stop_reason: ${message.stop_reason ?? "unknown"}).`,
    );
  }

  return {
    result: message.parsed_output,
    cacheReadTokens: message.usage?.cache_read_input_tokens ?? undefined,
  };
}
