import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractHandles,
  isTeamMonitor,
  isValidHandle,
  isValidMonitorId,
  isValidPriority,
  rerouteMessage,
} from "@/lib/monitor-routing";

describe("isValidMonitorId", () => {
  it("accepts a Datadog monitor id", () => {
    for (const id of ["1", "309355473", "9".repeat(20)]) {
      assert.ok(isValidMonitorId(id), `${id} should be valid`);
    }
  });

  it("rejects anything that could steer the request path", () => {
    // `fetch` resolves dot segments, so these would aim a credentialed request
    // at an endpoint the caller picked rather than at a monitor.
    for (const id of [
      "../../../api/v2/team",
      "..%2f..%2fapi%2fv2%2fteam",
      "123?include=all",
      "123/downtimes",
      "123#frag",
      "",
      " 123",
      "123 ",
      "0",
      "01",
      "-1",
      "1e3",
      "abc",
      "9".repeat(21),
    ]) {
      assert.ok(!isValidMonitorId(id), `${JSON.stringify(id)} should be invalid`);
    }
  });
});

describe("isValidHandle", () => {
  it("accepts the handle shapes Datadog routes on", () => {
    for (const h of [
      "@slack-growth-engineering-alerts",
      "@webhook-incidentio-high",
      "@teams-oncall",
      "@opsgenie",
      "@alice.smith@earnin.com",
      "@a",
    ]) {
      assert.ok(isValidHandle(h), `${h} should be valid`);
    }
  });

  it("rejects anything that could break out of the handle", () => {
    for (const h of [
      "slack-no-at-sign",
      "@",
      "@-leading-dash",
      "@has space",
      "@has\ttab",
      "@has\nnewline",
      "@{{template}}",
      "@handle @second",
      "@handle;rm -rf",
      "@handle</script>",
      "",
      "@" + "a".repeat(200),
    ]) {
      assert.ok(!isValidHandle(h), `${JSON.stringify(h)} should be rejected`);
    }
  });
});

describe("extractHandles", () => {
  it("finds each handle once, in order", () => {
    const msg =
      "Cashout failed @slack-growth-alerts @webhook-incidentio-high cc @slack-growth-alerts";
    assert.deepEqual(extractHandles(msg), [
      "@slack-growth-alerts",
      "@webhook-incidentio-high",
    ]);
  });

  it("finds email handles", () => {
    assert.deepEqual(extractHandles("page @alice@earnin.com now"), [
      "@alice@earnin.com",
    ]);
  });

  it("returns nothing for a message with no handles", () => {
    assert.deepEqual(extractHandles("No routing configured here."), []);
    assert.deepEqual(extractHandles(""), []);
  });

  it("returns promptly on a long adversarial body", () => {
    const hostile = ("@" + "a".repeat(120) + " ").repeat(4000);
    const started = Date.now();
    extractHandles(hostile);
    assert.ok(
      Date.now() - started < 1000,
      "extraction must not backtrack on bounded input",
    );
  });
});

