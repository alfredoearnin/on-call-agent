import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ServiceRow } from "@/components/team-services-panel";
import {
  DROP_REASON_LABELS,
  dropList,
  dropReasonFor,
  servicesByVerdict,
  type DropReason,
  type TeamService,
} from "@/lib/team-services";
import type { OwnershipDecisionRef, ServiceMonitorRef } from "@/lib/queries";

/** Ordered worst-first: an entry we promised away is more urgent than a bad tag. */
const REASON_ORDER: DropReason[] = [
  "handed-off",
  "deprecated",
  "other-team",
  "unknown-tag",
];

const REASON_DETAIL: Record<DropReason, string> = {
  "handed-off":
    "The ownership inventory names another team as the target. Nothing here says the transfer happened — Cortex still records the old owner — so a monitor still routing to Growth pages the rotation for work the team means to give away.",
  deprecated:
    "Slated for deletion rather than transfer. Monitors on these should be removed with the service.",
  "other-team":
    "Cortex names another team and the ownership inventory never claimed them.",
  "unknown-tag":
    "These tags resolve to nothing in Cortex, so they cannot be owned, paged, or handed over by name. Fix the tag first, then decide ownership.",
};

export function OwnershipFindings({
  monitors,
  decisions,
  site,
}: {
  monitors: Record<string, ServiceMonitorRef[]>;
  decisions: Record<string, OwnershipDecisionRef>;
  site: string;
}) {
  const dropped = dropList();
  const disputed = servicesByVerdict("disputed");

  const byReason = REASON_ORDER.map((reason) => ({
    reason,
    services: dropped.filter((s) => dropReasonFor(s) === reason),
  })).filter((g) => g.services.length > 0);

  const byCounterparty = groupByCounterparty(disputed);

  return (
    <div className="space-y-4">
      {byReason.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              Leave the rotation ({dropped.length})
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              These were listed as confirmed Growth services but no source
              supports keeping them. Each one still carries its monitors below —
              if a monitor here is live, it is paging Growth for something the
              team does not own.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {byReason.map(({ reason, services }) => (
              <Card key={reason} className="border-alert/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {DROP_REASON_LABELS[reason]}
                    </CardTitle>
                    <Badge tone="alert">{services.length}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {REASON_DETAIL[reason]}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {services.map((svc) => (
                      <ServiceRow
                        key={svc.name}
                        service={svc}
                        site={site}
                        monitors={monitors[svc.name] ?? []}
                        decision={decisions[svc.name]}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {byCounterparty.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              Boundary decisions ({disputed.length})
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              The team&apos;s ownership inventory marks all of these &ldquo;keep&rdquo;,
              but Cortex records a different owner. These are decisions to settle
              with the teams below, not data-entry mistakes — either Cortex gets
              retagged or the claim is dropped.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {byCounterparty.map(({ team, services }) => (
              <Card key={team} className="border-warn/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{team}</CardTitle>
                    <Badge tone="warn">{services.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {services.map((svc) => (
                      <ServiceRow
                        key={svc.name}
                        service={svc}
                        site={site}
                        monitors={monitors[svc.name] ?? []}
                        decision={decisions[svc.name]}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * A service can be disputed with more than one team (short links is recorded to
 * both ClientPlatform and CoreUXBackend), so it appears under each. Grouping is
 * for reading, not counting — the headline count comes from the service list.
 */
function groupByCounterparty(
  services: TeamService[],
): { team: string; services: TeamService[] }[] {
  const byTeam = new Map<string, TeamService[]>();
  for (const svc of services) {
    for (const tag of svc.cortexOwners) {
      if (tag.endsWith("-Growth")) continue;
      const list = byTeam.get(tag) ?? [];
      list.push(svc);
      byTeam.set(tag, list);
    }
  }
  return [...byTeam.entries()]
    .map(([team, list]) => ({ team, services: list }))
    .sort((a, b) => b.services.length - a.services.length || a.team.localeCompare(b.team));
}
