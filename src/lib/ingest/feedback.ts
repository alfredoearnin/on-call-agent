import { prisma } from "@/lib/db";
import { AppliedChangeStatus, RecommendationStatus } from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";
import { appliedInSnapshotHistory } from "@/lib/monitor-config";

export interface FeedbackResult {
  applied: number;
  validated: number;
  regressed: number;
}

/**
 * Feedback loop (the agent prompt, Step 0.5). After monitors + recommendations are
 * persisted, detect whether a recommended change was applied — either via a
 * recorded AppliedChange (this dashboard's apply feature) or by observing the
 * recommended transform appear in the monitor's snapshot history (someone
 * applied it out-of-band). Then measure the outcome:
 *   - applied + no fires this week  -> validated
 *   - applied + fires returned      -> regressed
 * Derived ONLY from observed config/fires, never from assumed human intent.
 */
export async function reconcileFeedback(): Promise<FeedbackResult> {
  const recs = await prisma.tuningRecommendation.findMany({
    include: {
      appliedChanges: true,
      monitor: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "asc" },
            select: { query: true, message: true, priority: true },
          },
        },
      },
    },
  });

  const result: FeedbackResult = { applied: 0, validated: 0, regressed: 0 };

  for (const rec of recs) {
    const patch: ProposedPatch | null = rec.patchJson
      ? (JSON.parse(rec.patchJson) as ProposedPatch)
      : null;

    let detectedApplied = rec.appliedChanges.some(
      (c) => c.status === AppliedChangeStatus.Applied,
    );

    // Out-of-band detection, judged from the snapshot history rather than the
    // current config: a handle named in the monitor's boilerplate prose would
    // otherwise read as applied. See appliedInSnapshotHistory.
    if (!detectedApplied && patch && rec.monitor) {
      detectedApplied = appliedInSnapshotHistory(patch, rec.monitor.snapshots);
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
