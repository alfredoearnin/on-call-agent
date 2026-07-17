"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revertAppliedChangeAction } from "@/lib/apply-actions";

export function RevertButton({ appliedChangeId }: { appliedChangeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      const res = await revertAppliedChangeAction(appliedChangeId);
      setMsg(res.message ?? (res.ok ? "Reverted." : "Failed."));
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onClick} disabled={isPending}>
        <Undo2 className="h-3.5 w-3.5" />
        {isPending ? "Reverting…" : "Revert"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
