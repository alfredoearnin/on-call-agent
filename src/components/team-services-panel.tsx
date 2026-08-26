import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OWNERSHIP_INVENTORY_URL,
  OWNERSHIP_REVIEWED_ON,
  VERDICT_LABELS,
  actionsFor,
  datadogMonitorSearchUrl,
  datadogServiceUrl,
  dropReasonFor,
  groupServicesByDomain,
  onCallScope,
  optionFor,
  verdictFor,
  type OwnershipVerdict,
  type TeamService,
} from "@/lib/team-services";
import { getConfig } from "@/lib/config";
import { buildHandoffDraft } from "@/lib/ownership-draft";
import { priorityTone } from "@/lib/format";
import { OwnershipActions } from "@/components/ownership-actions";
import type { OwnershipDecisionRef, ServiceMonitorRef } from "@/lib/queries";

const VERDICT_TONE: Record<OwnershipVerdict, string> = {
  corroborated: "ok",
  disputed: "warn",
  unsupported: "alert",
};

export function TeamServicesPanel({
  monitors = {},
  decisions = {},
}: {
  monitors?: Record<string, ServiceMonitorRef[]>;
  decisions?: Record<string, OwnershipDecisionRef>;
}) {
  const cfg = getConfig();
  const groups = groupServicesByDomain(onCallScope());

  return (
    <div className="space-y-4">
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
              <ul className="space-y-2.5">
                {services.map((svc) => (
                  <ServiceRow
                    key={svc.name}
                    service={svc}
                    site={cfg.datadog.site}
                    monitors={monitors[svc.name] ?? []}
                    decision={decisions[svc.name]}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Ownership reconciled {OWNERSHIP_REVIEWED_ON} across three sources:
            the team&apos;s ownership inventory (intent), the Cortex catalog
            (recorded owner), and monitors tagged{" "}
            <code className="rounded bg-muted px-1">{cfg.team.tag}</code> in
            Datadog (what actually pages). Service names link to the Datadog APM
            entity; each monitor links to its own page by id.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={OWNERSHIP_INVENTORY_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Growth Ownership Inventory ↗
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

export function ServiceRow({
  service,
  site,
  monitors,
  decision,
}: {
  service: TeamService;
  site: string;
  monitors: ServiceMonitorRef[];
  decision?: OwnershipDecisionRef;
}) {
  const cfg = getConfig();
  const display = service.label ?? service.name;
  const verdict = verdictFor(service);
  const reason = dropReasonFor(service);
  const foreignOwners = service.cortexOwners.filter(
    (tag) => !tag.endsWith("-Growth"),
  );

  // A decision taken before a catalog correction may no longer have a matching
  // option; without one there is nothing to draft, and the row says so.
  const decidedOption = decision
    ? optionFor(service, decision.action, decision.targetTeam)
    : undefined;
  const draft =
    decision && decidedOption
      ? buildHandoffDraft({
          service,
          option: decidedOption,
          monitors,
          jira: {
            baseUrl: cfg.jira.baseUrl,
            projectId: cfg.jira.handoffProjectId,
            issueTypeId: cfg.jira.handoffIssueTypeId,
          },
          datadogSite: site,
          operator: decision.operator,
        })
      : undefined;

  return (
    <li className="rounded-md px-1 py-1 hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={datadogServiceUrl(service.name, site)}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
            title={`${service.name} — Datadog APM`}
          >
            {display}
          </a>
          {service.label && (
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {service.name}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <Badge tone={VERDICT_TONE[verdict]}>{VERDICT_LABELS[verdict]}</Badge>
          {service.cortexOwners.length > 0 ? (
            <span className="text-right text-[10px] text-muted-foreground">
              {service.cortexOwners.join(", ")}
            </span>
          ) : (
            <span className="text-[10px] text-alert">not in Cortex</span>
          )}
        </div>
      </div>

      {verdict === "disputed" && foreignOwners.length > 0 && (
        <p className="mt-1 text-[11px] leading-snug text-warn">
          Team claims it; Cortex records {foreignOwners.join(" and ")}.
        </p>
      )}
      {reason === "handed-off" && service.handoffTarget && (
        <p className="mt-1 text-[11px] leading-snug text-alert">
          Already handed off to {service.handoffTarget}.
        </p>
      )}
      {service.note && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {service.note}
        </p>
      )}

      <MonitorLinks service={service} site={site} monitors={monitors} />

      <OwnershipActions
        serviceName={service.name}
        options={actionsFor(service)}
        decision={decision}
        draft={draft}
        decidedOnVerdict={decision ? decision.verdict === verdict : undefined}
      />
    </li>
  );
}

/**
 * Every monitor gets its id as a link so it can be opened directly.
 *
 * The chip goes to this dashboard's monitor page (fire history, config
 * snapshots, applied changes); the arrow goes straight to Datadog. When no
 * monitor has been ingested for the service we show a scoped Datadog search
 * instead of a zero, because the Confluence ingest carries monitor ids without
 * a service column — absence here is missing data, not missing coverage.
 */
function MonitorLinks({
  service,
  site,
  monitors,
}: {
  service: TeamService;
  site: string;
  monitors: ServiceMonitorRef[];
}) {
  if (monitors.length === 0) {
    return (
      <div className="mt-1.5">
        <a
          href={datadogMonitorSearchUrl(service.name, site)}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
        >
          Find monitors in Datadog ↗
        </a>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Monitors
      </span>
      {monitors.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center overflow-hidden rounded border border-border"
        >
          <Link
            href={`/monitors/${m.id}`}
            title={`${m.name} — ${m.currentState}${m.alertCount > 0 ? `, ${m.alertCount} fires` : ""}`}
            className="px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted"
          >
            {m.id}
          </Link>
          <Badge tone={priorityTone(m.priority)} className="rounded-none border-0 px-1 py-0 text-[9px]">
            {m.priority}
          </Badge>
          {m.datadogUrl && (
            <a
              href={m.datadogUrl}
              target="_blank"
              rel="noreferrer"
              title={`Open monitor ${m.id} in Datadog`}
              className="border-l border-border px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-primary"
            >
              ↗
            </a>
          )}
        </span>
      ))}
    </div>
  );
}
