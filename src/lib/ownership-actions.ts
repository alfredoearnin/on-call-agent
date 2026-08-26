"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { OwnershipAction } from "@/lib/constants";
import { isActionAllowed, serviceByName, verdictFor } from "@/lib/team-services";

export interface OwnershipDecisionResult {
  ok: boolean;
  message: string;
}

const VALID_ACTIONS: string[] = Object.values(OwnershipAction);

/**
 * Record a decision about a service's on-call ownership.
 *
 * Writes nothing outside this database: Cortex holds the authoritative owner and
 * the app has no write client for it, so this records intent and the hand-off
 * ticket stays manual. See the OwnershipDecision model comment.
 *
 * Both arguments are re-validated here rather than trusted. The buttons are
 * derived from the verdict, so a request naming an action the evidence does not
 * support — conceding a service Cortex already gives us, handing off one nobody
 * agreed to transfer — either comes from a stale page or is forged, and neither
 * should reach the audit trail.
 */
export async function recordOwnershipDecisionAction(
  serviceName: string,
  action: string,
  targetTeam?: string | null,
): Promise<OwnershipDecisionResult> {
  const cfg = getConfig();

  const service = serviceByName(serviceName);
  if (!service) {
    return { ok: false, message: "Unknown service." };
  }
  if (!VALID_ACTIONS.includes(action)) {
    return { ok: false, message: "Unknown action." };
  }
  if (!isActionAllowed(service, action, targetTeam)) {
    return {
      ok: false,
      message:
        "That action does not match the current finding for this service. Reload and try again.",
    };
  }

  const current = await currentDecision(serviceName);
  if (
    current &&
    current.action === action &&
    (current.targetTeam ?? null) === (targetTeam ?? null)
  ) {
    return { ok: true, message: "Already recorded." };
  }

  await prisma.ownershipDecision.create({
    data: {
      service: serviceName,
      action,
      targetTeam: targetTeam ?? null,
      verdict: verdictFor(service),
      operator: cfg.apply.operator,
    },
  });

  revalidatePath("/services");
  revalidatePath("/");

  return { ok: true, message: "Decision recorded." };
}

/** Undo the newest decision for a service, keeping it in the trail. */
export async function revokeOwnershipDecisionAction(
  decisionId: string,
): Promise<OwnershipDecisionResult> {
  const decision = await prisma.ownershipDecision.findUnique({
    where: { id: decisionId },
  });
  if (!decision) {
    return { ok: false, message: "Decision not found." };
  }
  if (decision.revokedAt) {
    return { ok: true, message: "Already undone." };
  }

  await prisma.ownershipDecision.update({
    where: { id: decisionId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/services");
  revalidatePath("/");

  return { ok: true, message: "Decision undone." };
}

async function currentDecision(serviceName: string) {
  return prisma.ownershipDecision.findFirst({
    where: { service: serviceName, revokedAt: null },
    orderBy: { decidedAt: "desc" },
  });
}
