"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestMonitorAnalysisAction } from "@/lib/analysis-actions";
import { cn } from "@/lib/utils";

/**
 * `blocked` = the analysis cannot run because a credential is missing. There is
 * no `demo` counterpart to Apply's: a fabricated recommendation would be
 * indistinguishable from a real one in the Recommendations list, and would then
 * offer an Apply button against a patch nothing had actually derived.
 */
export type AnalyzeMode = "real" | "blocked";

export interface LastAnalysis {
  status: string;
  requestedAtIso: string;
  summary?: string | null;
  error?: string | null;
}

function statusLine(last: LastAnalysis): string {
  const when = new Date(last.requestedAtIso);
  const minutes = Math.max(
    0,
    Math.round((Date.now() - when.getTime()) / 60_000),
  );
  const ago = minutes === 0 ? "just now" : `${minutes}m ago`;

  switch (last.status) {
    case "done":
      return last.summary
        ? `Analysed ${ago}: ${last.summary}`
        : `Analysed ${ago}.`;
    case "running":
    case "queued":
      // Deliberately not "analysing…" with a spinner that never stops: this
      // renders on a fresh page load, so the run it describes may already be
      // gone with the request that started it.
      return `Started ${ago}, no result yet.`;
    case "expired":
      return `Started ${ago}; no result was observed.`;
    case "failed":
      return last.error ? `Failed ${ago}: ${last.error}` : `Failed ${ago}.`;
    default:
      return `Last run ${ago}.`;
  }
}

/**
 * Runs one on-demand analysis of this monitor and lands the result in the
 * Recommendations section below, with its own Apply button.
 */
export function AnalyzeMonitorButton({
  monitorId,
  mode,
  missingEnv,
  last,
}: {
  monitorId: string;
  mode: AnalyzeMode;
  missingEnv: string[];
  last: LastAnalysis | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await requestMonitorAnalysisAction(monitorId);
      setMsg(
        res.message ??
          (res.ok
            ? "Analysis complete — see Recommendations below."
            : "Analysis failed."),
      );
      router.refresh();
      setTimeout(() => setMsg(null), 8000);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={mode === "blocked" ? "secondary" : "primary"}
        onClick={onClick}
        disabled={mode === "blocked" || isPending}
        title={
          mode === "blocked"
            ? `Set ${missingEnv.join(" and ")} in .env.local to enable analysis`
            : "Gather this monitor's evidence and propose a change"
        }
      >
        <Sparkles className={cn("h-4 w-4", isPending && "animate-pulse")} />
        {isPending ? "Analysing…" : "Analyse"}
      </Button>
      {(msg || last) && (
        <span className="max-w-sm text-right text-xs text-muted-foreground">
          {msg ?? (last ? statusLine(last) : null)}
        </span>
      )}
    </div>
  );
}
