import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OwnershipAction } from "@/lib/constants";
import {
  DROP_REASON_LABELS,
  GROWTH_TEAM_SERVICES,
  actionsFor,
  isActionAllowed,
  serviceByName,
  domainLabel,
  dropList,
  dropReasonFor,
  datadogMonitorSearchUrl,
  datadogServiceUrl,
  groupServicesByDomain,
  isGrowthOwnedInCortex,
  onCallScope,
  servicesByVerdict,
  summarizeOwnership,
  verdictFor,
  type SheetIntent,
  type TeamService,
} from "@/lib/team-services";

/**
 * These tests deliberately do NOT assert which team owns which service.
 *
 * The previous suite pinned ownership claims — including `svc-mark-tech` being
 * "under review", which Cortex contradicts — so correcting the data meant
 * fighting the tests. Ownership is external, moving truth; it belongs in the
 * data, verified against Cortex. What is asserted here is structure and the
 * derivation rules, which are ours to guarantee.
 */

function makeService(overrides: Partial<TeamService> = {}): TeamService {
  return {
    name: "svc-example",
    domain: "referrals",
    sheetIntent: "keep",
    cortexOwners: ["L2-PENG-Growth"],
    ...overrides,
  };
}

describe("verdictFor", () => {
  it("corroborates when the sheet keeps it and Cortex names Growth", () => {
    assert.equal(verdictFor(makeService()), "corroborated");
    assert.equal(
      verdictFor(makeService({ cortexOwners: ["L3-PENG-Growth"] })),
      "corroborated",
    );
  });

  it("corroborates co-owned services as long as Growth is one of the owners", () => {
    const svc = makeService({
      cortexOwners: ["L3-PENG-Discovery", "L2-PENG-Growth"],
    });
    assert.equal(verdictFor(svc), "corroborated");
  });

  it("disputes when the sheet keeps it but Cortex names only other teams", () => {
    const svc = makeService({ cortexOwners: ["L3-PENG-Discovery"] });
    assert.equal(verdictFor(svc), "disputed");
  });

  it("does not support entries the team already agreed to hand off", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: ["L3-PENG-Activation"],
    });
    assert.equal(verdictFor(svc), "unsupported");
  });

  it("does not support a hand-off even when Cortex still tags it to Growth", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: ["L2-PENG-Growth"],
    });
    assert.equal(
      verdictFor(svc),
      "unsupported",
      "the team's own decision to hand it off outranks a stale tag",
    );
  });

  it("does not support deprecated entries", () => {
    const svc = makeService({
      sheetIntent: "deprecate",
      cortexOwners: ["L3-PENG-Activation"],
    });
    assert.equal(verdictFor(svc), "unsupported");
  });

  it("does not support tags absent from Cortex, whatever the sheet says", () => {
    for (const intent of ["keep", "hand-off", "not-listed"] as SheetIntent[]) {
      const svc = makeService({ sheetIntent: intent, cortexOwners: [] });
      assert.equal(verdictFor(svc), "unsupported", `intent=${intent}`);
    }
  });

  it("does not support entries no source claims for Growth", () => {
    const svc = makeService({
      sheetIntent: "not-listed",
      cortexOwners: ["L3-FIP-EventDeliveryExp"],
    });
    assert.equal(verdictFor(svc), "unsupported");
  });
});

describe("dropReasonFor", () => {
  it("returns undefined for anything still in scope", () => {
    assert.equal(dropReasonFor(makeService()), undefined);
    assert.equal(
      dropReasonFor(makeService({ cortexOwners: ["L3-PENG-Discovery"] })),
      undefined,
    );
  });

  it("ranks a missing Cortex tag above the sheet's intent", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: [],
    });
    assert.equal(dropReasonFor(svc), "unknown-tag");
  });

  it("distinguishes deprecation from a hand-off", () => {
    assert.equal(
      dropReasonFor(
        makeService({ sheetIntent: "deprecate", cortexOwners: ["L3-PENG-Activation"] }),
      ),
      "deprecated",
    );
    assert.equal(
      dropReasonFor(
        makeService({
          sheetIntent: "hand-off",
          handoffTarget: "Cashout",
          cortexOwners: ["L3-PENG-Activation"],
        }),
      ),
      "handed-off",
    );
  });

  it("labels every reason it can return", () => {
    for (const svc of dropList()) {
      const reason = dropReasonFor(svc);
      assert.ok(reason, `${svc.name} is unsupported but has no reason`);
      assert.ok(DROP_REASON_LABELS[reason], `no label for ${reason}`);
    }
  });

  /**
   * The inventory column is `Hand Over? (Y/N)` — an intent. Wording that reads as
   * a completed transfer invites someone to stop answering a page that still
   * routes to Growth, which is the opposite of what the sheet supports.
   */
  it("does not word the hand-off label as a finished transfer", () => {
    assert.doesNotMatch(DROP_REASON_LABELS["handed-off"], /already|was handed/i);
  });
});

