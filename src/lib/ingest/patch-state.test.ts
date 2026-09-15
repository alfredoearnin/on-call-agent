import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baselineFor, currentFieldValue, patchState } from "./patch-state";
import type { ProposedPatch } from "./types";

/**
 * The monitor these cases are drawn from is 243692163, after its three
 * recommendations were applied. Its stored patches still held the pre-apply
 * find/replace, and the apply path's only guard was "does the text change?" —
 * which approved the one patch that corrupts the monitor and rejected the two
 * that were harmless.
 */
const APPLIED_MESSAGE =
  "`svc-notification-preferences` 90th percentile latency is too high.\n\n" +
  "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}";

const APPLIED_QUERY =
  "min(last_10m):p90:trace.aspnet_core.request{env:prod," +
  "service:svc-notification-preferences,!resource_name:get_/control/healthy," +
  "!resource_name:get_/control/ready} > 1";

const WRAP_PATCH: ProposedPatch = {
  target: "message",
  prod: {
    find: "@webhook-incidentio-high",
    replace: "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}",
  },
};

describe("patchState", () => {
  /**
   * The case that motivated the module. `find` still matches, because the
   * replacement it was already used to make contains it, so the transform
   * nests: {{#is_alert}}{{#is_alert}}...{{/is_alert}}{{/is_alert}}. The text
   * changes, which is why "did the text change?" waved it through to a
   * credentialed PUT.
   */
  it("refuses a wrap whose replacement is already in the message", () => {
    const state = patchState(WRAP_PATCH, { message: APPLIED_MESSAGE });

    assert.equal(state.kind, "already_applied");
    assert.match(
      state.kind === "already_applied" ? state.message : "",
      /already contains this change/,
    );
  });

  it("offers the same wrap when the handle is still ungated", () => {
    const state = patchState(WRAP_PATCH, {
      message: "latency is too high.\n\n@webhook-incidentio-high",
    });

    assert.equal(state.kind, "appliable");
  });

  it("refuses a window function already changed", () => {
    const state = patchState(
      { target: "query", prod: { find: "avg(last_10m)", replace: "min(last_10m)" } },
      { query: APPLIED_QUERY },
    );

    assert.equal(state.kind, "already_applied");
  });

  it("refuses probe exclusions already present in the scope", () => {
    const scope = "{env:prod,service:svc-notification-preferences}";
    const state = patchState(
      {
        target: "query",
        prod: {
          find: scope,
          replace:
            "{env:prod,service:svc-notification-preferences," +
            "!resource_name:get_/control/healthy,!resource_name:get_/control/ready}",
        },
      },
      { query: APPLIED_QUERY },
    );

    assert.equal(state.kind, "already_applied");
  });

  it("treats a missing patch as nothing to offer", () => {
    assert.equal(patchState(null, { query: APPLIED_QUERY }).kind, "no_patch");
  });

  /**
   * A deletion patch. `includes("")` is true of every string, so asking
   * "does the field already contain the replacement?" would mark every deletion
   * as applied and no monitor could ever have text removed.
   */
  it("judges a deletion by whether the text it removes is gone", () => {
    const patch: ProposedPatch = {
      target: "message",
      prod: { find: "@webhook-incidentio-high", replace: "" },
    };

    assert.equal(
      patchState(patch, { message: "latency\n@webhook-incidentio-high" }).kind,
      "appliable",
    );
    assert.equal(patchState(patch, { message: "latency" }).kind, "already_applied");
  });

  describe("baselines", () => {
    it("refuses a patch whose field moved since it was computed", () => {
      const analysed = { query: "avg(last_10m):p90:x{env:prod} > 1" };
      const patch: ProposedPatch = {
        target: "query",
        baseline: baselineFor("query", analysed),
        prod: { find: "{env:prod}", replace: "{env:prod,!resource_name:probe}" },
      };

      assert.equal(patchState(patch, analysed).kind, "appliable");

      // Someone changed the window function in Datadog in the meantime. The
      // find still matches and the result is not obviously wrong — which is
      // exactly why it must not be applied unexamined.
      const moved = { query: "min(last_10m):p90:x{env:prod} > 1" };
      const state = patchState(patch, moved);
      assert.equal(state.kind, "stale");
      assert.match(
        state.kind === "stale" ? state.message : "",
        /changed after this was analysed/,
      );
    });

    it("ignores a baseline recorded for a different field", () => {
      const patch: ProposedPatch = {
        target: "message",
        baseline: { field: "query", hash: "0000000000000000" },
        prod: { find: "@page", replace: "{{#is_alert}}@page{{/is_alert}}" },
      };

      assert.equal(patchState(patch, { message: "@page" }).kind, "appliable");
    });

    it("judges a patch with no baseline on the already-applied check alone", () => {
      assert.equal(
        patchState(
          { target: "query", prod: { find: "avg(", replace: "max(" } },
          { query: "avg(last_5m):x{env:prod} > 1" },
        ).kind,
        "appliable",
      );
    });
  });

  describe("options", () => {
    const patch: ProposedPatch = {
      target: "options",
      options: [{ key: "require_full_window", value: true }],
    };

    it("refuses when every key already holds the proposed value", () => {
      const state = patchState(patch, {
        options: JSON.stringify({ require_full_window: true, notify_no_data: false }),
      });

      assert.equal(state.kind, "already_applied");
    });

    it("offers the change when the value differs", () => {
      assert.equal(
        patchState(patch, { options: JSON.stringify({ require_full_window: false }) })
          .kind,
        "appliable",
      );
    });

    it("offers the change when no options are stored, leaving that to the apply path", () => {
      assert.equal(patchState(patch, {}).kind, "appliable");
    });
  });
});

describe("currentFieldValue", () => {
  /** Key order must not flip an options baseline. */
  it("normalises options so key order does not change the value", () => {
    const a = currentFieldValue("options", {
      options: JSON.stringify({ b: 1, a: 2 }),
    });
    const b = currentFieldValue("options", {
      options: JSON.stringify({ a: 2, b: 1 }),
    });

    assert.equal(a, b);
  });

  it("reads a null field as empty rather than throwing", () => {
    assert.equal(currentFieldValue("message", { message: null }), "");
    assert.equal(currentFieldValue("options", { options: "not json" }), "not json");
  });
});
