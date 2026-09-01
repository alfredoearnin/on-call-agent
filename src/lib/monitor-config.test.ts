import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appliedInSnapshotHistory,
  diffMonitorConfig,
  hasNoDatadogConfig,
  hashMonitorConfig,
  recommendationExplainsEdit,
  stableJson,
  thresholdsFromOptions,
} from "./monitor-config";

describe("stableJson", () => {
  it("orders object keys so hash is independent of insertion order", () => {
    assert.equal(
      stableJson({ warning: 80, critical: 90 }),
      stableJson({ critical: 90, warning: 80 }),
    );
  });
});

describe("hashMonitorConfig", () => {
  it("changes when the notify message changes", () => {
    const base = {
      query: "a / b * 100",
      message: "@pagerduty-Activation-Alerts @webhook-incidentio-high",
      priority: "High",
    };
    const routed = {
      ...base,
      message: "{{#is_warning}}\n@pagerduty-growth-low-urgency\n{{/is_warning}}",
    };
    assert.notEqual(hashMonitorConfig(base), hashMonitorConfig(routed));
  });

  it("changes when thresholds change even if query and message stay put", () => {
    const loose = {
      query: "sum(last_4h):foo < 5",
      message: "page",
      priority: "High",
      thresholds: { critical: 5 },
    };
    const tight = { ...loose, thresholds: { critical: 2 } };
    assert.notEqual(hashMonitorConfig(loose), hashMonitorConfig(tight));
  });
});

describe("diffMonitorConfig", () => {
  it("reports the message field for a HIGH→LOW notify split", () => {
    const diffs = diffMonitorConfig(
      { message: "@webhook-incidentio-high" },
      {
        message:
          "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}\n{{#is_warning}}@webhook-incidentio-low{{/is_warning}}",
      },
    );
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0].field, "message");
    assert.match(diffs[0].after, /is_warning/);
  });

  it("ignores a thresholds backfill onto a snapshot that stored none", () => {
    const diffs = diffMonitorConfig(
      { query: "q", message: "m", priority: "High" },
      {
        query: "q",
        message: "m",
        priority: "High",
        thresholds: { critical: 90, warning: 80 },
      },
    );
    assert.deepEqual(diffs, []);
  });

  it("reports a real threshold tighten when a previous snapshot had thresholds", () => {
    const diffs = diffMonitorConfig(
      { query: "q", thresholds: { critical: 5 } },
      { query: "q", thresholds: { critical: 2 } },
    );
    assert.equal(diffs[0]?.field, "thresholds");
    assert.match(diffs[0].before, /5/);
    assert.match(diffs[0].after, /2/);
  });

  it("ignores the first Datadog capture after a Confluence-only snapshot", () => {
    const diffs = diffMonitorConfig(
      { query: null, message: null, priority: "High" },
      {
        query: "avg(last_30m):a / b * 100",
        message: "page",
        priority: "P2",
        thresholds: { critical: 90, warning: 80 },
      },
    );
    assert.deepEqual(diffs, []);
  });

  it("ignores a snapshot that lost its config to a non-Datadog sync", () => {
    const diffs = diffMonitorConfig(
      { query: "avg(last_10m):a / b", message: "page", thresholds: { critical: 33 } },
      { query: null, message: null, priority: "High" },
    );
    assert.deepEqual(diffs, []);
  });

  it("still reports an edit when the previous snapshot held Datadog config", () => {
    const diffs = diffMonitorConfig(
      { query: "q", message: "page" },
      { query: "q", message: "do not page" },
    );
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0].field, "message");
  });
});

describe("hasNoDatadogConfig", () => {
  it("ignores priority, which Confluence supplies on its own", () => {
    assert.equal(hasNoDatadogConfig({ priority: "High" }), true);
    assert.equal(hasNoDatadogConfig({ query: "  ", message: null }), true);
  });

  it("is false as soon as any Datadog field is present", () => {
    assert.equal(hasNoDatadogConfig({ query: "q" }), false);
    assert.equal(hasNoDatadogConfig({ message: "page" }), false);
    assert.equal(hasNoDatadogConfig({ thresholds: { critical: 90 } }), false);
    assert.equal(hasNoDatadogConfig({ options: { notify_audit: false } }), false);
  });
});

describe("thresholdsFromOptions", () => {
  it("reads Datadog options.thresholds", () => {
    assert.deepEqual(
      thresholdsFromOptions({ thresholds: { critical: 90 } }),
      { critical: 90 },
    );
  });
});

describe("recommendationExplainsEdit", () => {
  it("matches when the after message contains replace and dropped find", () => {
    assert.equal(
      recommendationExplainsEdit(
        {
          target: "message",
          prod: {
            find: "@webhook-incidentio-high",
            replace: "@webhook-incidentio-low",
          },
        },
        {
          message:
            "{{#is_warning}}@webhook-incidentio-low{{/is_warning}}",
        },
      ),
      true,
    );
  });

  it("still matches a HIGH→LOW split that keeps the High handle in is_alert", () => {
    assert.equal(
      recommendationExplainsEdit(
        {
          target: "message",
          prod: {
            find: "@webhook-incidentio-high",
            replace: "@webhook-incidentio-low",
          },
        },
        {
          message:
            "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}\n{{#is_warning}}@webhook-incidentio-low{{/is_warning}}",
        },
      ),
      true,
    );
  });
});

describe("appliedInSnapshotHistory", () => {
  const patch = {
    target: "message",
    prod: {
      find: "@webhook-incidentio-high",
      replace: "@webhook-incidentio-low",
    },
  };

  it("detects the recommended handle appearing where it was absent", () => {
    assert.equal(
      appliedInSnapshotHistory(patch, [
        { message: "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}" },
        {
          message:
            "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}\n{{#is_warning}}@webhook-incidentio-low{{/is_warning}}",
        },
      ]),
      true,
    );
  });

  it("ignores a handle that boilerplate merely names in prose", () => {
    // The non-prod branch documents the low handle without routing to it, so
    // it is present from the first config we ever read — no transition.
    const boilerplate = {
      message:
        "{{#is_match \"env.name\" \"prod\"}}@webhook-incidentio-high{{/is_match}}\n" +
        "{{^is_match \"env.name\" \"prod\"}}Put the channel here, this could be " +
        "@slack-<channel> or '@webhook-incidentio-low'.{{/is_match}}",
    };
    assert.equal(appliedInSnapshotHistory(patch, [boilerplate, boilerplate]), false);
  });

  it("does not manufacture a transition out of config-less snapshots", () => {
    assert.equal(
      appliedInSnapshotHistory(patch, [
        { message: null },
        { message: null },
        { message: "{{#is_warning}}@webhook-incidentio-low{{/is_warning}}" },
      ]),
      false,
    );
  });

  it("returns false without a patch or a replace target", () => {
    assert.equal(appliedInSnapshotHistory(null, []), false);
    assert.equal(
      appliedInSnapshotHistory({ target: "message" }, [
        { message: "@webhook-incidentio-low" },
      ]),
      false,
    );
  });
});
