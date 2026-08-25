import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GROWTH_TEAM_SERVICES,
  CORTEX_OWNERSHIP_TRIAGE_URL,
  GROWTH_SERVICES_CANVAS_URL,
  groupServicesByDomain,
  summarizeOwnership,
  datadogServiceUrl,
  type TeamService,
} from "@/lib/team-services";
import { getConfig } from "@/lib/config";

type Layout = "page" | "card";

export function TeamServicesPanel({ layout = "page" }: { layout?: Layout }) {
  const cfg = getConfig();
  const groups = groupServicesByDomain(GROWTH_TEAM_SERVICES);
  const summary = summarizeOwnership(GROWTH_TEAM_SERVICES);

  if (layout === "page") {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {groups.map(({ domain, label, services }) => (
          <Card key={domain}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{label}</CardTitle>
                <Badge tone="neutral">{services.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {services.map((svc) => (
                  <ServiceRow key={svc.name} service={svc} site={cfg.datadog.site} />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <Card className="xl:col-span-2">
          <CardContent className="pt-4 text-xs text-muted-foreground">
            <p>
              Each service links to its Datadog APM entity (prod). Ownership
              sources: Cortex catalog, Confluence ownership triage, and monitors
              tagged <code className="rounded bg-muted px-1">{cfg.team.tag}</code>.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <a
                href={GROWTH_SERVICES_CANVAS_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Growth audit canvas ↗
              </a>
              <a
                href={CORTEX_OWNERSHIP_TRIAGE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Cortex ownership triage ↗
              </a>
              <a
                href={`https://app.${cfg.datadog.site}/monitors/manage?q=tag%3A${encodeURIComponent(cfg.team.tag)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Datadog monitors ({cfg.team.tag}) ↗
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Team services</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.confirmed} confirmed · {summary.review} need ownership review
          </p>
        </div>
        <Badge tone={summary.review > 0 ? "warn" : "ok"}>
          {summary.total} services
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map(({ label, services }) => (
          <div key={label}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </h3>
            <ul className="space-y-1">
              {services.map((svc) => (
                <ServiceRow key={svc.name} service={svc} site={cfg.datadog.site} />
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ServiceRow({ service, site }: { service: TeamService; site: string }) {
  const display = service.label ?? service.name;
  const href = datadogServiceUrl(service.name, site);

  return (
    <li className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40">
      <div className="min-w-0">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
          title={service.name}
        >
          {display}
        </a>
        {service.label && (
          <div className="truncate text-[11px] text-muted-foreground">
            {service.name}
          </div>
        )}
        {service.reviewNote && (
          <p className="mt-0.5 text-[11px] leading-snug text-warn">
            {service.reviewNote}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Badge tone={service.ownership === "confirmed" ? "ok" : "warn"}>
          {service.ownership === "confirmed" ? "confirmed" : "review"}
        </Badge>
        {service.cortexOwner && (
          <span className="text-[10px] text-muted-foreground">
            {service.cortexOwner}
          </span>
        )}
      </div>
    </li>
  );
}
