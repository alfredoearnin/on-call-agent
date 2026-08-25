import { getConfig } from "@/lib/config";
import {
  GROWTH_TEAM_SERVICES,
  CORTEX_OWNERSHIP_TRIAGE_URL,
  GROWTH_SERVICES_CANVAS_URL,
  groupServicesByDomain,
  summarizeOwnership,
} from "@/lib/team-services";
import { TeamServicesPanel } from "@/components/team-services-panel";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function ServicesPage() {
  const cfg = getConfig();
  const summary = summarizeOwnership(GROWTH_TEAM_SERVICES);
  const reviewServices = GROWTH_TEAM_SERVICES.filter((s) => s.ownership === "review");
  const groups = groupServicesByDomain(GROWTH_TEAM_SERVICES);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Team services</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Services in the Growth Team on-call scope. Confirmed entries match the
          Cortex catalog (L2/L3-PENG-Growth). Items flagged for review are tagged{" "}
          <code className="rounded bg-muted px-1">{cfg.team.tag}</code> in
          Datadog but may belong to another team.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total services" value={summary.total} />
        <KpiCard
          label="Confirmed ownership"
          value={summary.confirmed}
          tone="ok"
          sub="Cortex L2/L3-PENG-Growth"
        />
        <KpiCard
          label="Needs review"
          value={summary.review}
          tone={summary.review > 0 ? "warn" : "ok"}
          sub="Datadog tag vs Cortex mismatch"
        />
        <KpiCard label="Domains" value={groups.length} sub="Grouped by product area" />
      </div>

      {reviewServices.length > 0 && (
        <Card className="border-warn/30 bg-warn/5">
          <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-warn">
              {reviewServices.length} service
              {reviewServices.length === 1 ? "" : "s"} flagged for ownership review:
            </span>{" "}
            {reviewServices.map((s) => s.name).join(", ")}. See the{" "}
            <a
              href={CORTEX_OWNERSHIP_TRIAGE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Cortex ownership triage
            </a>{" "}
            doc and the{" "}
            <a
              href={GROWTH_SERVICES_CANVAS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Growth audit canvas
            </a>{" "}
            for context.
          </CardContent>
        </Card>
      )}

      <TeamServicesPanel layout="page" />
    </div>
  );
}
