"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncNowAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function SyncNowButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncNowAction();
      if (res.skipped) setMsg("A sync is already running.");
      else if (!res.ok) setMsg(`Failed: ${res.message ?? "unknown error"}`);
      else setMsg(`Synced (${res.status}).`);
      router.refresh();
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button size={size} onClick={onClick} disabled={isPending}>
        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}
