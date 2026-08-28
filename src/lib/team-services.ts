/**
 * Growth Team service ownership, reconciled across three sources on 2026-08-25.
 *
 * The three sources disagree, and the disagreement is the point:
 *
 * 1. Sheet   — "Growth Ownership Inventory", the team's own intent per service
 *              (Keep / Hand-off / Deprecate). This is what Growth *believes* it owns.
 *              https://docs.google.com/spreadsheets/d/1q3hTz3fO3SXSiPvy-255mCtvGqg9eQ5VkR-5w6RFC00
 * 2. Cortex  — `owningTeamTags` read live from the catalog. This is what the org
 *              *records*, and it drives paging and escalation.
 * 3. Datadog — monitors tagged to the team, which is what actually wakes someone up.
 *
 * An earlier version of this file collapsed 1 and 2 into a single `cortexOwner`
 * field asserting "L2-PENG-Growth" on nearly every entry. Cortex attributes only
 * eight services to Growth in total, so most of those assertions named a tag that
 * does not exist. Intent and record are separate facts and are stored separately
 * here; `verdictFor()` derives the disagreement instead of hardcoding a winner.
 */

import { OwnershipAction } from "@/lib/constants";

export type ServiceDomain =
  | "referrals"
  | "notifications"
  | "conversational-onboarding"
  | "activation"
  | "postman"
  | "cashout"
  | "address-book"
  | "payroll"
  | "earnings"
  | "max-boost"
  | "links"
  | "frontend"
  | "marketing"
  | "ai-ops"
  | "tooling";

/** What the Growth Ownership Inventory sheet says the team intends to do with it. */
export type SheetIntent = "keep" | "hand-off" | "deprecate" | "not-listed";

export type OwnershipVerdict =
  /** Sheet claims it and Cortex agrees Growth is an owner. */
  | "corroborated"
  /** Sheet claims it, Cortex attributes it to another team. A boundary decision. */
  | "disputed"
  /** No defensible basis for keeping it in the on-call scope. */
  | "unsupported";

/** Why an unsupported entry should leave the on-call scope. */
export type DropReason =
  /**
   * The inventory marks it for transfer to another team. The sheet's column is
   * `Hand Over? (Y/N)` — an intent — so this never means the transfer happened.
   */
  | "handed-off"
  /** Slated for deletion, not transfer. */
  | "deprecated"
  /** The tag does not exist in Cortex — it cannot be owned or paged by name. */
  | "unknown-tag"
  /** Cortex names another team and the sheet never claimed it. */
  | "other-team";

export interface TeamService {
  /** Datadog / Cortex service tag. */
  name: string;
  /** Human-friendly label when the tag alone is opaque. */
  label?: string;
  domain: ServiceDomain;
  /** The team's own position, from the ownership inventory sheet. */
  sheetIntent: SheetIntent;
  /** Team the sheet names as the hand-off target (only when intent is "hand-off"). */
  handoffTarget?: string;
  /**
   * The inventory's `Recommendation` column, verbatim, and set only when it
   * disagrees with that row's `Hand Over?` column — `Keep?` beside `Yes`.
   *
   * `sheetIntent` has to pick one value, and it follows `Hand Over?`. Recording
   * the losing column keeps the row honest: the sheet is the authority on intent,
   * so where the sheet is undecided the dashboard says so instead of presenting
   * the team's open question as a settled decision.
   */
  sheetRecommendation?: string;
  /**
   * Cortex `owningTeamTags`, verified 2026-08-25.
   * An empty array means the tag was not found in the Cortex catalog at all.
   */
  cortexOwners: string[];
  /** Evidence or context for the verdict. Shown verbatim in the dashboard. */
  note?: string;
}

/** Owner tags that count as Growth for the purpose of on-call scope. */
const GROWTH_OWNER_TAGS = ["L2-PENG-Growth", "L3-PENG-Growth"];

