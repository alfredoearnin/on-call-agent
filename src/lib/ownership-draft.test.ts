import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OwnershipAction } from "@/lib/constants";
import { buildHandoffDraft } from "@/lib/ownership-draft";
import { actionsFor, optionFor, type TeamService } from "@/lib/team-services";

const JIRA_UNCONFIGURED = {
  baseUrl: "https://earnin.atlassian.net",
  projectId: "",
  issueTypeId: "",
};

const JIRA_CONFIGURED = {
  baseUrl: "https://earnin.atlassian.net",
  projectId: "10042",
  issueTypeId: "10002",
};

const HANDED_OFF: TeamService = {
  name: "job-cashout-user-cashout-status-processor",
  label: "Funnel cashout status",
  domain: "cashout",
  sheetIntent: "hand-off",
  handoffTarget: "Cashout",
  cortexOwners: ["L3-PENG-Activation"],
  note: "Added by Growth in Q1'23.",
};

const MONITORS = [
  { id: "143507582", name: "Duplicate funnel cashout" },
  { id: "143516414", name: "Funnel Cashout good-to-go anomaly" },
];

function draftFor(
  service: TeamService,
  action: string,
  targetTeam?: string,
  jira = JIRA_UNCONFIGURED,
  monitors = MONITORS,
) {
  const option = optionFor(service, action, targetTeam);
  assert.ok(option, `${action} is not offered for ${service.name}`);
  return buildHandoffDraft({
    service,
    option,
    monitors,
    jira,
    datadogSite: "datadoghq.com",
    operator: "alfredo",
  });
}

describe("buildHandoffDraft", () => {
  it("names the service and the receiving team in the summary", () => {
    const draft = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout");
    assert.match(draft.summary, /job-cashout-user-cashout-status-processor/);
    assert.match(draft.summary, /Cashout/);
  });

  it("carries the evidence from both sources, not just the verdict", () => {
    const { body } = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout");
    assert.match(body, /Growth ownership inventory: hand-off → Cashout/);
    assert.match(body, /Cortex owningTeamTags: L3-PENG-Activation/);
    assert.match(body, /Added by Growth in Q1'23\./);
    assert.match(body, /Requested by: alfredo/);
  });

  it("lists every monitor with its id and a link, so paging transfers too", () => {
    const { body } = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout");
    assert.match(body, /Monitors currently attributed \(2\)/);
    for (const m of MONITORS) {
      assert.match(body, new RegExp(m.id));
      assert.match(
        body,
        new RegExp(`https://app\\.datadoghq\\.com/monitors/${m.id}`),
      );
    }
  });

  it("says so rather than implying no paging when nothing is attributed", () => {
    const { body } = draftFor(
      HANDED_OFF,
      OwnershipAction.HandOff,
      "Cashout",
      JIRA_UNCONFIGURED,
      [],
    );
    assert.doesNotMatch(body, /Monitors currently attributed/);
    assert.match(body, /check Datadog directly/);
  });

  it("gives the receiving team concrete next steps", () => {
    const { body } = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout");
    assert.match(body, /Retag owningTeamTags in Cortex to Cashout\./);
    assert.match(body, /so they page the new owner/);
  });

  it("adapts the steps to the action", () => {
    const deprecated: TeamService = {
      name: "job-cashout-attempt-restore-event-processor",
      domain: "cashout",
      sheetIntent: "deprecate",
      cortexOwners: ["L3-PENG-Activation"],
    };
    const { summary, body } = draftFor(deprecated, OwnershipAction.Delete);
    assert.match(summary, /Decommission/);
    assert.match(body, /no live traffic or dependants/);
    assert.doesNotMatch(body, /Retag owningTeamTags/);
  });

  it("falls back to Jira's plain create page when ids are not configured", () => {
    const draft = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout");
    assert.equal(draft.prefilled, false);
    assert.equal(
      draft.jiraUrl,
      "https://earnin.atlassian.net/secure/CreateIssue!default.jspa",
    );
  });

  it("prefills summary and description once both ids are configured", () => {
    const draft = draftFor(
      HANDED_OFF,
      OwnershipAction.HandOff,
      "Cashout",
      JIRA_CONFIGURED,
    );
    assert.equal(draft.prefilled, true);
    assert.match(draft.jiraUrl, /pid=10042/);
    assert.match(draft.jiraUrl, /issuetype=10002/);
    assert.ok(
      draft.jiraUrl.includes(encodeURIComponent(draft.summary)),
      "summary must survive encoding",
    );
    assert.ok(draft.jiraUrl.includes(encodeURIComponent(draft.body)));
  });

  it("does not double the slash on a base url that ends in one", () => {
    const draft = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout", {
      ...JIRA_CONFIGURED,
      baseUrl: "https://earnin.atlassian.net/",
    });
    assert.ok(!draft.jiraUrl.includes(".net//"));
  });

  it("emits no link when the base url is not https", () => {
    // The url lands in an href, so a non-https base has to produce a dead
    // control rather than something the browser will execute or resolve
    // against the dashboard's own origin.
    for (const baseUrl of [
      "javascript:alert(1)//earnin.atlassian.net",
      "data:text/html,<script>1</script>",
      "http://earnin.atlassian.net",
      "earnin.atlassian.net",
      "",
      "   ",
    ]) {
      const draft = draftFor(HANDED_OFF, OwnershipAction.HandOff, "Cashout", {
        ...JIRA_CONFIGURED,
        baseUrl,
      });
      assert.equal(draft.jiraUrl, "", `${JSON.stringify(baseUrl)} must not link`);
      assert.equal(draft.prefilled, false);
      // The note is the fallback, so it still has to be worth pasting.
      assert.match(draft.body, /Next steps:/);
    }
  });

  it("builds a draft for every action the catalog can offer", () => {
    const svc: TeamService = {
      name: "svc-links-internal",
      domain: "links",
      sheetIntent: "keep",
      cortexOwners: ["L3-PENG-ClientPlatform", "L3-PENG-CoreUXBackend"],
    };
    for (const option of actionsFor(svc)) {
      const draft = buildHandoffDraft({
        service: svc,
        option,
        monitors: [],
        jira: JIRA_CONFIGURED,
        datadogSite: "datadoghq.com",
        operator: "alfredo",
      });
      assert.ok(draft.summary.length > 0, `${option.action}: empty summary`);
      assert.match(draft.body, /Next steps:/, `${option.action}: no next steps`);
    }
  });
});
