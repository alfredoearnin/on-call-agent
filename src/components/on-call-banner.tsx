import { ShieldCheck, LifeBuoy, ArrowRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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
}: OnCallBannerProps) {
  const showNext = Boolean(nextPrimary || nextSecondary);

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

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <OnCallPerson
          role="Primary"
          sub="Paged first"
          name={primary}
          tone="ok"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <OnCallPerson
          role="Secondary"
          sub="Backup / escalation"
          name={secondary}
          tone="info"
          icon={<LifeBuoy className="h-5 w-5" />}
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
          </span>
          {nextSecondary && (
            <span>
              · secondary{" "}
              <span className="font-medium text-foreground">
                {nextSecondary}
              </span>
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
}: {
  role: string;
  sub: string;
  name?: string | null;
  tone: keyof typeof tones;
  icon: React.ReactNode;
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
        </div>
        <div className="truncate text-lg font-semibold text-foreground">
          {name ?? "—"}
        </div>
      </div>
    </div>
  );
}