/** Link to the Cursor canvas used for the Growth service audit. */
export const GROWTH_SERVICES_CANVAS_URL =
  "https://cursor.com/dashboard/shared-canvases?shareId=canvas-nfAGiEJRhdQkoJbdBk5vRJBd";

/** Confluence ownership triage doc (Cortex catalog review). */
export const CORTEX_OWNERSHIP_TRIAGE_URL =
  "https://earnin.atlassian.net/wiki/spaces/GROW/pages/5058101368";

/** The team-maintained ownership inventory that supplies `sheetIntent`. */
export const OWNERSHIP_INVENTORY_URL =
  "https://docs.google.com/spreadsheets/d/1q3hTz3fO3SXSiPvy-255mCtvGqg9eQ5VkR-5w6RFC00/edit?gid=937708550#gid=937708550";

/** When the three sources were last reconciled. */
export const OWNERSHIP_REVIEWED_ON = "2026-08-25";

const DOMAIN_LABELS: Record<ServiceDomain, string> = {
  referrals: "Referrals",
  notifications: "Notifications",
  "conversational-onboarding": "Conversational onboarding",
  activation: "Activation / user lifecycle",
  postman: "Postman (messaging)",
  cashout: "Cashout funnel",
  "address-book": "Address book",
  payroll: "Payroll / neobank",
  earnings: "Earnings",
  "max-boost": "Max Boost (DCM)",
  links: "Short links",
  frontend: "Frontend",
  marketing: "Marketing web & SEO",
  "ai-ops": "Growth AI ops",
  tooling: "Growth tooling",
};

const DOMAIN_ORDER: ServiceDomain[] = [
  "referrals",
  "conversational-onboarding",
  "notifications",
  "marketing",
  "ai-ops",
  "tooling",
  "max-boost",
  "address-book",
  "postman",
  "links",
  "frontend",
  "activation",
  "cashout",
  "payroll",
  "earnings",
];

/**
 * Every service the on-call scope has ever claimed, with the evidence for and
 * against. Nothing is silently dropped: entries that should leave the rotation
 * stay here carrying their reason, so the dashboard can show what was removed
 * and why rather than quietly shrinking.
 */
