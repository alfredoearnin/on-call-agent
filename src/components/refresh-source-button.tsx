"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshFromSourceAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Pulls the latest memory from `main` (the daily automation pushes the rebuilt
 * DB there). Equivalent to running `git pull` locally.
 */
export function RefreshSourceButton() {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await refreshFromSourceAction();
      setMsg(res.message ?? (res.ok ? "Done." : "Failed."));
      if (res.ok) router.refresh();
      setTimeout(() => setMsg(null), 5000);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={onClick}
        disabled={isPending}
        title="Pull the latest data from main (git pull)"
      >
        <ArrowDownToLine
          className={cn("h-4 w-4", isPending && "animate-pulse")}
        />
        {isPending ? "Pulling…" : "Refresh from source"}
      </Button>
      {msg && (
        <span className="max-w-xs text-right text-xs text-muted-foreground">
          {msg}
        </span>
      )}
    </div>
  );
}
