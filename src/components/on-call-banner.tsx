import { ShieldCheck, LifeBuoy, ArrowRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Coverage, CoverageRole } from "@/lib/constants";
import { isUpcoming, type CoverageAssessments } from "@/lib/people/coverage";

interface OnCallBannerProps {
  primary?: string | null;
  secondary?: string | null;
  nextPrimary?: string | null;
  nextSecondary?: string | null;
  /** Names were carried forward from an earlier read, not confirmed live. */
  unverified?: boolean;
  /** When they were last confirmed, as the handoff page worded it. */
  verifiedAsOf?: string | null;
  windowStart: Date | string;
  windowEnd: Date | string;
  tz: string;
  /** Per-role availability from the handoff page's coverage check. */
  coverage?: CoverageAssessments;
  /** Evaluated once by the page so the banner does no clock reads of its own. */
  now?: Date;
}

/**
 * Prominent "who is on-call" banner for the Overview: primary (green) and
 * secondary (blue) side by side, with the upcoming handoff below.
 */
export function OnCallBanner({
  primary,
  secondary,
  nextPrimary,
  nextSecondary,
  unverified,
  verifiedAsOf,
  windowStart,
  windowEnd,
  tz,
  coverage,
  now = new Date(),
}: OnCallBannerProps) {
  const showNext = Boolean(nextPrimary || nextSecondary);

  const names: Record<CoverageRole, string | null | undefined> = {
    [CoverageRole.Primary]: primary,
    [CoverageRole.Secondary]: secondary,
    [CoverageRole.NextPrimary]: nextPrimary,
    [CoverageRole.NextSecondary]: nextSecondary,
  };
  const absent = coverage
    ? ROLE_ORDER.filter(
        (r) => coverage[r].state === Coverage.OutOfOffice && names[r],
      )
    : [];
  // Surfaced only when the page actually tried and failed. A page that predates the
  // check says nothing, rather than nagging about every historical week.
  const uncheckable =
    coverage?.[CoverageRole.Primary].state === Coverage.Unknown &&
    coverage[CoverageRole.Primary].evidence.includes("could not be checked")
      ? coverage[CoverageRole.Primary].evidence
      : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On-call this week
        </span>
        <span className="text-xs text-muted-foreground">
          {fmtDate(windowStart, tz)} → {fmtDate(windowEnd, tz)}
        </span>
      </div>

      {unverified && (
        <div className="flex items-start gap-2 border-b border-border bg-warn/10 px-4 py-2 text-xs text-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <p>
            <span className="font-semibold">
              Unverified{verifiedAsOf ? ` since ${verifiedAsOf}` : ""}.
            </span>{" "}
            incident.io could not be reached, so these are the last known names
            carried forward — confirm the rotation in incident.io before paging.
          </p>
        </div>
      )}

      {absent.length > 0 && (
        <div className="flex items-start gap-2 border-b border-border bg-warn/10 px-4 py-2 text-xs text-warn">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          <div className="space-y-0.5">
            {absent.map((role) => (
              <p key={role}>
                <span className="font-semibold">
                  {names[role]} ({ROLE_LABEL[role]}) is out of office
                  {absenceWindow(coverage![role], now, tz)}.
                </span>{" "}
                {role === CoverageRole.Primary || role === CoverageRole.Secondary
                  ? "Confirm someone is carrying the page before relying on this rotation."
                  : "Arrange cover before the handoff."}
              </p>
            ))}
          </div>
        </div>
      )}

      {uncheckable && (
        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {uncheckable}
        </div>
      )}

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <OnCallPerson
          role="Primary"
          sub="Paged first"
          name={primary}
          tone="ok"
          icon={<ShieldCheck className="h-5 w-5" />}
          outOfOffice={
            coverage?.[CoverageRole.Primary].state === Coverage.OutOfOffice
          }
        />
        <OnCallPerson
          role="Secondary"
          sub="Backup / escalation"
          name={secondary}
          tone="info"
          icon={<LifeBuoy className="h-5 w-5" />}
          outOfOffice={
            coverage?.[CoverageRole.Secondary].state === Coverage.OutOfOffice
          }
        />
      </div>

      {showNext && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span>Next handoff:</span>
          <span>
            primary{" "}
            <span className="font-medium text-foreground">
              {nextPrimary ?? "—"}
            </span>
            {coverage?.[CoverageRole.NextPrimary].state ===
              Coverage.OutOfOffice && (
              <Badge tone="warn" className="ml-1">
                ooo
              </Badge>
            )}
          </span>
          {nextSecondary && (
            <span>
              · secondary{" "}
              <span className="font-medium text-foreground">
                {nextSecondary}
              </span>
              {coverage?.[CoverageRole.NextSecondary].state ===
                Coverage.OutOfOffice && (
                <Badge tone="warn" className="ml-1">
                  ooo
                </Badge>
              )}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

const tones = {
  ok: { panel: "bg-ok/10", label: "text-ok", avatar: "bg-ok/15 text-ok" },
  info: { panel: "bg-info/10", label: "text-info", avatar: "bg-info/15 text-info" },
} as const;

function OnCallPerson({
  role,
  sub,
  name,
  tone,
  icon,
  outOfOffice,
}: {
  role: string;
  sub: string;
  name?: string | null;
  tone: keyof typeof tones;
  icon: React.ReactNode;
  outOfOffice?: boolean;
}) {
  const t = tones[tone];
  return (
    <div className={cn("flex items-center gap-3 px-4 py-4", t.panel)}>
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          t.avatar,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wide",
              t.label,
            )}
          >
            {role}
          </span>
          <span className="text-[11px] text-muted-foreground">· {sub}</span>
          {outOfOffice && <Badge tone="warn">ooo</Badge>}
        </div>
        <div className="truncate text-lg font-semibold text-foreground">
          {name ?? "—"}
        </div>
      </div>
    </div>
  );
}

const ROLE_ORDER: CoverageRole[] = [
  CoverageRole.Primary,
  CoverageRole.Secondary,
  CoverageRole.NextPrimary,
  CoverageRole.NextSecondary,
];

const ROLE_LABEL: Record<CoverageRole, string> = {
  [CoverageRole.Primary]: "primary",
  [CoverageRole.Secondary]: "secondary",
  [CoverageRole.NextPrimary]: "next primary",
  [CoverageRole.NextSecondary]: "next secondary",
};

/**
 * " until Aug 22" / " from Aug 25" / "" — phrased by whether the absence has begun,
 * so an upcoming gap reads as something to plan for rather than something current.
 */
function absenceWindow(
  a: { from?: Date; to?: Date; openEnded?: boolean },
  now: Date,
  tz: string,
): string {
  if (isUpcoming(a, now) && a.from) return ` from ${fmtDate(a.from, tz)}`;
  if (a.to) return ` until ${fmtDate(a.to, tz)}${a.openEnded ? " (open-ended)" : ""}`;
  return "";
}