export const GROWTH_TEAM_SERVICES: TeamService[] = [
  // ── Cortex agrees Growth is an owner ──────────────────────────────────────
  {
    name: "svc-referral",
    label: "Referrals API",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L2-PENG-Growth", "L3-PENG-Discovery"],
    note: "Core referral API, co-owned with Discovery in Cortex.",
  },
  {
    name: "svc-notification-preferences",
    label: "Notification preferences",
    domain: "notifications",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Growth"],
    note: "Sole Growth owner in Cortex.",
  },
  {
    name: "svc-conversational-onboarding",
    label: "Conversational onboarding",
    domain: "conversational-onboarding",
    sheetIntent: "keep",
    cortexOwners: [
      "L2-PENG-Growth",
      "L3-PENG-Growth",
      "L3-PENG-Activation",
      "L3-PENG-Discovery",
    ],
    note: "Four owning teams in Cortex — clarify who takes the page.",
  },
  {
    name: "svc-growth-ai-ops",
    label: "Growth AI operations",
    domain: "ai-ops",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Growth", "L3-PENG-Discovery"],
    note: "Conversation grading feedback loop.",
  },
  {
    name: "svc-mark-tech",
    label: "Marketing tech",
    domain: "marketing",
    sheetIntent: "keep",
    cortexOwners: ["L2-PENG-Growth"],
    note: "Sole Growth owner in Cortex. A previous review flag guessed Web Platform; both the sheet and Cortex contradict it.",
  },
  {
    name: "cronjob-mark-tech-crons",
    label: "Marketing tech crons",
    domain: "marketing",
    sheetIntent: "keep",
    cortexOwners: ["L2-PENG-Growth"],
    note: "Sole Growth owner in Cortex, tier:1. Separately, its P5 monitor over-routes to incident.io High.",
  },
  {
    name: "seo-agents-tool",
    label: "SEO agents tool",
    domain: "marketing",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Growth"],
    note: "Sole Growth owner in Cortex. Was missing from the catalog entirely.",
  },
  {
    name: "svc-growth-spring-internal-tools",
    label: "Growth internal tools backend",
    domain: "tooling",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Growth"],
    note: "Sole Growth owner in Cortex. Was missing from the catalog entirely.",
  },

  // ── Sheet claims it, Cortex names another team ────────────────────────────
  {
    name: "svc-referral-user-signup-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "svc-referral-user-employer-updates-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "svc-referral-cashout-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "svc-referral-user-started-tys-account-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "svc-referral-earlypay-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "Sheet keeps it; was missing from the catalog while four sibling processors were listed.",
  },
  {
    name: "svc-referral-product-enrollment-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "Sheet keeps it; was missing from the catalog.",
  },
  {
    name: "svc-referral-trusted-earner-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "tier:1. Sheet keeps it; was missing from the catalog.",
  },
  {
    name: "svc-referral-workhub-migration-processor",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "Sheet keeps it; was missing from the catalog.",
  },
  {
    name: "service-postman-internal",
    label: "Postman internal (gRPC)",
    domain: "postman",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Activation"],
    note: "tier:1. Growth owns the six SQS queues behind this service but not the service itself — a queue backlog pages Growth, a code bug belongs to Activation.",
  },
  {
    name: "job-postman-send-message-processor",
    domain: "postman",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "Its send-message queues and DLQs are tagged L3-PENG-Growth across three AWS accounts.",
  },
  {
    name: "service-address-book-external",
    label: "Address book (external API)",
    domain: "address-book",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "The catalog previously carried the non-existent tag service-address-book.",
  },
  {
    name: "job-address-book-address-book-new-user-processor",
    domain: "address-book",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "job-address-book-backfill",
    domain: "address-book",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "service-max-limit-dcm-external",
    label: "Max Boost external API",
    domain: "max-boost",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "tier:1, publicly exposed. The sheet answers the old review flag: Growth keeps Max Boost.",
  },
  {
    name: "service-max-limit-dcm-internal",
    label: "Max Boost internal API",
    domain: "max-boost",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
    note: "tier:1. Sheet keeps it.",
  },
  {
    name: "cronjob-max-limit-dcm-grantblockeval",
    domain: "max-boost",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "cronjob-max-limit-dcm-grantevaluation",
    domain: "max-boost",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Discovery"],
  },
  {
    name: "svc-links-internal",
    label: "Short links",
    domain: "links",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-ClientPlatform", "L3-PENG-CoreUXBackend"],
    note: "tier:1. Cortex backs the Confluence triage over the sheet here — the short-links DynamoDB tables were flagged to move to CoreUXBackend for this reason.",
  },
  {
    name: "usl-prime-frontend",
    label: "USL Prime frontend",
    domain: "frontend",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-CoreUX"],
    note: "Sheet keeps the funnel frontend and notes CIA owns the backend. Cortex records only CoreUX.",
  },
  {
    name: "job-user-setup-user-first-mile-calc-processor",
    label: "First-mile calc processor",
    domain: "activation",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Activation"],
    note: "Sheet keeps it. The catalog's old review flag conflated this job with the six SQS queues still pending between Growth and CoreUXBackend.",
  },
  {
    name: "svc-earnings-sqs-one-time-granted-earnings",
    label: "One-time granted earnings (OTGE)",
    domain: "earnings",
    sheetIntent: "keep",
    cortexOwners: ["L3-PENG-Activation"],
    note: "Sheet keeps the business logic and concedes delivery to FIP. Was missing from the catalog.",
  },

  // ── No basis for keeping these in the on-call scope ───────────────────────
  {
    name: "job-cashout-user-cashout-status-processor",
    label: "Funnel cashout status",
    domain: "cashout",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "job-cashout-cashout-collected-events-processor",
    domain: "cashout",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "job-cashout-recovery-message-events-processor",
    domain: "cashout",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "cronjob-cashout-retrigger-funnel-cashout",
    label: "Retrigger funnel cashout cron",
    domain: "cashout",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "job-cashout-attempt-restore-event-processor",
    domain: "cashout",
    sheetIntent: "deprecate",
    cortexOwners: ["L3-PENG-Activation"],
    note: "2023 Chime Smart Restore experiment. Cortex's own description says it should be deprecated.",
  },
  {
    name: "job-user-user-activation-processor",
    label: "User activation processor",
    domain: "activation",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    sheetRecommendation: "Keep?",
    cortexOwners: ["L3-PENG-Activation"],
    note: "Separately: dev-cluster OOM pages prod Growth on-call, which is a monitor routing leak to fix regardless of ownership.",
  },
  {
    name: "job-user-deactivated-user-processor",
    domain: "activation",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    sheetRecommendation: "Keep?",
    cortexOwners: ["L3-PENG-Activation"],
    note: "The catalog previously carried this as job-deactivated-user-processor, which is not a real tag.",
  },
  {
    name: "job-user-deactivated-user-cashout-status",
    domain: "activation",
    sheetIntent: "hand-off",
    handoffTarget: "Cashout",
    cortexOwners: ["L3-PENG-Activation"],
    note: "The catalog previously carried this as job-deactivated-user-cashout-status, which is not a real tag.",
  },
  {
    name: "job-bank-transactions-neobank-processor",
    domain: "payroll",
    sheetIntent: "hand-off",
    handoffTarget: "FIP / Payroll",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "job-payroll-provider-payroll-provider-processor",
    domain: "payroll",
    sheetIntent: "hand-off",
    handoffTarget: "FIP / Payroll",
    cortexOwners: ["L3-PENG-Activation"],
  },
  {
    name: "job-earnings-resource-updates-event-processor",
    domain: "earnings",
    sheetIntent: "hand-off",
    handoffTarget: "FIP / Payroll",
    cortexOwners: ["L3-PENG-Activation"],
    note: "Added by Growth in Q1'23; the sheet says Earnings should own it.",
  },
  {
    name: "job-payroll-provider-bank-account-processor",
    domain: "payroll",
    sheetIntent: "hand-off",
    handoffTarget: "FIP / Payroll",
    cortexOwners: [],
    note: "Not found in Cortex under this tag, and the sheet already hands it off.",
  },
  {
    name: "job-payroll-provider-processor",
    domain: "payroll",
    sheetIntent: "not-listed",
    cortexOwners: [],
    note: "Not a real service tag — likely a truncation of the payroll-provider processor above.",
  },
  {
    name: "service-postman",
    domain: "postman",
    sheetIntent: "not-listed",
    cortexOwners: [],
    note: "Not a real service tag — duplicate of service-postman-internal.",
  },
  {
    name: "svc-referral-reprocess-cron-job",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: [],
    note: "The sheet keeps it but the tag resolves to nothing in Cortex. Needs a real tag before it can be owned or paged.",
  },
  {
    name: "svc-event-reporting-sqs-processor",
    label: "Event reporting (Segment)",
    domain: "notifications",
    sheetIntent: "not-listed",
    cortexOwners: ["L3-FIP-EventDeliveryExp"],
    note: "tier:1, owned by FIP. Absent from the sheet — no source supports a Growth claim.",
  },
];

