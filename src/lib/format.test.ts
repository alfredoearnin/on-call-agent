/*
 * The "What happened" detail is prose written by an agent, and it carries two
 * things that fight each other: deliberate markdown emphasis marking sections
 * (`_Observed_`, `_Likely cause_`), and Datadog queries full of snake_case
 * identifiers (`sum:kubernetes_state.job.failed{kube_app_name:...}`). Rendering it
 * raw shows literal underscores in one giant paragraph; rendering it as general
 * markdown eats the underscores out of the queries. These cases pin the line
 * between the two.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitFindingSections } from "@/lib/format";

describe("splitFindingSections", () => {
  it("splits the detail on its section labels", () => {
    const s = splitFindingSections(
      "_Observed_ — the monitor fired twice. _Likely cause_ — transient failures.",
    );

    assert.deepEqual(
      s.map((x) => x.label),
      ["Observed", "Likely cause"],
    );
  });

  it("keeps each section's body with its label", () => {
    const s = splitFindingSections(
      "_Observed_ — fired twice overnight. _Likely cause_ — transient cron failures.",
    );

    assert.ok(s[0].body.includes("fired twice overnight"), s[0].body);
    assert.ok(s[1].body.includes("transient cron failures"), s[1].body);
  });

  it("strips the emphasis markers from the label", () => {
    const s = splitFindingSections("_Observed_ — something happened.");

    assert.equal(s[0].label, "Observed");
    assert.ok(!s[0].body.includes("_"), s[0].body);
  });

  // The case that rules out a general markdown renderer.
  it("leaves snake_case identifiers in a datadog query untouched", () => {
    const query =
      "sum(last_5m):sum:kubernetes_state.job.failed{kube_app_name:cronjob-mark-tech-crons} by {kube_cluster_name,env} >= 1";
    const s = splitFindingSections(`_Observed_ — monitor 313314019 (${query}) fired.`);

    assert.equal(s.length, 1);
    assert.ok(s[0].body.includes(query), s[0].body);
  });

  it("does not treat a lowercase snake_case fragment as a label", () => {
    const s = splitFindingSections("the kube_cluster_name tag was missing.");

    assert.equal(s.length, 1);
    assert.equal(s[0].label, undefined);
    assert.ok(s[0].body.includes("kube_cluster_name"), s[0].body);
  });

  it("does not treat an underscore run containing punctuation as a label", () => {
    const s = splitFindingSections(
      "routed via env:prod (flavor:prod). _timeout); aiden.ramgoolam user_ saw it.",
    );

    assert.equal(s.length, 1, "no label should have been detected");
  });

  it("keeps text before the first label as an unlabelled lead", () => {
    const s = splitFindingSections("Some preamble. _Observed_ — then the detail.");

    assert.equal(s[0].label, undefined);
    assert.ok(s[0].body.includes("Some preamble"), s[0].body);
    assert.equal(s[1].label, "Observed");
  });

  it("returns a single unlabelled section when there are no labels", () => {
    const s = splitFindingSections("Just one flat paragraph with no markers.");

    assert.equal(s.length, 1);
    assert.equal(s[0].label, undefined);
  });

  it("returns nothing for empty input", () => {
    assert.deepEqual(splitFindingSections(null), []);
    assert.deepEqual(splitFindingSections(""), []);
    assert.deepEqual(splitFindingSections("   "), []);
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();
    splitFindingSections(`_${"a".repeat(9_000)}_`);
    splitFindingSections("_Observed_ ".repeat(3_000));
    splitFindingSections("a_b".repeat(9_000));

    assert.ok(
      Date.now() - started < 1_000,
      `splitFindingSections took ${Date.now() - started}ms on adversarial input`,
    );
  });
});
