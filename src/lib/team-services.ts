/**
 * Growth Team service ownership catalog.
 *
 * Sources (2026-08-25 audit):
 * - Cortex catalog (L2/L3-PENG-Growth) — Confluence "Cortex Ownership Triage"
 * - Datadog monitors tagged team:l2-peng-growth
 * - Cursor canvas audit: https://cursor.com/dashboard/shared-canvases?shareId=canvas-nfAGiEJRhdQkoJbdBk5vRJBd
 */

export type ServiceOwnership = "confirmed" | "review";

export type ServiceDomain =
  | "referrals"
  | "notifications"
  | "conversational-onboarding"
  | "activation"
  | "postman"
  | "cashout"
  | "address-book"
  | "payroll"
  | "frontend"
  | "ai-ops"
  | "other";

export interface TeamService {
  /** Datadog / Cortex service tag. */
  name: string;
  /** Human-friendly label when the tag alone is opaque. */
  label?: string;
  domain: ServiceDomain;
  /** Cortex owner tag when known. */
  cortexOwner?: "L2-PENG-Growth" | "L3-PENG-Growth";
  ownership: ServiceOwnership;
  /** Why ownership is flagged for review (only when ownership === "review"). */
  reviewNote?: string;
}

/** Link to the Cursor canvas used for the Growth service audit. */
export const GROWTH_SERVICES_CANVAS_URL =
  "https://cursor.com/dashboard/shared-canvases?shareId=canvas-nfAGiEJRhdQkoJbdBk5vRJBd";

/** Confluence ownership triage doc (Cortex catalog review). */
export const CORTEX_OWNERSHIP_TRIAGE_URL =
  "https://earnin.atlassian.net/wiki/spaces/GROW/pages/5058101368";

const DOMAIN_LABELS: Record<ServiceDomain, string> = {
  referrals: "Referrals",
  notifications: "Notifications",
  "conversational-onboarding": "Conversational onboarding",
  activation: "Activation / first mile",
  postman: "Postman (messaging)",
  cashout: "Cashout / funnel",
  "address-book": "Address book",
  payroll: "Payroll provider",
  frontend: "Frontend",
  "ai-ops": "Growth AI ops",
  other: "Other",
};

/**
 * Canonical list of services that correspond to the Growth Team on-call scope.
 * Sorted by domain, then name.
 */
