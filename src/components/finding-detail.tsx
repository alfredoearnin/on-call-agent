import { ChevronRight } from "lucide-react";
import { splitFinding } from "@/lib/format";
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
          <p className="mt-2 rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground/90">
            {detail}
          </p>
        </details>
      )}
    </div>
  );
}
