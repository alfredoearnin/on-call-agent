"use client";

import { useEffect } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Modal that states what is about to change, and where, before anything is
 * written. Nothing in the dashboard mutates without passing through one of
 * these — including the local-only writes, because "this records a decision and
 * changes nothing in Cortex or Datadog" is exactly the thing a reader needs
 * spelled out.
 *
 * `blast` drives the wording and the button colour: `external` means the write
 * leaves this app.
 */
export function ConfirmDialog({
  open,
  title,
  blast,
  confirmLabel = "Confirm",
  confirmDisabled,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  blast: "local" | "external";
  confirmLabel?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const external = blast === "external";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3
            id="confirm-dialog-title"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            {external && <AlertTriangle className="h-4 w-4 text-warn" />}
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">{children}</div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            autoFocus
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant={external ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            <Check className="h-3.5 w-3.5" />
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
