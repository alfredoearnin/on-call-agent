# `on-call.md` — moved

**This file is no longer the prompt.** It is kept as a pointer because it is
referenced from the README and from ~40 code comments (`// mirrors on-call.md`).

The canonical Health Check prompt is:

> [`agents/Growth Team Ops Review Weekly Handof.md`](./agents/Growth%20Team%20Ops%20Review%20Weekly%20Handof.md)

`agents/` holds the prompt text **as it is actually pasted into the Cursor
Automation**, so it is what runs. Edit that file — editing this one changes nothing.

## Why this changed

There used to be two copies: this one as the "versioned reference" and the real text
living only inside Cursor. They drifted, silently. The
"Rotation line — fixed wording" instruction was dropped from the running prompt
somewhere between the 2026-07-28 and 2026-08-11 handoff pages; the Overview's on-call
names broke; and the fix (PR #30) made `parseOnCall` tolerant of the new phrasing
rather than restoring the instruction. Nothing had noticed, because the spec lived in
the copy that never ran.

`src/lib/ingest/sources/prompt-contract.test.ts` now guards the wordings the
dashboard's parsers depend on, so the same drift fails a test instead of blanking a
field weeks later.
