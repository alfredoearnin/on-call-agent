import { CircleDot } from "lucide-react";
import { getConfig } from "@/lib/config";
import { getAutomationHealth, getLatestRun } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { healthTone, worstState } from "@/lib/automations/health";
import { SyncNowButton } from "@/components/sync-now-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DOT_CLASS: Record<string, string> = {
  ok: "text-ok",
  warn: "text-warn",
  alert: "text-alert",
  neutral: "text-neutral",
};

export async function TopBar() {
  const cfg = getConfig();
  const [latest, health] = await Promise.all([
    getLatestRun(),
    getAutomationHealth(),
  ]);

  // The dot used to be hardcoded green, so a failed 9AM automation looked healthy
  // next to a "Last synced" figure that just kept climbing. Colour it by the worst
  // automation verdict instead — including amber for "cannot tell", since an
  // unreadable evidence channel is not health.
  const worst = health.length ? worstState(health) : null;
  const tone = worst ? healthTone(worst) : "ok";
  const dotTitle = worst
    ? `Cloud automations: ${worst} — see Settings`
    : undefined;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/40 px-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{cfg.team.label} Ops Review</span>
        {cfg.demoMode && <Badge tone="warn">demo mode</Badge>}
      </div>

      <div className="flex items-center gap-4">
        <div
          className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
          title={dotTitle}
        >
          <CircleDot className={cn("h-3 w-3", DOT_CLASS[tone])} />
          Last synced {timeAgo(latest?.startedAt)}
        </div>
        <ThemeToggle />
        <SyncNowButton />
      </div>
    </header>
  );
}
