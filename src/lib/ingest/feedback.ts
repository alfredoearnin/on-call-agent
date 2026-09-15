import { prisma } from "@/lib/db";
import { AppliedChangeStatus, RecommendationStatus } from "@/lib/constants";
import type { ProposedPatch } from "@/lib/ingest/types";
import { parseStoredPatch } from "@/lib/ingest/patch-schema";
import { appliedInSnapshotHistory } from "@/lib/monitor-config";

export interface FeedbackResult {
  applied: number;
  validated: number;
  regressed: number;
}

/**
 * How long a change must stand before "no firings" means anything.
 *
 * One on-call week, the unit the rest of the dashboard measures in. Without a
 * floor, a change applied ten minutes ago reads as validated because nothing
 * has fired in those ten minutes — which is not evidence, it is the absence of
 * it.
 */
const OBSERVATION_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Feedback loop (the agent prompt, Step 0.5). After monitors + recommendations are
 * persisted, detect whether a recommended change was applied — either via a
 * recorded AppliedChange (this dashboard's apply feature) or by observing the
 * recommended transform appear in the monitor's snapshot history (someone
 * applied it out-of-band). Then measure the outcome:
 *   - fired again since it was applied        -> regressed
 *   - applied less than a week ago, no fires  -> applied (not yet judged)
 *   - a week clear                            -> validated
 * Derived ONLY from observed config/fires, never from assumed human intent.
 *
 * The comparison is against the apply instant, not against the calendar week.
 * Reading `firesThisWeek` put every change applied mid-week straight into
 * `regressed`: the week's firings are the ones that motivated the change, so
 * they are counted as its failure. Monitor 243692163 was applied on a Monday
 * with seven firings behind it from the Wednesday before, and the three
 * recommendations that fixed it were reported as having made it worse — then
 * offered for re-application, one of them with a patch that would have nested
 * its own replacement in the monitor's routing.
 */
/**
 * What an applied change has shown so far.
 *
 * `applied` is a real verdict, not a placeholder: the change is in place and
 * nothing has fired, but not for long enough to mean anything. It reads as
 * settled in the UI, which is the point — there is no decision left to make
 * until the week is out.
 */
export function judgeOutcome(
  appliedAt: Date | undefined,
  lastFiredAt: Date | null,
  now: Date,
): { status: string; outcome: string } {
  if (lastFiredAt && appliedAt && lastFiredAt > appliedAt) {
    return {
      status: RecommendationStatus.Regressed,
      outcome: "Applied, then fired again — propose the next step.",
    };
  }
  if (!appliedAt) {
    return {
      status: RecommendationStatus.Applied,
      outcome:
        "Change observed in the monitor's history, with no recorded apply to measure from.",
    };
  }
  const days = (now.getTime() - appliedAt.getTime()) / DAY_MS;
  if (days < OBSERVATION_DAYS) {
    return {
      status: RecommendationStatus.Applied,
      outcome: `Applied; no firing since. Too early to confirm — ${OBSERVATION_DAYS} days of quiet is the bar.`,
    };
  }
  return {
    status: RecommendationStatus.Validated,
    outcome: `Applied and quiet for ${Math.floor(days)} days.`,
  };
}

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
  const now = new Date();

  for (const rec of recs) {
    const patch: ProposedPatch | null = rec.patchJson
      ? parseStoredPatch(rec.patchJson)
      : null;

    const applies = rec.appliedChanges.filter(
      (c) => c.status === AppliedChangeStatus.Applied,
    );
    let detectedApplied = applies.length > 0;
    // The most recent apply is the one on trial: an earlier one that regressed
    // and was applied again should be judged from the second attempt. Undefined
    // for an out-of-band change, which has no recorded instant to measure from.
    const appliedAt: Date | undefined = applies.reduce<Date | undefined>(
      (latest, c) => (!latest || c.appliedAt > latest ? c.appliedAt : latest),
      undefined,
    );

    // Out-of-band detection, judged from the snapshot history rather than the
    // current config: a handle named in the monitor's boilerplate prose would
    // otherwise read as applied. See appliedInSnapshotHistory.
    if (!detectedApplied && patch && rec.monitor) {
      detectedApplied = appliedInSnapshotHistory(patch, rec.monitor.snapshots);
    }

    if (!detectedApplied) continue;
    result.applied += 1;

    const { status: nextStatus, outcome } = judgeOutcome(
      appliedAt,
      rec.lastFiredAt,
      now,
    );

    if (nextStatus === RecommendationStatus.Validated) result.validated += 1;
    else if (nextStatus === RecommendationStatus.Regressed) result.regressed += 1;

    if (rec.status !== nextStatus) {
      await prisma.tuningRecommendation.update({
        where: { id: rec.id },
        data: { status: nextStatus, outcome, lastUpdated: new Date() },
      });
    }
  }

  return result;
}
