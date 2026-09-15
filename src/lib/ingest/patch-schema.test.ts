import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStoredPatch } from "./patch-schema";

/**
 * `patchJson` is the last thing between a stored value and a credentialed PUT
 * against a production Datadog monitor, and its writers now include a language
 * model. Every case below is a value that used to reach `applyTransform` or the
 * Datadog request body through a bare cast.
 *
 * The contract is uniform: anything that cannot be trusted becomes `null`, and
 * a caller that gets `null` reports "no applyable change" rather than building
 * a request from whatever the column held. Nothing here throws.
 */
describe("parseStoredPatch", () => {
  it("accepts the two patches the analysis actually produces", () => {
    const gateWarn = parseStoredPatch(
      JSON.stringify({
        target: "message",
        prod: {
          find: "@webhook-incidentio-high",
          replace: "{{#is_alert}}@webhook-incidentio-high{{/is_alert}}",
        },
      }),
    );
    assert.equal(gateWarn?.target, "message");
    assert.equal(gateWarn?.prod?.find, "@webhook-incidentio-high");

    const sustain = parseStoredPatch(
      JSON.stringify({
        target: "query",
        prod: { find: "avg(last_10m)", replace: "min(last_15m)" },
      }),
    );
    assert.equal(sustain?.prod?.replace, "min(last_15m)");
  });

  it("accepts an options patch", () => {
    const patch = parseStoredPatch(
      JSON.stringify({
        target: "options",
        options: [{ key: "require_full_window", value: true }],
      }),
    );

    assert.equal(patch?.target, "options");
    assert.deepEqual(patch?.options, [
      { key: "require_full_window", value: true },
    ]);
  });

  it("returns null rather than throwing on malformed JSON", () => {
    assert.equal(parseStoredPatch("{not json"), null);
    assert.equal(parseStoredPatch(""), null);
    assert.equal(parseStoredPatch(null), null);
    assert.equal(parseStoredPatch(undefined), null);
  });

  it("rejects a target it does not know how to apply", () => {
    assert.equal(
      parseStoredPatch(
        JSON.stringify({ target: "tags", prod: { find: "a", replace: "b" } }),
      ),
      null,
    );
  });

  /**
   * The shape that would produce an Apply button doing nothing: a target with
   * no corresponding change. Previously this reached the apply path and failed
   * later as "no change defined for this scope", after the guard had passed.
   */
  it("rejects a patch that carries no change for its target", () => {
    assert.equal(parseStoredPatch(JSON.stringify({ target: "query" })), null);
    assert.equal(parseStoredPatch(JSON.stringify({ target: "priority" })), null);
    assert.equal(
      parseStoredPatch(JSON.stringify({ target: "options", options: [] })),
      null,
    );
  });

  it("rejects an empty find, which would replace nothing", () => {
    assert.equal(
      parseStoredPatch(
        JSON.stringify({ target: "query", prod: { find: "", replace: "x" } }),
      ),
      null,
    );
  });

  /**
   * Option keys are merged into the object sent to Datadog, so a key that is
   * not a plain identifier would land under a name nobody intended — including
   * prototype-shaped keys.
   */
  it("rejects option keys that are not plain identifiers", () => {
    for (const key of ["__proto__", "constructor.x", "a b", "notify-no-data", ""]) {
      assert.equal(
        parseStoredPatch(
          JSON.stringify({ target: "options", options: [{ key, value: 1 }] }),
        ),
        null,
        `expected ${JSON.stringify(key)} to be rejected`,
      );
    }
  });

  it("rejects a non-finite priority", () => {
    // JSON has no Infinity literal, so this is how one arrives in practice.
    assert.equal(
      parseStoredPatch('{"target":"priority","priorityValue":1e999}'),
      null,
    );
  });

  it("rejects an option value that is not a scalar", () => {
    assert.equal(
      parseStoredPatch(
        JSON.stringify({
          target: "options",
          options: [{ key: "thresholds", value: { critical: 1 } }],
        }),
      ),
      null,
    );
  });

  it("rejects a JSON array or scalar at the top level", () => {
    assert.equal(parseStoredPatch("[]"), null);
    assert.equal(parseStoredPatch('"query"'), null);
    assert.equal(parseStoredPatch("null"), null);
  });
});