describe("rerouteMessage", () => {
  it("replaces every occurrence of the handle", () => {
    const before =
      "Alert @slack-growth-alerts — escalate to @slack-growth-alerts again";
    const { message, replaced } = rerouteMessage(
      before,
      "@slack-growth-alerts",
      "@slack-cashout-alerts",
    );
    assert.equal(replaced, 2);
    assert.equal(
      message,
      "Alert @slack-cashout-alerts — escalate to @slack-cashout-alerts again",
    );
  });

  it("does not corrupt a longer handle that starts with the same text", () => {
    const before = "@slack-growth and @slack-growth-alerts are different";
    const { message, replaced } = rerouteMessage(
      before,
      "@slack-growth",
      "@slack-cashout",
    );
    assert.equal(replaced, 1);
    assert.equal(
      message,
      "@slack-cashout and @slack-growth-alerts are different",
      "the -alerts channel must be left alone",
    );
  });

  it("leaves the rest of the message byte-identical", () => {
    const before =
      "Runbook: https://wiki/x?a=1&b=2\n\n{{#is_alert}}down{{/is_alert}}\n@slack-a";
    const { message } = rerouteMessage(before, "@slack-a", "@slack-b");
    assert.equal(message, before.replace("@slack-a", "@slack-b"));
    assert.match(message, /\{\{#is_alert\}\}/);
  });

  it("refuses to substitute an invalid handle", () => {
    const before = "@slack-a pages us";
    for (const bad of ["@has space", "@{{x}}", "not-a-handle", ""]) {
      const { message, replaced } = rerouteMessage(before, "@slack-a", bad);
      assert.equal(replaced, 0, `${JSON.stringify(bad)} must not be written`);
      assert.equal(message, before);
    }
  });

  it("treats a no-op as a no-op", () => {
    const before = "@slack-a";
    assert.equal(rerouteMessage(before, "@slack-a", "@slack-a").replaced, 0);
    assert.equal(rerouteMessage(before, "@slack-missing", "@slack-b").replaced, 0);
  });

  it("replaces a handle sitting at the very end of the message", () => {
    const { message, replaced } = rerouteMessage(
      "escalate @slack-a",
      "@slack-a",
      "@slack-b",
    );
    assert.equal(replaced, 1);
    assert.equal(message, "escalate @slack-b");
  });

  it("replaces a handle followed by punctuation", () => {
    const { message, replaced } = rerouteMessage(
      "cc @slack-a, then wait",
      "@slack-a",
      "@slack-b",
    );
    assert.equal(replaced, 1);
    assert.equal(message, "cc @slack-b, then wait");
  });

  it("does not replace when the handle continues with an email domain", () => {
    const { replaced } = rerouteMessage(
      "page @alice@earnin.com",
      "@alice",
      "@bob",
    );
    assert.equal(replaced, 0, "@alice is a prefix of an email handle here");
  });

  it("does not rewrite a handle it is only the tail of", () => {
    // The mirror of the prefix case: @earnin.com occurs standalone, so the
    // operator can legitimately select it, but it also sits at the end of
    // @alice@earnin.com — a handle they never picked.
    const before = "Paging @alice@earnin.com and also @earnin.com for backup";
    const { message, replaced } = rerouteMessage(
      before,
      "@earnin.com",
      "@bob",
    );
    assert.equal(replaced, 1);
    assert.equal(
      message,
      "Paging @alice@earnin.com and also @bob for backup",
      "the email handle must keep its recipient",
    );
  });

  it("substitutes at the very start of a message", () => {
    const { message, replaced } = rerouteMessage("@a paged", "@a", "@b");
    assert.equal(replaced, 1);
    assert.equal(message, "@b paged");
  });
});

describe("isTeamMonitor", () => {
  const TAG = "team:l2-peng-growth";

  it("accepts a monitor Datadog records to the team", () => {
    assert.ok(isTeamMonitor([TAG], TAG));
    assert.ok(isTeamMonitor(["env:prod", TAG, "service:x"], TAG));
    // Datadog is inconsistent about tag casing between ingest and read.
    assert.ok(isTeamMonitor(["Team:L2-PENG-Growth"], TAG));
    assert.ok(isTeamMonitor([` ${TAG} `], TAG));
  });

  it("refuses a monitor that is not the team's", () => {
    assert.ok(!isTeamMonitor(undefined, TAG));
    assert.ok(!isTeamMonitor([], TAG));
    assert.ok(!isTeamMonitor(["team:l2-peng-cashout"], TAG));
    // A prefix is not the tag: another team's tag must not pass on substring.
    assert.ok(!isTeamMonitor(["team:l2-peng-growth-platform"], TAG));
    assert.ok(!isTeamMonitor([TAG], ""));
  });
});

describe("isValidPriority", () => {
  it("accepts Datadog's 1-5 and nothing else", () => {
    for (const p of [1, 2, 3, 4, 5]) assert.ok(isValidPriority(p));
    for (const p of [0, 6, -1, 1.5, NaN, Infinity]) {
      assert.ok(!isValidPriority(p), `${p} should be rejected`);
    }
  });
});