describe("GROWTH_TEAM_SERVICES", () => {
  it("has unique service tags", () => {
    const names = GROWTH_TEAM_SERVICES.map((s) => s.name);
    assert.equal(names.length, new Set(names).size);
  });

  it("gives every entry a labelled domain", () => {
    for (const svc of GROWTH_TEAM_SERVICES) {
      assert.ok(svc.name.length > 0);
      assert.ok(domainLabel(svc.domain), `unlabelled domain on ${svc.name}`);
    }
  });

  it("names a target for every hand-off", () => {
    for (const svc of GROWTH_TEAM_SERVICES) {
      if (svc.sheetIntent !== "hand-off") continue;
      assert.ok(
        svc.handoffTarget,
        `${svc.name} is marked for hand-off but names no receiving team`,
      );
    }
  });

  it("never claims Growth ownership without a Cortex tag to back it", () => {
    for (const svc of servicesByVerdict("corroborated")) {
      assert.ok(
        isGrowthOwnedInCortex(svc),
        `${svc.name} is confirmed but no Cortex owner tag says Growth`,
      );
    }
  });

  it("explains every disputed and dropped entry", () => {
    for (const svc of GROWTH_TEAM_SERVICES) {
      if (verdictFor(svc) === "corroborated") continue;
      const explained = Boolean(svc.note) || svc.cortexOwners.length > 0;
      assert.ok(explained, `${svc.name} carries no evidence for its verdict`);
    }
  });

  it("keeps dropped entries in the catalog so the finding stays visible", () => {
    assert.ok(
      dropList().length > 0,
      "dropped services should be retained with their reason, not deleted",
    );
  });
});

describe("onCallScope and dropList", () => {
  it("partition the catalog with no overlap", () => {
    const scope = onCallScope();
    const dropped = dropList();
    assert.equal(scope.length + dropped.length, GROWTH_TEAM_SERVICES.length);

    const scopeNames = new Set(scope.map((s) => s.name));
    for (const svc of dropped) {
      assert.ok(!scopeNames.has(svc.name), `${svc.name} is in both lists`);
    }
  });

  it("excludes everything unsupported from the scope", () => {
    for (const svc of onCallScope()) {
      assert.notEqual(verdictFor(svc), "unsupported");
    }
  });
});

describe("summarizeOwnership", () => {
  it("accounts for every entry exactly once", () => {
    const s = summarizeOwnership();
    assert.equal(s.total, GROWTH_TEAM_SERVICES.length);
    assert.equal(s.corroborated + s.disputed + s.unsupported, s.total);
  });

  it("lists the teams a dispute is with, excluding Growth itself", () => {
    const s = summarizeOwnership();
    assert.ok(s.counterparties.length > 0);
    for (const tag of s.counterparties) {
      assert.ok(
        !tag.endsWith("-Growth"),
        `${tag} is Growth and cannot be a counterparty`,
      );
    }
  });

  it("works on a subset", () => {
    const s = summarizeOwnership([
      makeService({ name: "a" }),
      makeService({ name: "b", cortexOwners: ["L3-PENG-Discovery"] }),
      makeService({ name: "c", sheetIntent: "deprecate" }),
    ]);
    assert.deepEqual(
      { total: s.total, corroborated: s.corroborated, disputed: s.disputed, unsupported: s.unsupported },
      { total: 3, corroborated: 1, disputed: 1, unsupported: 1 },
    );
    assert.deepEqual(s.counterparties, ["L3-PENG-Discovery"]);
  });
});

describe("groupServicesByDomain", () => {
  it("groups without dropping or duplicating entries", () => {
    const groups = groupServicesByDomain(GROWTH_TEAM_SERVICES);
    const grouped = groups.flatMap((g) => g.services);
    assert.equal(grouped.length, GROWTH_TEAM_SERVICES.length);
    for (const g of groups) {
      assert.ok(g.services.length > 0, `${g.domain} rendered empty`);
      assert.ok(g.label.length > 0);
      assert.ok(g.services.every((s) => s.domain === g.domain));
    }
  });

  it("sorts services by tag within a domain", () => {
    for (const g of groupServicesByDomain(GROWTH_TEAM_SERVICES)) {
      const names = g.services.map((s) => s.name);
      assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
    }
  });
});

