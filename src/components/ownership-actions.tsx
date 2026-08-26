"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  recordOwnershipDecisionAction,
  revokeOwnershipDecisionAction,
} from "@/lib/ownership-actions";
import { OwnershipAction } from "@/lib/constants";
import type { OwnershipActionOption } from "@/lib/team-services";
import type { HandoffDraft } from "@/lib/ownership-draft";
import type { OwnershipDecisionRef } from "@/lib/queries";

/**
 * Past tense would claim the work is done. Every one of these is a decision
 * waiting to be executed somewhere else, so they read as decisions — except
 * `keep`, which is fully settled by being recorded.
 */
const DECIDED_LABELS: Record<string, string> = {
  [OwnershipAction.HandOff]: "Decided: hand off",
  [OwnershipAction.Delete]: "Decided: delete",
  [OwnershipAction.FixTag]: "Decided: fix the tag",
  [OwnershipAction.Claim]: "Decided: claim for Growth",
  [OwnershipAction.Concede]: "Decided: concede",
  [OwnershipAction.Keep]: "Kept in scope",
};

/** What still has to happen by hand once the decision is recorded. */
const OUTSTANDING: Record<string, string> = {
  [OwnershipAction.HandOff]:
    "Not executed yet — Cortex is still tagged to the old owner and the monitors still page us.",
  [OwnershipAction.Delete]:
    "Not executed yet — the service and its monitors still exist.",
  [OwnershipAction.FixTag]:
    "Not executed yet — the tag still resolves to nothing in Cortex.",
  [OwnershipAction.Claim]:
    "Not executed yet — Cortex still records the other team as owner.",
  [OwnershipAction.Concede]:
    "Not executed yet — we are still in the rotation for it.",
};

export function OwnershipActions({
  serviceName,
  options,
  decision,
  draft,
  decidedOnVerdict,
  children,
}: {
  serviceName: string;
  options: OwnershipActionOption[];
  decision?: OwnershipDecisionRef;
  draft?: HandoffDraft;
  /** True when the finding changed after the decision was taken. */
  decidedOnVerdict?: boolean;
  /** Follow-up controls that act on the decision, e.g. moving the pager. */
  children?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingOption, setPendingOption] =
    useState<OwnershipActionOption | null>(null);
  const router = useRouter();

  function confirmRecord() {
    const option = pendingOption;
    if (!option) return;
    setMsg(null);
    startTransition(async () => {
      const res = await recordOwnershipDecisionAction(
        serviceName,
        option.action,
        option.targetTeam ?? null,
      );
      if (!res.ok) setMsg(res.message);
      setPendingOption(null);
      router.refresh();
    });
  }

  function undo(id: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await revokeOwnershipDecisionAction(id);
      if (!res.ok) setMsg(res.message);
      router.refresh();
    });
  }

  async function copyNote(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Could not copy — select the note and copy manually.");
    }
  }

  if (decision) {
    const outstanding = OUTSTANDING[decision.action];
    return (
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            tone={decision.action === OwnershipAction.Keep ? "ok" : "warn"}
          >
            {DECIDED_LABELS[decision.action] ?? decision.action}
            {decision.targetTeam ? ` → ${decision.targetTeam}` : ""}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {decision.operator} ·{" "}
            {new Date(decision.decidedAt).toISOString().slice(0, 10)}
          </span>
          <button
            type="button"
            onClick={() => undo(decision.id)}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
          >
            <Undo2 className="h-3 w-3" />
            {isPending ? "Undoing…" : "Undo"}
          </button>
        </div>

        {outstanding && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {outstanding}
          </p>
        )}

        {decidedOnVerdict === false && (
          <p className="text-[11px] leading-snug text-warn">
            The finding changed after this decision was taken — it was decided on
            a “{decision.verdict}” verdict. Undo and re-decide.
          </p>
        )}

        {draft && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={draft.jiraUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {draft.prefilled ? "Open prefilled Jira draft" : "Open Jira"}
            </a>
            <button
              type="button"
              onClick={() => copyNote(draft.body)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy handoff note"}
            </button>
            {!draft.prefilled && (
              <span className="text-[10px] text-muted-foreground">
                paste the note — set JIRA_HANDOFF_PROJECT_ID to prefill
              </span>
            )}
          </div>
        )}

        {children}

        {msg && <p className="text-[11px] text-alert">{msg}</p>}
      </div>
    );
  }

  if (options.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <Button
            key={`${o.action}:${o.targetTeam ?? ""}`}
            size="sm"
            variant={o.action === OwnershipAction.Keep ? "ghost" : "secondary"}
            title={o.rationale}
            disabled={isPending}
            onClick={() => setPendingOption(o)}
            className="h-6 px-2 text-[11px]"
          >
            {o.label}
          </Button>
        ))}
      </div>
      {msg && <p className="text-[11px] text-alert">{msg}</p>}

      <ConfirmDialog
        open={pendingOption !== null}
        title={`Record a decision — ${serviceName}`}
        blast="local"
        confirmLabel="Record decision"
        busy={isPending}
        onConfirm={confirmRecord}
        onCancel={() => setPendingOption(null)}
      >
        <p>
          <span className="font-medium">{pendingOption?.label}</span> —{" "}
          {pendingOption?.rationale}
        </p>
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <p className="font-medium">This writes to the dashboard only.</p>
          <p className="mt-1 text-muted-foreground">
            Nothing changes in Cortex, Datadog, or Jira. The retag and the
            receiving team&apos;s ticket stay manual, and the monitors keep
            paging whoever they page today. Undo is available afterwards.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
