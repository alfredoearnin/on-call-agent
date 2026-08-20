"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerAutomationAction } from "@/lib/automation-actions";
import { cn } from "@/lib/utils";

/**
 * `blocked` = this automation's webhook URL / API key are not configured. There is
 * no `demo` mode counterpart to Apply's: a trigger has no local effect to
 * simulate, and a fake "triggered" audit row would corrupt "last triggered from
 * here" — which is what the out-of-order warning is computed from.
 */
export type TriggerMode = "real" | "blocked";

/**
 * Fires one Cursor Automation's webhook trigger.
 *
 * Cursor returns no run id and no status, so a success message means the request
 * was accepted — never that the run succeeded.
 */
export function RerunAutomationButton({
  automationKey,
  mode,
  missingEnv,
  warning,
}: {
  automationKey: string;
  mode: TriggerMode;
  missingEnv: string[];
  warning: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await triggerAutomationAction(automationKey);
      setMsg(res.message ?? (res.ok ? "Triggered." : "Failed."));
      router.refresh();
      // Longer than the 4s used elsewhere: these messages carry a next step.
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
            ? `Set ${missingEnv.join(" and ")} in .env.local to enable re-runs`
            : (warning ?? "Start a new run of this automation in Cursor")
        }
      >
        <Play className={cn("h-4 w-4", isPending && "animate-pulse")} />
        {isPending ? "Triggering…" : "Re-run"}
      </Button>
      {msg && (
        <span className="max-w-sm text-right text-xs text-muted-foreground">
          {msg}
        </span>
      )}
    </div>
  );
}
