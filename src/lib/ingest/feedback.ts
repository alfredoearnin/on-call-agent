import { prisma } from "@/lib/db";
import { AppliedChangeStatus, RecommendationStatus } from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";

export interface FeedbackResult {
  applied: number;
  validated: number;
  regressed: number;
}

/**
 * Feedback loop (on-call.md Step 0.5). After monitors + recommendations are
 * persisted, detect whether a recommended change was applied — either via a
 * recorded AppliedChange (this dashboard's apply feature) or by observing the
 * recommended transform already present in the monitor's live config (someone
 * applied it out-of-band). Then measure the outcome:
 *   - applied + no fires this week  -> validated
 *   - applied + fires returned      -> regressed
 * Derived ONLY from observed config/fires, never from assumed human intent.
 */
export async function reconcileFeedback(): Promise<FeedbackResult> {
  const recs = await prisma.tuningRecommendation.findMany({
    include: { monitor: true, appliedChanges: true },
  });

  const result: FeedbackResult = { applied: 0, validated: 0, regressed: 0 };

  for (const rec of recs) {
    const patch: ProposedPatch | null = rec.patchJson
      ? (JSON.parse(rec.patchJson) as ProposedPatch)
      : null;

    let detectedApplied = rec.appliedChanges.some(
      (c) => c.status === AppliedChangeStatus.Applied,
    );

    // Out-of-band detection: the recommended transform is already present.
    if (!detectedApplied && patch && rec.monitor) {
      const field =
        patch.target === "query"
          ? rec.monitor.query
          : patch.target === "message"
            ? rec.monitor.message
            : null;
      const branch = patch.prod ?? patch.dev;
      if (
        field &&
        branch &&
        field.includes(branch.replace) &&
        !field.includes(branch.find)
      ) {
        detectedApplied = true;
      }
    }

    if (!detectedApplied) continue;
    result.applied += 1;

    const nextStatus =
      rec.firesThisWeek === 0
        ? RecommendationStatus.Validated
        : RecommendationStatus.Regressed;

    if (nextStatus === RecommendationStatus.Validated) result.validated += 1;
    else result.regressed += 1;

    if (rec.status !== nextStatus) {
      await prisma.tuningRecommendation.update({
        where: { id: rec.id },
        data: {
          status: nextStatus,
          outcome:
            nextStatus === RecommendationStatus.Validated
              ? "Applied change confirmed; noise dropped this week."
              : "Applied change detected but noise returned — propose the next step.",
          lastUpdated: new Date(),
        },
      });
    }
  }

  return result;
}
