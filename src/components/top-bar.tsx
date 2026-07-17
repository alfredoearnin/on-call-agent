import { CircleDot } from "lucide-react";
import { getConfig } from "@/lib/config";
import { getLatestRun } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { SyncNowButton } from "@/components/sync-now-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

export async function TopBar() {
  const cfg = getConfig();
  const latest = await getLatestRun();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/40 px-6">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{cfg.team.label} Ops Review</span>
        {cfg.demoMode && <Badge tone="warn">demo mode</Badge>}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <CircleDot className="h-3 w-3 text-ok" />
          Last synced {timeAgo(latest?.startedAt)}
        </div>
        <ThemeToggle />
        <SyncNowButton />
      </div>
    </header>
  );
}