/** True when Cortex records a Growth team among the owners. */
export function isGrowthOwnedInCortex(service: TeamService): boolean {
  return service.cortexOwners.some((tag) => GROWTH_OWNER_TAGS.includes(tag));
}

/**
 * Derive the verdict from the evidence rather than storing it.
 *
 * Order matters: a tag that does not exist in Cortex cannot be owned or paged
 * by name, so that finding outranks whatever the sheet intends for it.
 */
export function verdictFor(service: TeamService): OwnershipVerdict {
  if (service.cortexOwners.length === 0) return "unsupported";
  if (service.sheetIntent === "deprecate" || service.sheetIntent === "hand-off") {
    return "unsupported";
  }
  if (service.sheetIntent === "not-listed" && !isGrowthOwnedInCortex(service)) {
    return "unsupported";
  }
  return isGrowthOwnedInCortex(service) ? "corroborated" : "disputed";
}

/** Why an unsupported entry should leave the scope. Undefined for everything else. */
export function dropReasonFor(service: TeamService): DropReason | undefined {
  if (verdictFor(service) !== "unsupported") return undefined;
  if (service.cortexOwners.length === 0) return "unknown-tag";
  if (service.sheetIntent === "deprecate") return "deprecated";
  if (service.sheetIntent === "hand-off") return "handed-off";
  return "other-team";
}

