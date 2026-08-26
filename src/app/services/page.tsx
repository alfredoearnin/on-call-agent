import { getConfig } from "@/lib/config";
import {
  GROWTH_SERVICES_CANVAS_URL,
  GROWTH_TEAM_SERVICES,
  CORTEX_OWNERSHIP_TRIAGE_URL,
  OWNERSHIP_INVENTORY_URL,
  OWNERSHIP_REVIEWED_ON,
  onCallScope,
  summarizeOwnership,
} from "@/lib/team-services";
import { getServiceMonitors } from "@/lib/queries";
import { TeamServicesPanel } from "@/components/team-services-panel";
import { OwnershipFindings } from "@/components/ownership-findings";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const cfg = getConfig();
  const summary = summarizeOwnership(GROWTH_TEAM_SERVICES);
  const scope = onCallScope();
  const monitors = await getServiceMonitors(
    GROWTH_TEAM_SERVICES.map((s) => s.name),
  );
  const monitorCount = Object.values(monitors).reduce(
    (n, list) => n + list.length,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Service ownership</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Reconciled {OWNERSHIP_REVIEWED_ON} across three sources that disagree:
          the{" "}
          <a
            href={OWNERSHIP_INVENTORY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Growth Ownership Inventory
          </a>{" "}
          (what the team intends to own), the Cortex catalog (what the org
          records, and what drives escalation), and monitors tagged{" "}
          <code className="rounded bg-muted px-1">{cfg.team.tag}</code> in
          Datadog (what actually pages someone).
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="In on-call scope"
          value={scope.length}
          sub={`of ${summary.total} reviewed`}
        />
        <KpiCard
          label="Confirmed in Cortex"
          value={summary.corroborated}
          tone="ok"
          sub="Growth is a recorded owner"
        />
        <KpiCard
          label="Disputed"
          value={summary.disputed}
          tone={summary.disputed > 0 ? "warn" : "ok"}
          sub={`Claimed by us, recorded to ${summary.counterparties.length} other teams`}
        />
        <KpiCard
          label="Should drop"
          value={summary.unsupported}
          tone={summary.unsupported > 0 ? "alert" : "ok"}
          sub="Handed off, deprecated, or bad tag"
        />
      </div>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="pt-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-info">
              Cortex records only eight services to Growth in total.
            </span>{" "}
            An earlier version of this catalog asserted a{" "}
            <code className="rounded bg-muted px-1">L2-PENG-Growth</code> tag on
            nearly every entry, so most of those claims named a tag that does not
            exist. Ownership <em>intent</em> and the <em>recorded owner</em> are
            now stored separately, and the verdict below is derived from the two
            rather than hardcoded.
          </p>
          <p className="mt-2">
            The sharpest example is Postman: Cortex tags the six send-message SQS
            queues to <code className="rounded bg-muted px-1">L3-PENG-Growth</code>{" "}
            while the service belongs to Activation and its processor to
            Discovery. Growth owns the plumbing but not the code — a queue
            backlog pages us, a bug in the consumer does not. That is the same
            set of infrastructure entities the April 2026 triage was meant to
            move and never did.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a
              href={CORTEX_OWNERSHIP_TRIAGE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Cortex ownership triage ↗
            </a>
            <a
              href={GROWTH_SERVICES_CANVAS_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Growth audit canvas ↗
            </a>
          </div>
        </CardContent>
      </Card>

      <OwnershipFindings monitors={monitors} site={cfg.datadog.site} />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            On-call scope ({scope.length})
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            What Growth could plausibly be paged for: confirmed in Cortex, or
            still claimed by the team with the boundary unresolved.
            {monitorCount === 0
              ? " No monitors have been ingested with a service tag yet — the current ingest reads monitor ids from the weekly Confluence report, which has no service column, so each service links to a scoped Datadog search instead."
              : ` ${monitorCount} ingested monitors are linked by id below.`}
          </p>
        </div>
        <TeamServicesPanel monitors={monitors} />
      </section>
    </div>
  );
}
