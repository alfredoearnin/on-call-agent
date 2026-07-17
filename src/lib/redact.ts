/**
 * Customer-PII redaction, ported from on-call.md (lines 109-125).
 *
 * Direct ingestion means raw Datadog/incident.io payloads reach us, so every
 * string is scrubbed BEFORE it is persisted or rendered. We redact regulated
 * customer data (SSN, bank/routing/card, email, phone, and labeled
 * customer/user/device IDs) while KEEPING infra identifiers: monitor IDs, ULID
 * alert IDs, service/job/cluster names, env scopes, and Datadog/incident.io URLs.
 *
 * Heuristic by design ("if in doubt, redact"): numeric IDs are only redacted
 * when a customer-ish key precedes them, so a bare `monitor 135119948` or a
 * ULID alert id is never touched.
 */

interface Rule {
  re: RegExp;
  replace: string | ((match: string, ...groups: string[]) => string);
}

const RULES: Rule[] = [
  // Emails (real addr shape only; incident.io/Datadog @handles have no TLD dot).
  {
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: "<email redacted>",
  },
  // US SSN.
  { re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "<ssn redacted>" },
  // Labeled bank account / routing / IBAN.
  {
    re: /\b(account|acct|routing|aba|iban)\s*[:=]\s*["']?[\w-]{4,}/gi,
    replace: (_m, key: string) => `${key}=<account redacted>`,
  },
  // Labeled customer/user/device/financial record IDs (keeps monitor IDs safe).
  {
    re: /\b((?:user|customer|member|cust|device|cashout|advance|account|profile|payer|payee|ssn|card)_?id)\s*[:=]\s*["']?[A-Za-z0-9][\w-]{2,}/gi,
    replace: (_m, key: string) => `${key}=<id redacted>`,
  },
  // Card numbers: 13-19 digits, optionally grouped by space/hyphen.
  {
    re: /\b(?:\d[ -]?){13,19}\b/g,
    replace: "<card redacted>",
  },
  // Phone numbers (US-ish).
  {
    re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replace: "<phone redacted>",
  },
];

export interface RedactionResult<T> {
  value: T;
  redacted: boolean;
}

/** Redact a single string. Returns the scrubbed value + whether anything changed. */
export function redactString(input: string): RedactionResult<string> {
  let out = input;
  let redacted = false;
  for (const { re, replace } of RULES) {
    out = out.replace(re, (...args: unknown[]) => {
      redacted = true;
      return typeof replace === "function"
        ? (replace as (m: string, ...g: string[]) => string)(
            ...(args as [string, ...string[]]),
          )
        : replace;
    });
  }
  return { value: out, redacted };
}

/** Recursively redact all string values in an object/array/JSON structure. */
export function redactDeep<T>(input: T): RedactionResult<T> {
  let redacted = false;

  const walk = (val: unknown): unknown => {
    if (typeof val === "string") {
      const r = redactString(val);
      if (r.redacted) redacted = true;
      return r.value;
    }
    if (Array.isArray(val)) return val.map(walk);
    if (val && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) out[k] = walk(v);
      return out;
    }
    return val;
  };

  const value = walk(input) as T;
  return { value, redacted };
}

/** Convenience: redact and append the on-call.md caveat marker when needed. */
export function redactLine(input: string): string {
  const { value, redacted } = redactString(input);
  return redacted
    ? `${value} (contains redacted customer identifiers)`
    : value;
}
