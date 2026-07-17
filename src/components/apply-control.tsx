"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  previewApplyAction,
  applyRecommendationAction,
} from "@/lib/apply-actions";

type Mode = "real" | "demo" | "blocked";

interface Preview {
  field?: string;
  before?: string;
  after?: string;
  changed?: boolean;
  message?: string;
}

export function ApplyControl({
  recommendationId,
  hasPatch,
  mode,
}: {
  recommendationId: string;
  hasPatch: boolean;
  mode: Mode;
}) {
  const [scope, setScope] = useState("prod");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!hasPatch) {
    return (
      <span className="text-xs text-muted-foreground">
        No monitor edit (e.g. code fix / manual verification).
      </span>
    );
  }

  function openModal() {
    setMsg(null);
    startTransition(async () => {
      const p = await previewApplyAction(recommendationId, scope);
      setPreview(p.ok ? p : { message: p.message });
      setOpen(true);
    });
  }

  function confirmApply() {
    startTransition(async () => {
      const res = await applyRecommendationAction(recommendationId, scope);
      setMsg(res.message ?? (res.ok ? "Applied." : "Failed."));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
        aria-label="Target scope"
      >
        <option value="prod">prod branch</option>
        <option value="dev">dev branch</option>
      </select>

      <Button
        size="sm"
        variant={mode === "blocked" ? "secondary" : "primary"}
        onClick={openModal}
        disabled={mode === "blocked" || isPending}
        title={
          mode === "blocked"
            ? "Enable APPLY_ENABLED + DD_APP_KEY_WRITE to apply"
            : undefined
        }
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        {mode === "demo" ? "Apply (dry-run)" : "Apply suggestion"}
      </Button>

      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}

      {open && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Confirm apply — {scope} branch
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview.message && !preview.before ? (
              <p className="text-sm text-alert">{preview.message}</p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Field: {preview.field}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Before
                  </div>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs text-alert/90">
                    {preview.before}
                  </pre>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    After
                  </div>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-xs text-ok">
                    {preview.after}
                  </pre>
                </div>
                {mode === "demo" && (
                  <p className="text-xs text-warn">
                    Demo dry-run: records the change + audit locally, no Datadog
                    write. Sync afterward to watch it validate.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmApply}
                disabled={isPending || !preview.changed}
              >
                <Check className="h-3.5 w-3.5" />
                Confirm apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
