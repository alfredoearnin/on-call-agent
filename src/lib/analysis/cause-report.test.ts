import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  causePageTitle,
  parseCausePage,
  titleMatchesMonitor,
  verdictLabel,
} from "./cause-report";

/**
 * The page the agent writes is read by two audiences: a person opening it in
 * Confluence, and the dashboard. Prose serves the first; one fenced JSON block
 * serves the second.
 *
 * That split exists because the handoff pipeline proved the alternative. The
 * dashboard used to extract counts from English sentences and lost twenty of
 * twenty-three firings — so anything the dashboard needs to act on comes from
 * the block, and the parser refuses rather than guesses when the block is
 * absent or wrong.
 */
const PAGE = `
h2. Monitor 243692163 — cause investigation

*Verdict:* real defect. One \`GET /external/preferences\` took ~80s on
2026-09-09: \`svc-oauth/introspect\` was slow, the service then retried a 404
from \`service-card-processor\` with ~9s timeouts, and the client gave up after
20s (HTTP 499) while the backend kept working.

\`\`\`json
{
  "monitorId": "243692163",
  "investigatedAt": "2026-09-14T22:40:00Z",
  "verdict": "real_defect",
  "cause": "A retry loop against service-card-processor 404s, with no timeout budget and no propagation of client cancellation.",
  "evidence": ["trace 6aa1197f", "https://app.datadoghq.com/apm/trace/6aa1197f"],
  "tickets": ["GROWTH-101", "GROWTH-102", "GROWTH-103"],
  "receivedMonitorId": true,
  "limitations": []
}
\`\`\`

Runbook: https://example.invalid/runbook
`;

describe("parseCausePage", () => {
  it("reads the structured block the prompt requires", () => {
    const { report, problem } = parseCausePage(PAGE);

    assert.equal(problem, undefined);
    assert.equal(report?.monitorId, "243692163");
    assert.equal(report?.verdict, "real_defect");
    assert.deepEqual(report?.tickets, ["GROWTH-101", "GROWTH-102", "GROWTH-103"]);
    assert.equal(report?.receivedMonitorId, true);
    assert.match(report!.cause!, /retry loop/);
  });

  it("accepts an undetermined verdict with no cause", () => {
    const { report } = parseCausePage(`
\`\`\`json
{
  "monitorId": "301972958",
  "investigatedAt": "2026-09-14T22:40:00Z",
  "verdict": "undetermined",
  "cause": null,
  "evidence": ["searched spans 18:40-19:10Z, no request over 1s"],
  "tickets": [],
  "limitations": ["no trace retention beyond 15 days"]
}
\`\`\``);

    assert.equal(report?.verdict, "undetermined");
    assert.equal(report?.cause, null);
    assert.deepEqual(report?.limitations, ["no trace retention beyond 15 days"]);
  });

  /**
   * The honesty cases. Each one is a page the dashboard cannot act on, and
   * each must be distinguishable from "the agent found nothing" — otherwise a
   * broken page reads as a clean bill of health.
   */
  it("says so when the page carries no block at all", () => {
    const { report, problem } = parseCausePage(
      "The agent could not reach Datadog, so no investigation was possible.",
    );

    assert.equal(report, undefined);
    assert.match(problem!, /No structured block/);
  });

  it("says so when the block is not valid JSON", () => {
    const { problem } = parseCausePage("```json\n{ verdict: real_defect }\n```");

    assert.match(problem!, /not valid JSON/);
  });

  it("says so when the block is valid JSON of the wrong shape", () => {
    const { problem } = parseCausePage(
      '```json\n{"monitorId": "1", "verdict": "probably fine"}\n```',
    );

    assert.match(problem!, /does not match the expected shape/);
  });

  it("skips unrelated code blocks rather than failing on them", () => {
    const { report } = parseCausePage(`
\`\`\`
avg(last_10m):p90:trace.aspnet_core.request{env:prod} > 1
\`\`\`

\`\`\`json
{
  "monitorId": "243692163",
  "investigatedAt": "2026-09-14T22:40:00Z",
  "verdict": "noise_only",
  "cause": "A transient downstream spike the service recovered from on its own.",
  "evidence": [],
  "tickets": [],
  "limitations": []
}
\`\`\``);

    assert.equal(report?.verdict, "noise_only");
  });

  it("reports an empty page as empty", () => {
    assert.match(parseCausePage("   ").problem!, /empty/);
  });
});

describe("causePageTitle", () => {
  it("keys the title on the monitor id", () => {
    assert.equal(causePageTitle("243692163", "Monitor "), "Monitor 243692163");
  });

  it("uses the bare id when no prefix is configured", () => {
    assert.equal(causePageTitle("243692163", ""), "243692163");
  });
});

describe("titleMatchesMonitor", () => {
  it("matches the id however the page is titled around it", () => {
    for (const title of [
      "243692163",
      "Monitor 243692163",
      "Monitor 243692163 — cause investigation",
      "[243692163] svc-notification-preferences",
    ]) {
      assert.equal(titleMatchesMonitor(title, "243692163"), true, title);
    }
  });

  /**
   * The case a substring match would get wrong. Monitor ids nest, and this
   * repo has both 143509449 and 1435-prefixed ids in play, so claiming the
   * wrong page would attach one monitor's findings to another.
   */
  it("does not match an id that is only a prefix of the title's id", () => {
    assert.equal(titleMatchesMonitor("Monitor 143509449", "1435"), false);
    assert.equal(titleMatchesMonitor("Monitor 2436921630", "243692163"), false);
  });

  it("does not match a different monitor", () => {
    assert.equal(titleMatchesMonitor("Monitor 301972958", "243692163"), false);
  });
});

describe("verdictLabel", () => {
  it("labels every verdict the schema allows", () => {
    assert.equal(verdictLabel("noise_only"), "Noise only");
    assert.equal(verdictLabel("real_defect"), "Real defect");
    assert.equal(verdictLabel("undetermined"), "Undetermined");
  });
});
