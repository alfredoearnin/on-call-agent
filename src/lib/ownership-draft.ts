import { OwnershipAction } from "@/lib/constants";
import {
  VERDICT_LABELS,
  datadogServiceUrl,
  dropReasonFor,
  verdictFor,
  type OwnershipActionOption,
  type TeamService,
} from "@/lib/team-services";

/**
 * The hand-off packet an ownership decision produces.
 *
 * The decision itself is recorded locally, but the work it implies happens
 * elsewhere: a Cortex retag and a conversation with the receiving team. This
 * builds the artifact that carries the evidence over — so the receiving team
 * gets the verdict, both sources, and the monitors that will start paging them,
 * instead of a one-line "this is yours now".
 */
export interface HandoffDraft {
  summary: string;
  body: string;
  /** Jira create URL, prefilled when the numeric ids are configured. */
  jiraUrl: string;
  /** False when the URL is Jira's plain create page and the body must be pasted. */
  prefilled: boolean;
}

/** Only what the draft needs from a monitor, so this module stays server-agnostic. */
export interface DraftMonitor {
  id: string;
  name: string;
}

export interface JiraDraftTarget {
  baseUrl: string;
  projectId: string;
  issueTypeId: string;
}

function summaryFor(
  service: TeamService,
  option: OwnershipActionOption,
): string {
  switch (option.action) {
    case OwnershipAction.HandOff:
      return `Transfer on-call ownership of ${service.name} to ${option.targetTeam}`;
    case OwnershipAction.Concede:
      return `Drop Growth's claim on ${service.name} (owner: ${option.targetTeam})`;
    case OwnershipAction.Delete:
      return `Decommission ${service.name} and its monitors`;
    case OwnershipAction.FixTag:
      return `Fix the Cortex tag for ${service.name}`;
    case OwnershipAction.Claim:
      return `Retag ${service.name} to Growth in Cortex`;
    default:
      return `Keep ${service.name} in Growth's on-call scope`;
  }
}

function nextSteps(
  service: TeamService,
  option: OwnershipActionOption,
): string[] {
  const monitorStep =
    "Reroute or retire the monitors listed above so they page the new owner.";
  switch (option.action) {
    case OwnershipAction.HandOff:
    case OwnershipAction.Concede:
      return [
        `Retag owningTeamTags in Cortex to ${option.targetTeam}.`,
        monitorStep,
        "Remove the service from the Growth ownership inventory.",
      ];
    case OwnershipAction.Delete:
      return [
        "Confirm no live traffic or dependants remain.",
        "Delete the service and its monitors.",
        "Remove the Cortex entry and the inventory row.",
      ];
    case OwnershipAction.FixTag:
      return [
        "Find the real service tag in Cortex, or register the service if it is missing.",
        "Correct the tag in the ownership inventory and the dashboard catalog.",
        "Re-run the ownership review once the tag resolves.",
      ];
    case OwnershipAction.Claim:
      return [
        "Retag owningTeamTags in Cortex to Growth.",
        "Confirm the current owner agrees before retagging.",
      ];
    default:
      return [
        "Record why the finding does not apply, so the review does not re-raise it.",
      ];
  }
}

export function buildHandoffDraft(input: {
  service: TeamService;
  option: OwnershipActionOption;
  monitors: DraftMonitor[];
  jira: JiraDraftTarget;
  datadogSite: string;
  operator: string;
}): HandoffDraft {
  const { service, option, monitors, jira, datadogSite, operator } = input;
  const verdict = verdictFor(service);
  const reason = dropReasonFor(service);

  const lines: string[] = [
    `Service: ${service.name}${service.label ? ` (${service.label})` : ""}`,
    `Decision: ${option.label}`,
    `Requested by: ${operator}`,
    "",
    "Why:",
    `- Review verdict: ${VERDICT_LABELS[verdict]}${reason ? ` (${reason})` : ""}`,
    `- Growth ownership inventory: ${service.sheetIntent}${
      service.handoffTarget ? ` → ${service.handoffTarget}` : ""
    }`,
    `- Cortex owningTeamTags: ${
      service.cortexOwners.length > 0
        ? service.cortexOwners.join(", ")
        : "tag not found in Cortex"
    }`,
    `- ${option.rationale}`,
  ];

  if (service.note) lines.push(`- ${service.note}`);

  lines.push("", "Datadog APM:", datadogServiceUrl(service.name, datadogSite));

  if (monitors.length > 0) {
    lines.push("", `Monitors currently attributed (${monitors.length}):`);
    for (const m of monitors) {
      lines.push(
        `- ${m.id} — ${m.name} — https://app.${datadogSite}/monitors/${m.id}`,
      );
    }
  } else {
    lines.push(
      "",
      "No monitor has been ingested against this service tag; check Datadog directly before assuming there is no paging.",
    );
  }

  lines.push("", "Next steps:");
  for (const step of nextSteps(service, option)) lines.push(`- ${step}`);

  const summary = summaryFor(service, option);
  const body = lines.join("\n");
  const base = jira.baseUrl.replace(/\/+$/, "");
  const prefilled = Boolean(jira.projectId && jira.issueTypeId);

  const jiraUrl = prefilled
    ? `${base}/secure/CreateIssueDetails!init.jspa?pid=${encodeURIComponent(
        jira.projectId,
      )}&issuetype=${encodeURIComponent(
        jira.issueTypeId,
      )}&summary=${encodeURIComponent(summary)}&description=${encodeURIComponent(body)}`
    : `${base}/secure/CreateIssue!default.jspa`;

  return { summary, body, jiraUrl, prefilled };
}