export const GROWTH_TEAM_SERVICES: TeamService[] = [
  // ── Confirmed Growth (Cortex) ─────────────────────────────────────────────
  {
    name: "svc-referral",
    label: "Referrals API",
    domain: "referrals",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-referral-user-signup-processor",
    domain: "referrals",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-referral-user-employer-updates-processor",
    domain: "referrals",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-referral-cashout-processor",
    domain: "referrals",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-referral-user-started-tys-account-processor",
    domain: "referrals",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-notification-preferences",
    label: "Notification preferences",
    domain: "notifications",
    cortexOwner: "L3-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-event-reporting-sqs-processor",
    label: "Event reporting (Segment)",
    domain: "notifications",
    cortexOwner: "L3-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-conversational-onboarding",
    label: "Conversational onboarding",
    domain: "conversational-onboarding",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "svc-growth-ai-ops",
    label: "Growth AI operations",
    domain: "ai-ops",
    cortexOwner: "L3-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "usl-prime-frontend",
    label: "USL Prime frontend",
    domain: "frontend",
    cortexOwner: "L3-PENG-Growth",
    ownership: "confirmed",
  },

  // ── Confirmed Growth (Cortex kmono jobs) ──────────────────────────────────
  {
    name: "job-cashout-user-cashout-status-processor",
    label: "Funnel cashout status",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-cashout-attempt-restore-event-processor",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-cashout-recovery-message-events-processor",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-cashout-cashout-collected-events-processor",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "cronjob-cashout-retrigger-funnel-cashout",
    label: "Retrigger funnel cashout cron",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-postman-send-message-processor",
    domain: "postman",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "service-postman-internal",
    label: "Postman internal (gRPC)",
    domain: "postman",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "service-postman",
    domain: "postman",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-address-book-address-book-new-user-processor",
    domain: "address-book",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-address-book-backfill",
    domain: "address-book",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "service-address-book",
    domain: "address-book",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-bank-transactions-neobank-processor",
    domain: "cashout",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-earnings-resource-updates-event-processor",
    domain: "activation",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-payroll-provider-bank-account-processor",
    domain: "payroll",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-payroll-provider-payroll-provider-processor",
    domain: "payroll",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },
  {
    name: "job-payroll-provider-processor",
    domain: "payroll",
    cortexOwner: "L2-PENG-Growth",
    ownership: "confirmed",
  },

  // ── On-call scope (Datadog team:l2-peng-growth) — ownership under review ───
  {
    name: "job-user-setup-user-first-mile-calc-processor",
    label: "First-mile calc processor",
    domain: "activation",
    ownership: "review",
    reviewNote:
      "“First mile” naming overlaps CoreUX onboarding; 6 SQS queues still TBD between Growth and CoreUXBackend.",
  },
  {
    name: "job-user-user-activation-processor",
    label: "User activation processor",
    domain: "activation",
    ownership: "review",
    reviewNote:
      "Activation-adjacent; dev-cluster OOM pages prod Growth on-call (monitor routing leak).",
  },
  {
    name: "job-deactivated-user-processor",
    domain: "activation",
    ownership: "review",
    reviewNote: "Deactivation flow; confirm Growth vs Activation team boundary.",
  },
  {
    name: "job-deactivated-user-cashout-status",
    domain: "activation",
    ownership: "review",
    reviewNote: "Deactivation + cashout; confirm Growth vs Activation team boundary.",
  },
  {
    name: "svc-mark-tech",
    label: "Mark-tech service",
    domain: "other",
    ownership: "review",
    reviewNote:
      "Baseline monitors tagged team:l2-peng-growth but service may belong to Web Platform — confirm Cortex owner.",
  },
  {
    name: "cronjob-mark-tech-crons",
    domain: "other",
    ownership: "review",
    reviewNote: "P5 cron monitor over-routed to incident.io High; Growth ownership unconfirmed.",
  },
  {
    name: "service-max-limit-dcm-external",
    label: "Max-limit DCM external",
    domain: "other",
    ownership: "review",
    reviewNote: "DCM domain; tagged to Growth in Datadog — verify Cortex owner (may be DCM team).",
  },
  {
    name: "service-max-limit-dcm-internal",
    label: "Max-limit DCM internal",
    domain: "other",
    ownership: "review",
    reviewNote: "DCM domain; tagged to Growth in Datadog — verify Cortex owner.",
  },
  {
    name: "cronjob-max-limit-dcm-grantblockeval",
    domain: "other",
    ownership: "review",
    reviewNote: "DCM cron; tagged to Growth in Datadog — verify Cortex owner.",
  },
  {
    name: "cronjob-max-limit-dcm-grantevaluation",
    domain: "other",
    ownership: "review",
    reviewNote: "DCM cron; tagged to Growth in Datadog — verify Cortex owner.",
  },
];

export function domainLabel(domain: ServiceDomain): string {
  return DOMAIN_LABELS[domain];
}

export function groupServicesByDomain(
  services: TeamService[],
): { domain: ServiceDomain; label: string; services: TeamService[] }[] {
  const order: ServiceDomain[] = [
    "referrals",
    "notifications",
    "conversational-onboarding",
    "activation",
    "cashout",
    "postman",
    "address-book",
    "payroll",
    "frontend",
    "ai-ops",
    "other",
  ];
  const byDomain = new Map<ServiceDomain, TeamService[]>();
  for (const svc of services) {
    const list = byDomain.get(svc.domain) ?? [];
    list.push(svc);
    byDomain.set(svc.domain, list);
  }
  return order
    .filter((d) => byDomain.has(d))
    .map((domain) => ({
      domain,
      label: DOMAIN_LABELS[domain],
      services: (byDomain.get(domain) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }));
}

export function summarizeOwnership(services: TeamService[]) {
  const confirmed = services.filter((s) => s.ownership === "confirmed").length;
  const review = services.filter((s) => s.ownership === "review").length;
  return { total: services.length, confirmed, review };
}

/** Datadog APM entity URL for a service (prod). */
export function datadogServiceUrl(serviceName: string, site = "datadoghq.com"): string {
  return `https://app.${site}/apm/entity/service%3A${encodeURIComponent(serviceName)}?env=prod`;
}
