import { ChevronRight } from "lucide-react";
import { splitFinding, splitFindingSections } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Renders an alert/incident finding as a prominent TL;DR line plus a
 * collapsible "What happened" detail panel. Shared by the Daily list and the
 * timeline so both surface the same skim + drill-down.
 */
export function FindingDetail({
  finding,
  className,
}: {
  finding: string | null | undefined;
  className?: string;
}) {
  const { tldr, detail } = splitFinding(finding);
  if (!tldr && !detail) return null;
  // The agent marks sections with markdown emphasis; render them as headings
  // rather than showing literal underscores in one unbroken paragraph.
  const sections = splitFindingSections(detail);

  return (
    <div className={cn("space-y-2", className)}>
      {tldr && (
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-semibold text-muted-foreground">TL;DR: </span>
          {tldr}
        </p>
      )}
      {detail && (
        <details className="group">
          <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            <span className="group-open:hidden">What happened</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <div className="mt-2 space-y-2.5 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2">
            {sections.map((s, i) => (
              <div key={i} className="space-y-0.5">
                {s.label && (
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </div>
                )}
                {/* break-words so a long Datadog query wraps instead of
                    stretching the card past the viewport. */}
                <p className="break-words text-sm leading-relaxed text-foreground/90">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
