import { getConfig, canApply } from "@/lib/config";
import { getRecommendations } from "@/lib/queries";
import { RecommendationCard } from "@/components/recommendation-card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const cfg = getConfig();
  const recs = await getRecommendations();
  const applyMode: "real" | "demo" | "blocked" = canApply(cfg)
    ? "real"
    : cfg.demoMode
      ? "demo"
      : "blocked";

  const counts = recs.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitor tuning recommendations</h1>
          <p className="text-sm text-muted-foreground">
            Learned, read-only suggestions. Apply pushes a real Datadog change —
            with preview, confirmation, audit, and revert.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([status, n]) => (
            <Badge key={status} tone="neutral">
              {status}: {n}
            </Badge>
          ))}
        </div>
      </header>

      {applyMode === "blocked" && (
        <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          Apply is disabled. Set <code>APPLY_ENABLED=true</code> and{" "}
          <code>DD_APP_KEY_WRITE</code> in <code>.env.local</code> to enable real
          monitor writes.
        </div>
      )}
      {applyMode === "demo" && (
        <div className="rounded-md border border-info/30 bg-info/10 p-3 text-xs text-info">
          Demo mode: Apply runs as a dry-run (records the change + audit locally,
          no Datadog write) so you can see the apply → validated flow.
        </div>
      )}

      {recs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tuning changes recommended. ✓
        </p>
      ) : (
        <div className="space-y-4">
          {recs.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} applyMode={applyMode} />
          ))}
        </div>
      )}
    </div>
  );
}
