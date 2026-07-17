import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplyControl } from "@/components/apply-control";
import { statusTone, statusLabel, confidenceLabel } from "@/lib/format";

type Mode = "real" | "demo" | "blocked";

interface RecLike {
  id: string;
  monitorId: string | null;
  monitorName: string;
  service: string | null;
  issueType: string;
  title: string;
  before: string;
  after: string;
  changeSummary: string;
  coveragePreserved: string | null;
  expectedImpact: string | null;
  evidence: string | null;
  confidence: string;
  status: string;
  weeksSeen: number;
  firesThisWeek: number;
  patchJson: string | null;
  monitor?: { datadogUrl: string | null } | null;
}

export function RecommendationCard({
  rec,
  applyMode,
}: {
  rec: RecLike;
  applyMode: Mode;
}) {
  return (
    <Card id={rec.id} className="p-4 scroll-mt-20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {rec.monitorId ? (
              <Link
                href={`/monitors/${rec.monitorId}`}
                className="text-sm font-semibold hover:underline"
              >
                {rec.monitorName}
              </Link>
            ) : (
              <span className="text-sm font-semibold">{rec.monitorName}</span>
            )}
            {rec.service && (
              <span className="text-xs text-muted-foreground">{rec.service}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{rec.title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={statusTone(rec.status)}>{statusLabel(rec.status)}</Badge>
          <Badge tone="neutral">conf: {confidenceLabel(rec.confidence)}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background/40 p-2">
          <div className="text-xs font-medium text-alert">Before</div>
          <p className="mt-1 text-xs text-foreground/80">{rec.before}</p>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-2">
          <div className="text-xs font-medium text-ok">After</div>
          <p className="mt-1 text-xs text-foreground/80">{rec.after}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {rec.evidence && (
          <p>
            <span className="font-medium text-foreground/70">Evidence:</span>{" "}
            {rec.evidence} · weeks seen: {rec.weeksSeen}
          </p>
        )}
        {rec.coveragePreserved && (
          <p>
            <span className="font-medium text-foreground/70">Coverage preserved:</span>{" "}
            {rec.coveragePreserved}
          </p>
        )}
        {rec.expectedImpact && (
          <p>
            <span className="font-medium text-foreground/70">Impact:</span>{" "}
            {rec.expectedImpact}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <ApplyControl
          recommendationId={rec.id}
          hasPatch={Boolean(rec.patchJson)}
          mode={applyMode}
        />
        {rec.monitor?.datadogUrl && (
          <a
            href={rec.monitor.datadogUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            Open in Datadog ↗
          </a>
        )}
      </div>
    </Card>
  );
}
