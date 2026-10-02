import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleCheck, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SignalSeverity,
  panelSeverity,
  type OverviewSignal,
} from "@/lib/overview-signals";

/**
 * What the week owes a human, above the metrics that merely describe it.
 *
 * The Overview's nine KPI cards all carried the same weight, so finding the one
 * that needed action meant reading all nine and comparing tones. This states the
 * answer instead, ranked by `collectSignals`, and the metric row below it goes
 * back to being reference rather than triage.
 *
 * The all-clear is rendered explicitly and never as an empty panel: a page that
 * says nothing is indistinguishable from a page that found nothing, and only one
 * of those is an all-clear.
 */

/**
 * Only the border and the header strip carry the panel's overall severity; the
 * card body stays neutral.
 *
 * Tinting the whole card put warn rows on an alert-coloured background — amber
 * text over a red wash — which reads as one undifferentiated emergency and is
 * plainly wrong in light mode. Severity belongs to the row that has it.
 */
const severityStyles = {
  [SignalSeverity.Alert]: {
    panel: "border-alert/30",
    strip: "bg-alert/10 text-alert",
    text: "text-alert",
    icon: Flame,
  },
  [SignalSeverity.Warn]: {
    panel: "border-warn/30",
    strip: "bg-warn/10 text-warn",
    text: "text-warn",
    icon: AlertTriangle,
  },
} as const;

export function AttentionPanel({
  signals,
}: {
  signals: readonly OverviewSignal[];
}) {
  const severity = panelSeverity(signals);
  if (!severity) return <NothingOwed />;

  const style = severityStyles[severity];

  return (
    <Card className={cn("overflow-hidden", style.panel)}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border px-4 py-2",
          style.strip,
        )}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide">
          Needs attention
        </h2>
        <span className="text-xs tabular-nums">
          {signals.length} {signals.length === 1 ? "item" : "items"}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {signals.map((signal) => (
          <li key={signal.key}>
            <SignalRow signal={signal} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SignalRow({ signal }: { signal: OverviewSignal }) {
  const style = severityStyles[signal.severity];
  const Icon = style.icon;

  const body = (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className={cn("h-4 w-4 shrink-0", style.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", style.text)}>
          {signal.headline}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {signal.detail}
        </div>
      </div>
      {signal.href && (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  );

  // A row with nowhere to go stays inert rather than becoming a dead control:
  // `incidents` has no page of its own, and a link that does not move is worse
  // than plain text.
  if (!signal.href) return body;

  return (
    <Link
      href={signal.href}
      className="block hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}

function NothingOwed() {
  return (
    <Card className="flex items-center gap-3 border-ok/30 px-4 py-3">
      <CircleCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ok">Nothing owed</h2>
        <p className="text-xs text-muted-foreground">
          No incidents, nothing firing, no stale carryover, and no open
          recommendations or ownership questions. Rotation coverage is reported
          separately above.
        </p>
      </div>
    </Card>
  );
}