export const DROP_REASON_LABELS: Record<DropReason, string> = {
  "handed-off": "Marked for hand-off",
  deprecated: "Slated for deletion",
  "unknown-tag": "Tag does not exist",
  "other-team": "Owned by another team",
};

export const VERDICT_LABELS: Record<OwnershipVerdict, string> = {
  corroborated: "Confirmed",
  disputed: "Disputed",
  unsupported: "Drop",
};

export function domainLabel(domain: ServiceDomain): string {
  return DOMAIN_LABELS[domain];
}

/** One button the Services page may offer for a service. */
export interface OwnershipActionOption {
  action: OwnershipAction;
  /** Button text, already naming the receiving team where there is one. */
  label: string;
  /** Receiving team, for hand-off and concede. */
  targetTeam?: string;
  /** Why this action is the one the evidence points to. */
  rationale: string;
}

/**
 * The actions worth offering for a service, derived from its verdict so the
 * buttons can never contradict the finding they sit under.
 *
 * `Keep` is always offered: every finding must be answerable by rejecting it,
 * otherwise a wrong verdict has no exit. Everything else follows the evidence —
 * a hand-off names the team the inventory chose, a concede names the team Cortex
 * already records, and a tag that does not resolve gets fixed before anyone
 * argues about who owns it.
 *
 * The server re-derives this on write, so a client cannot record an action the
 * evidence does not support.
 */
export function actionsFor(service: TeamService): OwnershipActionOption[] {
  const verdict = verdictFor(service);
  const keep: OwnershipActionOption = {
    action: OwnershipAction.Keep,
    label: "Keep in scope",
    rationale: "Reject the finding and leave the service in the rotation.",
  };

  if (verdict === "corroborated") return [];

  if (verdict === "disputed") {
    const foreign = service.cortexOwners.filter((t) => !t.endsWith("-Growth"));
    return [
      {
        action: OwnershipAction.Claim,
        label: "Claim for Growth",
        rationale: `The inventory keeps it; retag Cortex from ${foreign.join(", ")} to Growth.`,
      },
      ...foreign.map((team) => ({
        action: OwnershipAction.Concede,
        label: `Concede to ${team}`,
        targetTeam: team,
        rationale: `Drop the claim and leave ${team} as the recorded owner.`,
      })),
      keep,
    ];
  }

  switch (dropReasonFor(service)) {
    case "handed-off":
      return [
        {
          action: OwnershipAction.HandOff,
          label: `Hand off to ${service.handoffTarget}`,
          targetTeam: service.handoffTarget,
          rationale: `The inventory already assigns this to ${service.handoffTarget}.`,
        },
        keep,
      ];
    case "deprecated":
      return [
        {
          action: OwnershipAction.Delete,
          label: "Mark for deletion",
          rationale:
            "Slated for deletion rather than transfer; its monitors go with it.",
        },
        keep,
      ];
    case "unknown-tag":
      return [
        {
          action: OwnershipAction.FixTag,
          label: "Fix the tag",
          rationale:
            "The tag resolves to nothing in Cortex, so it cannot be owned or paged by name.",
        },
        keep,
      ];
    case "other-team": {
      const owner = service.cortexOwners[0];
      return [
        {
          action: OwnershipAction.Concede,
          label: `Concede to ${owner}`,
          targetTeam: owner,
          rationale: `Cortex records ${owner} and the inventory never claimed it.`,
        },
        keep,
      ];
    }
    default:
      return [keep];
  }
}

