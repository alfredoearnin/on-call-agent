"use client";

import { useState, useTransition } from "react";
import { CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshFromSourceAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Triggers the cloud Health Check agent (which regenerates Confluence and
 * chains the daily sync). Async — the result lands on `main` after a few
 * minutes; the user then runs `git pull`.
 */
export function RefreshSourceButton({ configured }: { configured: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await refreshFromSourceAction();
      setMsg(res.message ?? (res.ok ? "Started." : "Failed."));
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={onClick}
        disabled={!configured || isPending}
        title={
          configured
            ? "Run the Health Check agent + sync in the cloud"
            : "Set HEALTHCHECK_WEBHOOK_URL to enable"
        }
      >
        <CloudDownload className={cn("h-4 w-4", isPending && "animate-pulse")} />
        {isPending ? "Starting…" : "Refresh from source"}
      </Button>
      {msg && (
        <span className="max-w-xs text-right text-xs text-muted-foreground">
          {msg}
        </span>
      )}
    </div>
  );
}
