import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterMonitors, searchTerms } from "./monitor-search";

const ROWS = [
  {
    id: "243692163",
    name: "Service svc-notification-preferences has a high p90 latency on env:prod",
    service: "svc-notification-preferences",
  },
  {
    id: "143509449",
    name: "Less than 10 Funnel Cashouts Were Expired in past hour",
    service: "job-cashout-user-cashout-status-processor",
  },
  {
    id: "135119948",
    name: "[job-user-setup-user-first-mile-calc-processor] HPA has sustained high utilization",
    service: null,
  },
];

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("searchTerms", () => {
  it("is empty for nothing typed", () => {
    assert.deepEqual(searchTerms(undefined), []);
    assert.deepEqual(searchTerms("   "), []);
  });

  it("lowercases and splits on any run of whitespace", () => {
    assert.deepEqual(searchTerms("  SVC   p90 "), ["svc", "p90"]);
  });
});

describe("filterMonitors", () => {
  it("returns everything when nothing was typed", () => {
    assert.equal(filterMonitors(ROWS, "").length, 3);
    assert.equal(filterMonitors(ROWS, undefined).length, 3);
  });

  it("finds a monitor by part of its id", () => {
    assert.deepEqual(ids(filterMonitors(ROWS, "2436")), ["243692163"]);
  });

  it("finds a monitor by part of its name, whatever the case", () => {
    assert.deepEqual(ids(filterMonitors(ROWS, "FUNNEL")), ["143509449"]);
  });

  it("finds a monitor by its service", () => {
    assert.deepEqual(
      ids(filterMonitors(ROWS, "cashout-status-processor")),
      ["143509449"],
    );
  });

  /**
   * The case a single substring gets wrong: the two words are ten characters
   * apart in the real name, and a hyphen sits where the space was typed.
   */
  it("requires every term, in any order and any position", () => {
    assert.deepEqual(ids(filterMonitors(ROWS, "notification p90")), [
      "243692163",
    ]);
    assert.deepEqual(ids(filterMonitors(ROWS, "p90 notification")), [
      "243692163",
    ]);
    assert.deepEqual(filterMonitors(ROWS, "notification cashout"), []);
  });

  it("matches nothing rather than everything for an unknown term", () => {
    assert.deepEqual(filterMonitors(ROWS, "zzzz"), []);
  });

  it("tolerates a monitor with no service", () => {
    assert.deepEqual(ids(filterMonitors(ROWS, "HPA")), ["135119948"]);
  });

  it("keeps the order it was given and does not mutate it", () => {
    const rows = [...ROWS];
    const out = filterMonitors(rows, "a");

    assert.deepEqual(ids(rows), ids(ROWS));
    assert.deepEqual(
      ids(out),
      ids(ROWS).filter((id) => ids(out).includes(id)),
    );
  });
});
