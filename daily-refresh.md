# `daily-refresh.md` — moved

**This file is no longer the prompt.** It is kept as a pointer because the README and
several code comments reference it by name.

The canonical daily-refresh prompt is:

> [`agents/OnCall dashboard.md`](./agents/OnCall%20dashboard.md)

`agents/` holds the prompt text **as it is actually pasted into the Cursor
Automation**, so it is what runs. Edit that file — editing this one changes nothing.

See [`on-call.md`](./on-call.md) for why the two-copy arrangement was retired, and
`src/lib/ingest/sources/prompt-contract.test.ts` for the wordings this prompt must
keep (the `Daily refresh <date>` commit subject that automation health looks for, and
the synchronous squash merge).
