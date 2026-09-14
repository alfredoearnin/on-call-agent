import * as z from "zod/v4";
import type { ProposedPatch } from "./types";

/**
 * Validating a stored patch before anything acts on it.
 *
 * `patchJson` is a text column, and the apply path turns it into a credentialed
 * PUT against a production Datadog monitor. Its writers now include a language
 * model, so at that distance it is untrusted input regardless of how it got
 * there. The three existing consumers parse it with a bare cast, and one of
 * them throws outright on malformed JSON — a stored value that is merely wrong
 * rather than unparseable would flow straight through.
 *
 * Validating on read as well as on write means a bad patch produces "no
 * applyable change" instead of a request built from whatever the column held.
 */

const BranchSchema = z.object({
  find: z.string().min(1),
  replace: z.string(),
});

export const ProposedPatchSchema = z
  .object({
    target: z.enum(["message", "query", "priority", "options"]),
    prod: BranchSchema.optional(),
    dev: BranchSchema.optional(),
    priorityValue: z.number().finite().optional(),
    options: z
      .array(
        z.object({
          key: z
            .string()
            .min(1)
            // An option key is a plain identifier. Anything else would be
            // merged into the object sent to Datadog under a name nobody
            // intended.
            .regex(/^[a-z][a-z0-9_]*$/i, "option key must be an identifier"),
          value: z.union([z.boolean(), z.number().finite(), z.string()]),
        }),
      )
      .min(1)
      .optional(),
  })
  .refine(
    (p) =>
      p.target === "priority"
        ? p.priorityValue != null
        : p.target === "options"
          ? (p.options?.length ?? 0) > 0
          : Boolean(p.prod ?? p.dev),
    { message: "patch carries no change for its target" },
  );

/**
 * Parse a stored patch, or null when it cannot be trusted.
 *
 * Never throws: every caller is deciding whether to offer an Apply button, and
 * an exception there would surface as a 500 with no indication of whether
 * anything was written.
 */
export function parseStoredPatch(
  raw: string | null | undefined,
): ProposedPatch | null {
  if (!raw) return null;
  try {
    const parsed = ProposedPatchSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as ProposedPatch) : null;
  } catch {
    return null;
  }
}
