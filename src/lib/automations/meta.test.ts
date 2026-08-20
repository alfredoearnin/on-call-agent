/**
 * These cases pin the two safety properties of the re-run feature: that the
 * out-of-order warning and the double-fire guard behave at their boundaries, and
 * that a transport failure can never carry the private webhook endpoint into the
 * UI or the audit table.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "@/lib/clients/http";
import {
  HEALTH_CHECK_SETTLE_MS,
  blocksRetry,
  TRIGGER_DEBOUNCE_MS,
  isAutomationKey,
  shouldDebounceTrigger,
  staleHealthCheckWarning,
  triggerFailureMessage,
} from "@/lib/automations/meta";

const NOW = new Date("2026-08-20T18:00:00.000Z");
const agoMs = (ms: number) => new Date(NOW.getTime() - ms);
const LABEL = "Growth Engineering Health Check";

describe("staleHealthCheckWarning", () => {
  it("warns when the health check was triggered minutes ago", () => {
    const warning = staleHealthCheckWarning(agoMs(3 * 60_000), NOW);

    assert.equal(
      warning,
      "Health Check triggered 3 min ago — its Confluence page may not be updated yet.",
    );
  });

  it("floors the elapsed time to whole minutes rather than rounding up", () => {
    const warning = staleHealthCheckWarning(agoMs(3 * 60_000 + 59_000), NOW);

    assert.ok(warning?.includes("3 min ago"), warning ?? "no warning");
  });

  it("says just now for a trigger seconds old", () => {
    const warning = staleHealthCheckWarning(agoMs(20_000), NOW);

    assert.ok(warning?.includes("just now"), warning ?? "no warning");
  });

  it("falls silent once the settle window has passed", () => {
    const warning = staleHealthCheckWarning(agoMs(HEALTH_CHECK_SETTLE_MS), NOW);

    assert.equal(warning, null);
  });

  it("falls silent when the health check has never been triggered from here", () => {
    assert.equal(staleHealthCheckWarning(null, NOW), null);
  });

  it("falls silent on a trigger stamped in the future", () => {
    const warning = staleHealthCheckWarning(agoMs(-60_000), NOW);

    assert.equal(warning, null);
  });
});

describe("shouldDebounceTrigger", () => {
  it("debounces a second click inside the window", () => {
    assert.equal(shouldDebounceTrigger(agoMs(5_000), NOW), true);
  });

  it("allows a retrigger once the window has passed", () => {
    assert.equal(shouldDebounceTrigger(agoMs(TRIGGER_DEBOUNCE_MS), NOW), false);
  });

  it("allows the first ever trigger", () => {
    assert.equal(shouldDebounceTrigger(null, NOW), false);
  });
});

describe("blocksRetry", () => {
  it("blocks a retry after a run was successfully started", () => {
    assert.equal(blocksRetry({ status: "triggered", httpStatus: null }), true);
  });

  // A timeout is the dangerous case: Cursor never answered, so the request may
  // well have landed and started a run. Retrying at once could double-fire.
  it("blocks a retry after a timeout, which may have started a run anyway", () => {
    assert.equal(blocksRetry({ status: "failed", httpStatus: null }), true);
  });

  it("allows an immediate retry when cursor answered with a rejection", () => {
    assert.equal(blocksRetry({ status: "failed", httpStatus: 401 }), false);
    assert.equal(blocksRetry({ status: "failed", httpStatus: 503 }), false);
  });

  it("allows a retry after an attempt that was never sent", () => {
    assert.equal(blocksRetry({ status: "blocked", httpStatus: null }), false);
  });
});

describe("isAutomationKey", () => {
  it("accepts the two known automation keys", () => {
    assert.equal(isAutomationKey("health_check"), true);
    assert.equal(isAutomationKey("dashboard_refresh"), true);
  });

  it("rejects an unknown key", () => {
    assert.equal(isAutomationKey("delete_everything"), false);
  });

  it("rejects a non-string", () => {
    assert.equal(isAutomationKey(undefined), false);
    assert.equal(isAutomationKey({ key: "health_check" }), false);
  });
});

describe("triggerFailureMessage", () => {
  it("points at the auth header setting when cursor returns 401", () => {
    const msg = triggerFailureMessage(anyHttpError(401), LABEL);

    assert.ok(msg.includes("CURSOR_WEBHOOK_AUTH_HEADER"), msg);
  });

  it("points at the webhook url setting when cursor returns 404", () => {
    const msg = triggerFailureMessage(anyHttpError(404), LABEL);

    assert.ok(msg.includes("Re-copy the URL"), msg);
  });

  it("asks the operator to wait when cursor rate-limits the trigger", () => {
    const msg = triggerFailureMessage(anyHttpError(429), LABEL);

    assert.ok(msg.includes("rate-limiting"), msg);
  });

  it("tells the operator the run may have started when the request timed out", () => {
    const msg = triggerFailureMessage(anyAbortError(), LABEL);

    assert.ok(msg.includes("may have started anyway"), msg);
  });

  it("falls back to a generic message for an unrecognized error", () => {
    const msg = triggerFailureMessage(new Error("socket hang up"), LABEL);

    assert.equal(msg, `Could not reach Cursor to trigger ${LABEL}.`);
    assert.ok(!msg.includes("socket hang up"), msg);
  });

  // The regression test that earns its keep: HttpError.message is
  // `HTTP <status> for <url>`, so any lapse back to err.message publishes the
  // private endpoint to the browser and into a never-deleted audit row.
  it("never repeats the webhook url or the response body", () => {
    for (const status of [401, 403, 404, 418, 429, 500, 503]) {
      const msg = triggerFailureMessage(anyHttpError(status), LABEL);

      assert.ok(!msg.includes("webhook.invalid"), `${status}: leaked the host`);
      assert.ok(!msg.includes("PLACEHOLDER"), `${status}: leaked the token`);
      assert.ok(!msg.includes("invalid api key"), `${status}: leaked the body`);
    }
  });
});

// Reserved .invalid TLD and obvious placeholders — nothing resembling a real
// credential, so a leak in either direction is unmistakable.
const anyHttpError = (status: number) =>
  new HttpError(
    status,
    "https://webhook.invalid/automations/PLACEHOLDER/trigger?token=PLACEHOLDER",
    '{"error":"invalid api key"}',
  );

function anyAbortError(): Error {
  const err = new Error("This operation was aborted");
  err.name = "AbortError";
  return err;
}
