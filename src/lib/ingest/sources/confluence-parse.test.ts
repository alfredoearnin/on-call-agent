import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseOnCall, parseWindow } from "@/lib/ingest/sources/confluence-parse";

const TZ = "America/Los_Angeles";
const asDate = (d?: Date) => d?.toISOString().slice(0, 10);

describe("parseWindow", () => {
  it("reads the header window, not the next week's page cited in the banner", () => {
    const window = parseWindow(
      "🔒 **Frozen — final state at week close (2026-08-18).** This on-call week has " +
        "ended; see the next week's page (2026-08-18 → 2026-08-25).\n\n" +
        "**08/18/2026 Growth Team Ops Review** · On-call week " +
        "**2026-08-11 → 2026-08-18** (Tuesday → Tuesday).",
      TZ,
    );

    assert.equal(asDate(window?.start), "2026-08-11");
    assert.equal(asDate(window?.end), "2026-08-18");
  });
});

/**
 * The rotation line is free prose written by an agent, so its wording drifts
 * between runs. These cases pin the forms that have actually been published —
 * a silent parse failure blanks the on-call names on the Overview.
 */
describe("parseOnCall", () => {
  it("reads the canonical `primary: X; secondary: Y` form", () => {
    const schedule = parseOnCall(
      "_This on-call week — primary: **Ada Lovelace**; secondary: **Grace Hopper** " +
        "(shift Tue 2026-07-28 10:00 PT; verified live via_ `schedule_show`_)._",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
    assert.equal(schedule?.unverified, false);
  });

  it("reads the hedged `Primary X, Secondary Y` form used when incident.io is down", () => {
    const schedule = parseOnCall(
      "On-call: the handoff occurred Tue Aug 11 10:00 PT; the new primary/secondary " +
        "could not be verified (incident.io connector down, ~12 days). " +
        "Last verified (Aug 4): Primary **Ada Lovelace**, Secondary **Grace Hopper**.",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.secondary, "Grace Hopper");
    assert.equal(schedule?.unverified, true);
    assert.equal(schedule?.verifiedAsOf, "Aug 4");
  });

  it("keeps dotted usernames intact", () => {
    const schedule = parseOnCall(
      "primary: **ada.lovelace**; secondary: **grace.hopper** (shift Tue 2026-07-28).",
    );

    assert.equal(schedule?.primary, "ada.lovelace");
    assert.equal(schedule?.secondary, "grace.hopper");
  });

  it("separates the closing week from the incoming one in a single paragraph", () => {
    const schedule = parseOnCall(
      "On-call (closing week): Primary **Ada Lovelace** — confirmed from incident.io " +
        "escalation acks this week (every spot-checked page was acked by Ada). " +
        "The handoff occurred Tue Aug 18 10:00 PT; the new week's primary is " +
        "**Grace Hopper**, secondary **Alan Turing** (next primary Alan, Aug 25).",
    );

    assert.equal(schedule?.primary, "Ada Lovelace");
    assert.equal(schedule?.nextPrimary, "Grace Hopper");
    assert.equal(schedule?.nextSecondary, "Alan Turing");
    assert.equal(schedule?.unverified, false);
  });

  it("does not mistake prose that merely mentions a role for a name", () => {
    const schedule = parseOnCall(
      "Every page was **human-acknowledged by Ada (primary on-call)** within ~20-55s.",
    );

    assert.equal(schedule, undefined);
  });

  it("reads the next handoff with the role before the name", () => {
    const schedule = parseOnCall(
      "Next handoff Tue 2026-07-14 10:00 PT → primary **Ada Lovelace**, " +
        "secondary **grace.hopper**. Verified via incident.io this run.",
    );

    assert.equal(schedule?.nextPrimary, "Ada Lovelace");
    assert.equal(schedule?.nextSecondary, "grace.hopper");
  });

  it("reads the next handoff with the name before the role", () => {
    const schedule = parseOnCall(
      "Next handoff Tue 2026-07-28: **Ada Lovelace** primary, **Grace Hopper** secondary._",
    );

    assert.equal(schedule?.nextPrimary, "Ada Lovelace");
    assert.equal(schedule?.nextSecondary, "Grace Hopper");
  });

  it("does not flag a live-verified page as unverified", () => {
    const schedule = parseOnCall(
      "primary: **Ada Lovelace**; secondary: **Grace Hopper** " +
        "(shift Tue 2026-06-30 10:00 PT). Verified via incident.io schedule this run.",
    );

    assert.equal(schedule?.unverified, false);
    assert.equal(schedule?.verifiedAsOf, undefined);
  });

  it("stays fast on input built to trigger regex backtracking", () => {
    const started = Date.now();

    parseOnCall(`primary${" ".repeat(5_000)}X`);
    parseOnCall(`Next handoff ${"x primary ".repeat(4_000)}`);
    parseOnCall(`primary ${"**".repeat(8_000)}`);
    parseOnCall(`Next handoff ${"**a** primary, **b** secondary ".repeat(2_000)}`);

    assert.ok(
      Date.now() - started < 1_000,
      `parseOnCall took ${Date.now() - started}ms on adversarial input`,
    );
  });

  it("returns undefined when the page has no rotation line", () => {
    assert.equal(parseOnCall("# Weekly Handoff\n\nNo schedule section here."), undefined);
  });

  it("names a primary for every published handoff", () => {
    const dir = join(process.cwd(), "data", "confluence");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "no handoff pages found to check");

    for (const file of files) {
      const schedule = parseOnCall(readFileSync(join(dir, file), "utf8"));
      assert.ok(schedule?.primary, `${file}: no primary parsed`);
    }
  });
});
