import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RerunAutomationButton,
  type TriggerMode,
} from "@/components/rerun-automation-button";
import { timeAgo } from "@/lib/format";
import {
  healthTone,
  weekCloseTone,
  type AutomationHealth,
  type WeekCloseHealth,
} from "@/lib/automations/health";

/**
 * Presentational only, and deliberately secret-free: every prop is a resolved
 * scalar. getConfig() is in scope in the Settings page, so passing `cfg` (or
 * spreading it) would be the realistic way to publish a private webhook endpoint
 * to the browser. The URL and key never leave the server-only secrets module.
 */
export interface AutomationRow {
  key: string;
  step: number;
  label: string;
  produces: string;
  promptFile: string;
  /** cursor.com link — non-secret. */
  consoleUrl: string;
  mode: TriggerMode;
  /** Env var NAMES (not values) to show when the webhook is unconfigured. */
  missingEnv: string[];
  health?: AutomationHealth;
  lastTriggeredAt: Date | null;
  /** Set on #2 when #1 was fired recently. Never disables the button. */
  warning: string | null;
}

export function AutomationPanel({
  rows,
  weekClose,
}: {
  rows: AutomationRow[];
  /** Verdict on the last week that ended. Null when there are no automations. */
  weekClose?: WeekCloseHealth | null;
}) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cloud automations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Two Cursor Automations produce this dashboard&apos;s data, in order:
          step 1 writes the Confluence handoff page, step 2 ingests it and merges
          the result to <code>main</code>. If step 1 fails, step 2 still runs and
          ingests <strong>yesterday&apos;s</strong> page — so re-run step 1 first,
          wait for its page, then step 2. Nothing here is chained or timed.
        </p>
        <p className="text-xs text-muted-foreground">
          Cursor returns no run id and no run status, so these buttons can only
          confirm that the request was <em>accepted</em> — never that the run
          succeeded. Health below is inferred from what this checkout can actually
          see: a <code>Daily refresh</code> commit on <code>main</code>, and the
          page&apos;s own &ldquo;Last refreshed&rdquo; stamp. Use{" "}
          <strong>Open in Cursor</strong> for the real run history.
        </p>

        {rows.map((row) => (
          <div
            key={row.key}
            className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">step {row.step}</Badge>
                  <span className="text-sm font-medium">{row.label}</span>
                  {row.health && (
                    <Badge tone={healthTone(row.health.state)}>
                      {row.health.state}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Produces {row.produces} · prompt <code>{row.promptFile}</code>
                </p>
                {/* Rendered verbatim: this sentence is the honesty contract. */}
                {row.health && (
                  <p className="max-w-2xl text-xs text-muted-foreground">
                    {row.health.evidence}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Last triggered from here: {timeAgo(row.lastTriggeredAt)}
                  {" · "}
                  <a
                    href={row.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline hover:text-foreground"
                  >
                    Open in Cursor
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                {row.warning && (
                  <span className="max-w-xs text-right text-xs text-warn">
                    {row.warning}
                  </span>
                )}
                <RerunAutomationButton
                  automationKey={row.key}
                  mode={row.mode}
                  missingEnv={row.missingEnv}
                  warning={row.warning}
                />
              </div>
            </div>
          </div>
        ))}

        {weekClose && (
          <div className="space-y-1 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Week close</span>
              <Badge tone={weekCloseTone(weekClose.state)}>
                {weekClose.state}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              The two states above only ask whether a run happened today. This
              asks whether the run that ended last week gave it a final refresh —
              a week can be published every day and still be archived truncated.
            </p>
            {/* Verbatim, for the same reason as the health evidence above. */}
            <p className="max-w-2xl text-xs text-muted-foreground">
              {weekClose.evidence}
            </p>
            {weekClose.unclosed > 1 && (
              <p className="max-w-2xl text-xs text-warn">
                {weekClose.unclosed} of {weekClose.judged}{" "}
                closed weeks on file were never given a final refresh, so each
                one&apos;s totals stop before its week did. Any trend drawn
                across them is short by whatever the missing days held.
              </p>
            )}
          </div>
        )}

        {rows.some((r) => r.mode === "blocked") && (
          <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-xs text-muted-foreground">
            Re-run is disabled for the automations above without a webhook trigger
            configured. In Cursor, open the automation, add a{" "}
            <strong>Webhook trigger</strong>, and <strong>save</strong> — the URL
            and API key are generated only after saving. Put both in{" "}
            <code>.env.local</code>; they are secrets and must never be committed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
