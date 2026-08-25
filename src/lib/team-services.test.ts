import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GROWTH_TEAM_SERVICES,
  groupServicesByDomain,
  summarizeOwnership,
  datadogServiceUrl,
} from "@/lib/team-services";

describe("GROWTH_TEAM_SERVICES", () => {
  it("includes confirmed Growth products from Cortex triage", () => {
    const names = new Set(GROWTH_TEAM_SERVICES.map((s) => s.name));
    for (const expected of [
      "svc-referral",
      "svc-conversational-onboarding",
      "svc-notification-preferences",
      "svc-growth-ai-ops",
      "usl-prime-frontend",
    ]) {
      assert.ok(names.has(expected), `missing ${expected}`);
    }
  });

  it("flags svc-mark-tech for ownership review", () => {
    const markTech = GROWTH_TEAM_SERVICES.find((s) => s.name === "svc-mark-tech");
    assert.ok(markTech);
    assert.equal(markTech.ownership, "review");
    assert.ok(markTech.reviewNote);
  });

  it("has unique service names", () => {
    const names = GROWTH_TEAM_SERVICES.map((s) => s.name);
    assert.equal(names.length, new Set(names).size);
  });
});

describe("groupServicesByDomain", () => {
  it("groups and sorts services by domain", () => {
    const groups = groupServicesByDomain(GROWTH_TEAM_SERVICES);
    assert.ok(groups.length > 0);
    for (const g of groups) {
      assert.ok(g.services.length > 0);
      assert.equal(g.label.length > 0, true);
    }
    const referralGroup = groups.find((g) => g.domain === "referrals");
    assert.ok(referralGroup);
    assert.ok(
      referralGroup.services.every((s) => s.domain === "referrals"),
    );
  });
});

describe("summarizeOwnership", () => {
  it("counts confirmed vs review", () => {
    const s = summarizeOwnership(GROWTH_TEAM_SERVICES);
    assert.equal(s.total, s.confirmed + s.review);
    assert.ok(s.confirmed > s.review, "most services should be confirmed");
  });
});

describe("datadogServiceUrl", () => {
  it("builds an APM entity link", () => {
    const url = datadogServiceUrl("svc-referral");
    assert.ok(url.includes("svc-referral"));
    assert.ok(url.includes("datadoghq.com/apm/entity"));
  });
});