/**
 * The offered action matching `action` + `targetTeam`, or undefined when the
 * evidence no longer supports it — which is how a decision taken against an
 * older verdict is detected.
 */
export function optionFor(
  service: TeamService,
  action: string,
  targetTeam?: string | null,
): OwnershipActionOption | undefined {
  return actionsFor(service).find(
    (o) =>
      o.action === action && (o.targetTeam ?? null) === (targetTeam ?? null),
  );
}

/** True when `action` (with `targetTeam`) is one the evidence supports. */
export function isActionAllowed(
  service: TeamService,
  action: string,
  targetTeam?: string | null,
): boolean {
  return optionFor(service, action, targetTeam) !== undefined;
}

export function serviceByName(name: string): TeamService | undefined {
  return GROWTH_TEAM_SERVICES.find((s) => s.name === name);
}

/**
 * Services the team could plausibly be paged for: Cortex agrees, or the team
 * still claims it and the boundary is unresolved.
 */
export function onCallScope(
  services: TeamService[] = GROWTH_TEAM_SERVICES,
): TeamService[] {
  return services.filter((s) => verdictFor(s) !== "unsupported");
}

/** Entries that should leave the rotation, with the reason preserved. */
export function dropList(
  services: TeamService[] = GROWTH_TEAM_SERVICES,
): TeamService[] {
  return services.filter((s) => verdictFor(s) === "unsupported");
}

export function servicesByVerdict(
  verdict: OwnershipVerdict,
  services: TeamService[] = GROWTH_TEAM_SERVICES,
): TeamService[] {
  return services.filter((s) => verdictFor(s) === verdict);
}

export function groupServicesByDomain(
  services: TeamService[],
): { domain: ServiceDomain; label: string; services: TeamService[] }[] {
  const byDomain = new Map<ServiceDomain, TeamService[]>();
  for (const svc of services) {
    const list = byDomain.get(svc.domain) ?? [];
    list.push(svc);
    byDomain.set(svc.domain, list);
  }
  return DOMAIN_ORDER.filter((d) => byDomain.has(d)).map((domain) => ({
    domain,
    label: DOMAIN_LABELS[domain],
    services: (byDomain.get(domain) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

export interface OwnershipSummary {
  total: number;
  corroborated: number;
  disputed: number;
  unsupported: number;
  /** Distinct teams named in Cortex for disputed entries. */
  counterparties: string[];
}

export function summarizeOwnership(
  services: TeamService[] = GROWTH_TEAM_SERVICES,
): OwnershipSummary {
  const counterparties = new Set<string>();
  let corroborated = 0;
  let disputed = 0;
  let unsupported = 0;

  for (const svc of services) {
    const verdict = verdictFor(svc);
    if (verdict === "corroborated") corroborated += 1;
    if (verdict === "unsupported") unsupported += 1;
    if (verdict === "disputed") {
      disputed += 1;
      for (const tag of svc.cortexOwners) {
        if (!GROWTH_OWNER_TAGS.includes(tag)) counterparties.add(tag);
      }
    }
  }

  return {
    total: services.length,
    corroborated,
    disputed,
    unsupported,
    counterparties: [...counterparties].sort(),
  };
}

/** Datadog APM entity URL for a service (prod). */
export function datadogServiceUrl(
  serviceName: string,
  site = "datadoghq.com",
): string {
  return `https://app.${site}/apm/entity/service%3A${encodeURIComponent(serviceName)}?env=prod`;
}

/** Datadog monitor list filtered to one service — the fallback when we have no
 *  monitor rows ingested for it yet. */
export function datadogMonitorSearchUrl(
  serviceName: string,
  site = "datadoghq.com",
): string {
  return `https://app.${site}/monitors/manage?q=${encodeURIComponent(`service:${serviceName}`)}`;
}