describe("actionsFor", () => {
  it("offers nothing when all three sources already agree", () => {
    assert.deepEqual(actionsFor(makeService()), []);
  });

  it("offers a hand-off naming the team the inventory chose", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: ["L3-PENG-Activation"],
    });
    const actions = actionsFor(svc);
    const handoff = actions.find((a) => a.action === OwnershipAction.HandOff);
    assert.ok(handoff);
    assert.equal(handoff.targetTeam, "Cashout");
    assert.match(handoff.label, /Cashout/);
  });

  it("offers deletion for a deprecated service, not a hand-off", () => {
    const actions = actionsFor(
      makeService({ sheetIntent: "deprecate", cortexOwners: ["L3-PENG-Activation"] }),
    );
    assert.ok(actions.some((a) => a.action === OwnershipAction.Delete));
    assert.ok(!actions.some((a) => a.action === OwnershipAction.HandOff));
  });

  it("offers a tag fix before any ownership question when the tag is missing", () => {
    const actions = actionsFor(makeService({ cortexOwners: [] }));
    assert.deepEqual(
      actions.map((a) => a.action),
      [OwnershipAction.FixTag, OwnershipAction.Keep],
    );
  });

  it("offers one concede per team Cortex records on a dispute", () => {
    const svc = makeService({
      cortexOwners: ["L3-PENG-ClientPlatform", "L3-PENG-CoreUXBackend"],
    });
    const concedes = actionsFor(svc).filter(
      (a) => a.action === OwnershipAction.Concede,
    );
    assert.deepEqual(
      concedes.map((a) => a.targetTeam),
      ["L3-PENG-ClientPlatform", "L3-PENG-CoreUXBackend"],
    );
    assert.ok(
      actionsFor(svc).some((a) => a.action === OwnershipAction.Claim),
      "claiming it must stay available",
    );
  });

  it("always lets a finding be rejected", () => {
    for (const svc of GROWTH_TEAM_SERVICES) {
      if (verdictFor(svc) === "corroborated") continue;
      assert.ok(
        actionsFor(svc).some((a) => a.action === OwnershipAction.Keep),
        `${svc.name} offers no way to reject its finding`,
      );
    }
  });

  it("explains every action it offers", () => {
    for (const svc of GROWTH_TEAM_SERVICES) {
      for (const a of actionsFor(svc)) {
        assert.ok(a.label.length > 0, `${svc.name}: unlabelled action`);
        assert.ok(a.rationale.length > 0, `${svc.name}: ${a.action} has no rationale`);
      }
    }
  });

  it("names a target on exactly the actions that transfer ownership", () => {
    const transfers: string[] = [OwnershipAction.HandOff, OwnershipAction.Concede];
    for (const svc of GROWTH_TEAM_SERVICES) {
      for (const a of actionsFor(svc)) {
        if (transfers.includes(a.action)) {
          assert.ok(a.targetTeam, `${svc.name}: ${a.action} names no receiving team`);
        } else {
          assert.equal(
            a.targetTeam,
            undefined,
            `${svc.name}: ${a.action} should not name a team`,
          );
        }
      }
    }
  });
});

describe("isActionAllowed", () => {
  it("accepts an offered action with its own target", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: ["L3-PENG-Activation"],
    });
    assert.ok(isActionAllowed(svc, OwnershipAction.HandOff, "Cashout"));
    assert.ok(isActionAllowed(svc, OwnershipAction.Keep));
  });

  it("rejects an action the evidence does not support", () => {
    // Nothing to decide on a corroborated service.
    assert.ok(!isActionAllowed(makeService(), OwnershipAction.Concede, "L3-PENG-Discovery"));
    // Deleting is only for a deprecated entry.
    assert.ok(
      !isActionAllowed(
        makeService({ cortexOwners: ["L3-PENG-Discovery"] }),
        OwnershipAction.Delete,
      ),
    );
  });

  it("rejects a target the finding never named", () => {
    const svc = makeService({
      sheetIntent: "hand-off",
      handoffTarget: "Cashout",
      cortexOwners: ["L3-PENG-Activation"],
    });
    assert.ok(!isActionAllowed(svc, OwnershipAction.HandOff, "Payments"));
    assert.ok(
      !isActionAllowed(svc, OwnershipAction.HandOff),
      "a transfer with no target must not pass",
    );
  });

  it("rejects a concede aimed at a team Cortex does not record", () => {
    const svc = makeService({ cortexOwners: ["L3-PENG-Discovery"] });
    assert.ok(isActionAllowed(svc, OwnershipAction.Concede, "L3-PENG-Discovery"));
    assert.ok(!isActionAllowed(svc, OwnershipAction.Concede, "L3-PENG-Activation"));
  });
});

describe("serviceByName", () => {
  it("finds a catalog entry and rejects anything else", () => {
    assert.equal(serviceByName("svc-referral")?.name, "svc-referral");
    assert.equal(serviceByName("svc-does-not-exist"), undefined);
    assert.equal(serviceByName(""), undefined);
  });
});

describe("Datadog links", () => {
  it("builds an APM entity link", () => {
    const url = datadogServiceUrl("svc-referral");
    assert.ok(url.includes("svc-referral"));
    assert.ok(url.includes("datadoghq.com/apm/entity"));
  });

  it("builds a monitor search scoped to the service", () => {
    const url = datadogMonitorSearchUrl("svc-referral");
    assert.ok(url.includes("/monitors/manage"));
    assert.ok(url.includes("service%3Asvc-referral"));
  });

  it("honours a non-default Datadog site", () => {
    assert.ok(datadogServiceUrl("svc-referral", "datadoghq.eu").includes("datadoghq.eu"));
    assert.ok(
      datadogMonitorSearchUrl("svc-referral", "datadoghq.eu").includes("datadoghq.eu"),
    );
  });
});
