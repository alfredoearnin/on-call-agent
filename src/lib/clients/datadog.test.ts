import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMonitorAuditActors } from "./datadog";

describe("parseMonitorAuditActors", () => {
  it("keeps the newest actor per monitor and ignores email", () => {
    const map = parseMonitorAuditActors([
      {
        attributes: {
          timestamp: "2026-08-31T22:00:00Z",
          attributes: {
            usr: { name: "Alfred", email: "alfred@example.com" },
            asset: { type: "monitor", id: "135119948" },
          },
        },
      },
      {
        attributes: {
          timestamp: "2026-08-31T21:00:00Z",
          attributes: {
            usr: { name: "Earlier" },
            asset: { type: "monitor", id: 135119948 },
          },
        },
      },
    ]);
    const actor = map.get("135119948");
    assert.equal(actor?.name, "Alfred");
    assert.equal(actor?.at.toISOString(), "2026-08-31T22:00:00.000Z");
  });

  it("drops an actor whose only identifier is a handle or uuid", () => {
    const map = parseMonitorAuditActors([
      {
        attributes: {
          timestamp: "2026-08-31T22:00:00Z",
          attributes: {
            usr: {
              handle: "alfred@example.com",
              uuid: "8f14e45f-ea8f-4b2a-9f1a-0a1b2c3d4e5f",
            },
            asset: { type: "monitor", id: "135119948" },
          },
        },
      },
    ]);
    assert.equal(map.get("135119948"), undefined);
  });
});
