import type { ProposedPatch } from "./types";
import { hashFieldValue, stableJson } from "@/lib/monitor-config";

/**
 * Whether a stored patch can still be applied to the monitor it was written for.
 *
 * A patch is a find/replace computed against one reading of the config, and the
 * config moves underneath it — someone applies it, someone edits the monitor in
 * Datadog, a later analysis reads something different. The apply path used to
 * ask only "does the text change?", which catches a patch that no longer
 * matches but waves through the opposite and worse case: a patch whose `find`
 * still matches *because its own replacement contains it*.
 *
 * That is not hypothetical. `@webhook-incidentio-high` ->
 * `{{#is_alert}}@webhook-incidentio-high{{/is_alert}}` matches the handle again
 * after it has been wrapped, and produces
 * `{{#is_alert}}{{#is_alert}}@webhook-incidentio-high{{/is_alert}}{{/is_alert}}`.
 * The text changes, so the old guard approved it, and the result would have gone
 * to a production monitor's routing.
 *
 * Two independent checks, because they fail in different directions:
 *   - `already_applied` — the field already contains the outcome. Works on any
 *     stored patch, including ones written before baselines existed, which is
 *     what makes it the guard that covers the rows already in the database.
 *   - `stale` — the field is no longer the one the patch was derived from, so
 *     what the patch would do is unknown rather than merely redundant. Needs a
 *     baseline, so it only protects patches written since.
 */

export type PatchState =
  | { kind: "no_patch" }
  | { kind: "appliable" }
  | { kind: "already_applied"; message: string }
  | { kind: "stale"; message: string };

/** The monitor columns a patch can read, as they are stored. */
export interface PatchTargetFields {
  query?: string | null;
  message?: string | null;
  priority?: string | null;
  /** `Monitor.options`, JSON text. */
  options?: string | null;
}

/**
 * The current value of the field a patch targets, in the form the baseline
 * hashes. `options` is normalised first so key order cannot flip the hash.
 */
export function currentFieldValue(
  target: ProposedPatch["target"],
  fields: PatchTargetFields,
): string {
  switch (target) {
    case "query":
      return fields.query ?? "";
    case "message":
      return fields.message ?? "";
    case "priority":
      return fields.priority ?? "";
    case "options": {
      if (!fields.options) return "";
      try {
        return stableJson(JSON.parse(fields.options));
      } catch {
        return fields.options;
      }
    }
  }
}

/** The fingerprint a patch should carry for the config it was derived from. */
export function baselineFor(
  target: ProposedPatch["target"],
  fields: PatchTargetFields,
): { field: ProposedPatch["target"]; hash: string } {
  return { field: target, hash: hashFieldValue(currentFieldValue(target, fields)) };
}

function optionsAlreadyHold(
  patch: ProposedPatch,
  fields: PatchTargetFields,
): boolean {
  const sets = patch.options ?? [];
  if (sets.length === 0 || !fields.options) return false;
  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(fields.options);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    parsed = raw as Record<string, unknown>;
  } catch {
    return false;
  }
  return sets.every((s) => parsed[s.key] === s.value);
}

/**
 * Whether the outcome of a find/replace is already present.
 *
 * An empty `replace` is a deletion, and `includes("")` is true of every string,
 * so that branch asks the inverse question — is the text it removes already
 * gone.
 */
function transformAlreadyApplied(
  current: string,
  branch: { find: string; replace: string },
): boolean {
  if (branch.replace === "") return !current.includes(branch.find);
  return current.includes(branch.replace);
}

/**
 * Classify a patch against the monitor's current config.
 *
 * Deliberately conservative: a `replace` value that happens to appear elsewhere
 * in the field reads as already applied and the change is withheld. That costs
 * a re-run of the analysis, where the opposite error costs a corrupted monitor.
 */
export function patchState(
  patch: ProposedPatch | null,
  fields: PatchTargetFields,
): PatchState {
  if (!patch) return { kind: "no_patch" };

  const current = currentFieldValue(patch.target, fields);

  if (patch.target === "priority") {
    if (patch.priorityValue != null && current === String(patch.priorityValue)) {
      return {
        kind: "already_applied",
        message: `The monitor priority is already ${patch.priorityValue}.`,
      };
    }
  } else if (patch.target === "options") {
    if (optionsAlreadyHold(patch, fields)) {
      return {
        kind: "already_applied",
        message: "The monitor options already carry these values.",
      };
    }
  } else {
    const branch = patch.prod ?? patch.dev;
    if (branch && transformAlreadyApplied(current, branch)) {
      return {
        kind: "already_applied",
        message: `The monitor ${patch.target} already contains this change — applying it again would duplicate it.`,
      };
    }
  }

  if (patch.baseline) {
    // A baseline for another field cannot say anything about this one; treating
    // a mismatched field name as a mismatched hash would refuse every patch.
    const sameField = patch.baseline.field === patch.target;
    if (sameField && patch.baseline.hash !== hashFieldValue(current)) {
      return {
        kind: "stale",
        message: `The monitor ${patch.target} changed after this was analysed, so this change no longer describes it. Re-run the analysis.`,
      };
    }
  }

  return { kind: "appliable" };
}
