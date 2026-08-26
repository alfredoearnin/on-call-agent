# On-call Ops Dashboard

A dashboard for the **Growth Team Ops Review**. It turns the team's weekly on-call
handoff into a browsable UI with **memory**, surfacing:

1. **Who is on-call** this week (primary + secondary) and the upcoming handoff.
2. **Daily / weekly incidents & alerts** — each with a **TL;DR** and an expandable
   **"What happened"** detail, viewable as a grouped list or a per-day timeline.
3. **Learned monitor-tuning recommendations** (priority / threshold / routing /
   scope changes) with cross-run history — plus a guarded **Apply** button that can
   push a change straight to Datadog.
4. **Carryover** (stale lingering alerts) and **vulnerability** counts.

The dashboard is **read-only by default**, with a single, deliberate,
human-in-the-loop write path: the **Apply suggestion** action (disabled unless you
explicitly enable it). Everything else only reads.

---

## How the data flows

The dashboard does **not** talk to Confluence, Datadog, or incident.io directly in
normal operation. The source of truth is a set of **Confluence handoff pages** that
an agent generates, and the dashboard ingests copies of those pages into a
git-committed SQLite "memory" DB.

```
agents/Growth Team Ops Review Weekly Handof.md   ← the PROMPT (pasted into Cursor)
   │  drives
   ▼
Growth Engineering Health Check   (Cursor Automation, runs daily)
   │  reads Datadog + incident.io + Jira, then WRITES ↓
   ▼
Confluence   (one "Weekly Handoff" page per on-call week + a Monitor Tuning Ledger)
   │  fetched + parsed by ↓
   ▼
On-call dashboard — daily refresh   (Cursor Automation, runs daily)
   │  writes data/confluence/*.md → `npm run ingest` → prisma/oncall.db
   │  → opens a PR → auto-merges to `main`
   ▼
git pull   →   this dashboard   (reads the SQLite memory live)
```

Two Cursor Automations do the work; see [Keeping it fresh](#keeping-it-fresh-daily).

---

## The week boundary

**An on-call week runs handoff → handoff: Tuesday 11:00 `America/Mexico_City`.** Not
midnight. Everything that files data to a week — the prompt's queries, the page's
window line, `resolveWindow`, `parseWindow` — uses that instant.

This matters more than it sounds. Cut at midnight PT, a week ends ~10 hours before
the rotation actually changes hands, so every page that fires on Tuesday morning is
charged to the primary who was still asleep and not yet on call. The handoff zone has
had no DST since 2022, so the boundary is a fixed **17:00 UTC** year-round; deriving it
from a zone that shifts would move the rotation by an hour twice a year.

The automations are scheduled **after** the boundary (12:00 and 13:00, same zone) for
the same reason. Running before it meant the handoff run named the incoming primary
before they were on call, and froze a week that still had hours left to run — see
[Week close](#re-running-an-automation-from-the-dashboard).

> **Reading the archive.** Pages written before this was modelled state only dates, and
> their counts really were queried midnight-to-midnight, so `parseWindow` keeps them at
> midnight and only honours a boundary time when the page states one. The two
> generations coexist; nothing was retro-labelled.

---

## The agent prompts

The Health Check prompt in [`agents/`](./agents/) is **not documentation — it is the prompt** that the
*Growth Engineering Health Check* agent runs each day to produce the Confluence
handoff pages. It defines:

- the **report structure** (SLOs/SLAs, incidents, incident.io alerts, tuning
  recommendations, vulnerabilities, action items);
- how each **alert finding and incident** is written — leading with a one-line
  **`TL;DR:`** then a **`What happened:`** detail block (the dashboard splits on
  those labels to render the summary + expandable detail);
- the **Monitor Tuning Ledger** (the agent's cross-week memory) and the
  read-only tuning-recommendation engine;
- mandatory **customer-PII redaction** and the "never modify monitors" constraints.

**`agents/` is the single source of truth.** There is no second copy — the earlier
`on-call.md` / `daily-refresh.md` pair was removed, because two files describing one
prompt is exactly how they drifted.

| File | Role |
| --- | --- |
| [`agents/Growth Team Ops Review Weekly Handof.md`](./agents/) | The Health Check prompt, as pasted into Cursor. **Edit this one.** |
| [`agents/OnCall dashboard.md`](./agents/) | The daily-refresh prompt, as pasted into Cursor. |

The cloud agent does not read this repo, so a change is only live once you **paste the
updated file into the automation's *Agent Instructions***. Committing it here records
what should be running; pasting it is what makes it run.

**Why this replaced the old two-copy rule.** There used to be a "versioned reference" in
the repo and the real text living only inside Cursor. They drifted silently: the
"Rotation line — fixed wording" instruction was dropped from the running prompt between
the 2026-07-28 and 2026-08-11 pages, the Overview's on-call names broke, and the fix
(PR #30) made `parseOnCall` tolerant of the new phrasing instead of restoring the
instruction. Nobody noticed, because the spec lived in the copy that never ran.

`src/lib/ingest/sources/prompt-contract.test.ts` now ties each parser to the wording it
depends on and proves the parser reads a line built from that template — so the same
drift fails a test instead of blanking a dashboard field weeks later. It also records one
known gap as a `todo`: `parseKpis` expects `paging alerts: N total (X High, Y Low)`, which
neither prompt asks for, so the KPI parse always falls back to derived numbers.

---

## Out-of-office warnings

Someone named on-call who is on PTO is the gap that becomes an unanswered page, so the
banner warns when the rotation is not actually covered.

**The agent does the lookup, not the dashboard.** The Health Check prompt's Step 1 has the
Check agent resolve the rotation from incident.io, then check each name's Slack status
and write the result into the page as a fixed-format `Coverage check` block. The
dashboard parses that block like any other prose on the page. **No Slack credential
lives in the dashboard** — same principle as Confluence: the agent holds the
credentials, the page carries the facts, the dashboard reads markdown.

Slack status is the signal because the employee handbook already mandates it: *"please
ensure you notify the company by updating your status in Slack and setting your OOO
email."* Slack's Google Calendar app also sets the status automatically when an event
title contains "OOO" or "PTO", so this is not purely a matter of remembering. Workday
is the system of record for time off, but has no connector here and sits behind SSO.

**The banner always says which of four situations applies** — silence is never used,
because silence cannot distinguish "nobody is away" from "nobody checked":

| Shown | Meaning |
| --- | --- |
| **No planned time off in this rotation** (green) | The check ran and found nobody out of office in the on-call week or at the next handoff. |
| **&lt;name&gt; is out of office until / from &lt;date&gt;** (amber) | An absence under way or still to come, with an `ooo` badge on the person. |
| **Availability could not be checked (&lt;reason&gt;)** | The check ran and failed, e.g. Slack unreachable. |
| **The handoff page carried no availability check** | No check on the page at all — stated explicitly as *not* an all-clear. |

Every variant carries the same provenance line: *"Read from Slack out-of-office status,
which the EarnIn handbook requires for time off."* When individual people could not be
resolved, they are named — "Not verified for &lt;name&gt;" — rather than being folded into
the all-clear.

An absence whose dates have already passed reads as available: a lapsed absence is not
absence. `npm run ingest` prints a `handoff:` warning for both of the two bottom rows,
so a missing or broken check is visible from the CLI too.

**What this can and cannot see.** It catches anyone who followed the process the handbook
describes. Someone who takes time off without setting a Slack status will not appear — and
in that case the dashboard says *unknown*, never *available*. Slack's Google Calendar app
sets the status automatically for events titled "OOO" or "PTO", which is what keeps the
coverage from depending purely on memory.

**Privacy.** The handoff page is committed to git, so anything written there is
permanent and in every clone. The prompt therefore records only **who** is out and
**which dates** — never the reason, the leave type, a verbatim Slack status, or any
medical or personal detail. That is coverage information of the same character as the
shift windows the page already carries.

---

## Data sources / modes

Selected by `SYNC_SOURCE` (default `auto`):

| Mode | Behavior |
| --- | --- |
| `auto` (default) | Use **Confluence** markdown if `data/confluence/*.md` exists, else `demo`. |
| `confluence` | Parse the on-call agent's handoff markdown in `data/confluence/*.md`. |
| `demo` | Bundled sample data that mirrors real Growth monitors — no credentials. |
| `live` | Ingest **directly** from Datadog + incident.io (+ Jira) via the API clients. |

The front end holds **no Atlassian credentials** — Confluence is fetched in the
cloud by the daily-refresh automation, which drops the markdown into
`data/confluence/`. `npm run ingest` / **Sync now** then re-parse those local files.

---

## What's in the UI

- **Overview** — KPIs (alert volume + run-rate trend, active/stale firing,
  escalation rate, open recommendations), a colored **on-call banner** (primary in
  green, secondary in blue, next handoff, plus **out-of-office warnings** — see
  below), the alert-volume trend chart, top tuning recommendations, SLO links, and
  vulnerabilities.
- **Daily** — incidents & alerts scoped to a whole **week** or a single **day**
  (two selectors), in either a **List** view (grouped by disposition) or a
  **Timeline** view (grouped by day). Every alert shows a **TL;DR** + a collapsible
  **"What happened"**.
- **Carryover** — still-firing incident.io alerts carried over from prior weeks
  (Datadog reads OK/No Data) that need a manual clear.
- **Services** — service ownership reconciled across three disagreeing sources
  (see below), with every monitor linked by id.
- **Recommendations** / **Monitors** — the learned tuning recommendations and
  per-monitor detail, with the guarded Apply/Revert path.
- **Settings** — data source + freshness, **cloud automations** (per-automation
  health inferred from local evidence, plus a guarded Re-run button), sync history,
  and refresh controls.

---

## Service ownership (three sources that disagree)

The **Services** page answers "what are we actually on-call for", which no single
system knows. `src/lib/team-services.ts` holds the reconciliation:

| Source | Field | What it means |
| --- | --- | --- |
| Growth Ownership Inventory (sheet) | `sheetIntent` | What the team *intends* to own: `keep` / `hand-off` / `deprecate` / `not-listed`. |
| Cortex catalog | `cortexOwners` | What the org *records*. Drives escalation. An empty array means the tag does not exist in Cortex at all. |
| Datadog | `Monitor.service` | What actually pages someone. |

`verdictFor()` derives the verdict from the first two rather than storing it:

- **corroborated** — the sheet keeps it and Cortex names a Growth team.
- **disputed** — the sheet keeps it, Cortex names someone else. A boundary
  decision to settle with that team, not a bug to fix.
- **unsupported** — already handed off, deprecated, tagged to another team with
  no claim, or the tag resolves to nothing in Cortex.

Two rules are deliberate:

1. **Intent and record are separate fields.** An earlier version had one
   `cortexOwner` field asserting `L2-PENG-Growth` on nearly every entry, while
   Cortex records only eight services to Growth — so most of those claims named a
   tag that does not exist. One field cannot hold both facts.
2. **Unsupported entries stay in the file.** Deleting them would hide the
   finding. They are excluded from `onCallScope()` but still rendered under
   "Leave the rotation" with their reason and their live monitors, because a
   monitor still paging us for a service we gave away is the actionable part.

Tests assert structure and the derivation rules, never who owns what — ownership
is external, moving truth, and pinning it in tests means every correction has to
fight the suite.

### Acting on a finding

Each service on `/services` carries the actions its verdict supports, derived by
`actionsFor()` so a button can never contradict the finding above it: a
`hand-off` names the team the inventory chose, a dispute offers *claim* or
*concede* to each team Cortex records, a dead tag offers a fix, and everything
offers **Keep in scope** — a wrong verdict must always have an exit.

**A decision is a record, not an execution.** The authoritative owner lives in
Cortex's `owningTeamTags` and this app has no Cortex write client, so pressing a
button stores who decided what and when; the retag and the receiving team's
ticket stay manual. What the record buys is that the same 37 findings stop being
re-litigated every handoff, and — because `prisma/oncall.db` is committed — the
decisions travel with the repo like the rest of the dashboard's memory.

Three properties worth knowing:

- **Append-only.** Undo sets `revokedAt` instead of deleting, so the trail
  survives. The live decision is the newest unrevoked row per service.
- **Re-validated server-side.** `recordOwnershipDecisionAction` re-derives the
  allowed actions and rejects anything else, so a stale page cannot record a
  concede to a team Cortex never named.
- **Verdict-stamped.** Each row keeps the verdict it answered. If a catalog
  correction changes that verdict later, the row is flagged rather than silently
  repurposed.

Deciding produces a hand-off packet — verdict, both sources, and every monitor
with its id and Datadog link — so the receiving team inherits the evidence along
with the pager. Set `JIRA_HANDOFF_PROJECT_ID` and `JIRA_HANDOFF_ISSUE_TYPE_ID`
(numeric, read off Jira's create-issue URL) and the link opens prefilled;
without them it opens Jira's create page next to a **Copy handoff note** button.

Labels say `Decided: hand off`, never `Handed off`, and every unexecuted
decision carries a line naming what is still outstanding. A checklist that reads
as done while the pager still rings is worse than no checklist.

### Moving the pager

The one remediation the dashboard can execute is the monitor, via **Move the
pager** on a service decided as hand-off, concede, or delete. It reroutes a
notify handle to the receiving team, or changes the priority.

- **Read before write, always.** The modal fetches the live monitor from
  Datadog; the diff is computed server-side and re-derived on confirm, so a
  preview left open cannot be replayed against a monitor that moved. In
  Confluence mode `Monitor.message` is empty, so a locally computed diff would
  claim "add a handle" when the truth is "replace the two already there" — if
  the read fails, there is no write.
- **Substitution is bounded, not a string replace.** `rerouteMessage()` only
  matches a handle when the next character cannot continue one, because
  replacing `@slack-growth` with a naive replace would silently rewrite
  `@slack-growth-alerts` too.
- **Operator input is allowlisted.** The new handle must match the Datadog
  handle grammar — no whitespace, no newline, nothing that could open a
  `{{...}}` template — since it is substituted into a message Datadog renders
  and routes.
- **Audited and revertable.** Rows land in `AppliedChange` in the same
  `{field, value}` shape the apply path uses, so the existing Revert button
  rolls them back. One field per change, which is what keeps that true.

### Nothing mutates without a confirmation

Every write in the dashboard passes through `ConfirmDialog`, which states what
changes and where before anything happens. This includes the local-only ones:
"this records a decision and changes nothing in Cortex or Datadog" is precisely
what a reader needs told, and it was the first thing anyone asked about the
buttons. External writes get the warning styling, a destructive-coloured confirm,
and the reminder that the receiving team should hear about it first.

### Linking monitors to services

The weekly Confluence report carries monitor ids but no service column, so
`serviceFromTitle()` attributes a monitor only when its title spells out a known
catalog tag *literally*, longest tag first (`service-postman-internal` must not
be read as `service-postman`). Titles like `OTGE containers not ready` are left
unattributed on purpose: a human knows which service that is, but guessing would
link a monitor to a service that does not own it. Unattributed services fall back
to a Datadog monitor search scoped to the service name, so nothing renders a
misleading zero.

---

## The "memory" (shared via git)

The database is a **committed SQLite file** at `prisma/oncall.db`. Because it is
tracked in git, anyone who clones the repo inherits the same incident and
recommendation history. Every sync appends a new snapshot; recommendation rows are
never deleted, so the ledger of "what was tried and what worked" compounds.

**Caveat — single writer.** A SQLite file is a binary blob, so two writers who
ingest and commit concurrently will hit a merge conflict git can't auto-resolve.
This is fine for a single daily writer (the automation). If it conflicts:

```bash
git checkout --theirs prisma/oncall.db   # or --ours, then:
npm run ingest                           # re-run to reconcile the latest state
```

If multiple writers appear, that's the signal to move to Postgres (see
[Portability](#portability)).

**Caveat — `git pull` detaches a running dev server.** Tracking the database has
a second cost that is easy to miss because nothing errors. A pull replaces
`prisma/oncall.db` with a new file rather than editing the old one, so a `next
dev` started beforehand keeps its descriptor on the orphaned inode and serves the
pre-pull database. Every later `npm run ingest` writes to the new file, where the
server cannot see it — the dashboard looks merely quiet rather than detached.

Restarting the server is the whole fix. To recognise it without knowing any of
the above, the header cross-checks the ingested `Last refreshed` stamp against
`data/confluence/*.md` and reads **sync behind source** when the repo holds a
newer page than the one on screen. It compares stamps rather than inodes, so a
checkout that leaves the data unchanged stays quiet.

---

## Quick start

```bash
bash scripts/install.sh    # deps + local env files
# (optional) edit .env.local to add API keys; Confluence/demo need none
bash scripts/init.sh       # create + seed the SQLite memory DB, run a first sync
npm run dev                # http://localhost:3000
```

The dashboard reads the DB live, so after a `git pull` (or a local `npm run ingest`)
just refresh the browser — no restart needed.

---

## Keeping it fresh (daily)

The real daily refresh runs in the cloud via **two Cursor Automations**:

1. **Growth Engineering Health Check** — reads Datadog + incident.io + Jira and
   (re)writes the Confluence handoff page for the current on-call week. Its prompt is
   `agents/Growth Team Ops Review Weekly Handof.md`.
2. **On-call dashboard — daily refresh** — fetches the latest Confluence page, writes
   it to `data/confluence/handoff.md`, runs `npm run ingest`, and opens a PR that it
   **merges immediately** into `main`. Its prompt is
   [`agents/OnCall dashboard.md`](./agents/). Then you `git pull` locally.

To pull that result into the running dashboard, click **Refresh from source** on the
Settings page (it runs `git pull` and reconnects the DB) — or run `git pull` yourself.

### Re-running an automation from the dashboard

Settings has a **Cloud automations** card showing both automations, each with a
health verdict and a **Re-run** button. Re-run POSTs the automation's Cursor
**webhook trigger**, so the real automation runs with its own MCP servers and
secrets — the dashboard never holds Datadog, incident.io, or Atlassian credentials.

**Order matters.** Re-run **step 1** first, wait for its Confluence page, then
**step 2**. The dashboard warns you if you fire step 2 within 20 minutes of step 1,
but it will not stop you: nothing is chained, timed, or polled.

**The buttons cannot tell you a run succeeded.** Cursor exposes no API to read an
automation's run status ([open feature
request](https://forum.cursor.com/t/automations-api/166898)), and a webhook POST
returns no run id. A success message means Cursor *accepted* the request. Use
**Open in Cursor** for the actual run history.

**Health is inferred from local evidence**, since Cursor will not tell us:

| State | Meaning |
| --- | --- |
| `healthy` | Positive evidence of today's run — a `Daily refresh <today>` commit on `origin/main`, or a page stamped today. |
| `pending` | Due, but the grace window (slot + `AUTOMATION_GRACE_MINUTES`) has not closed. Nothing is wrong. |
| `failed` | The grace window closed, the evidence channel was readable, and the evidence is absent. The only state that accuses an automation. |
| `unknown` | The evidence channel itself could not be read — origin was not fetched since the deadline, the page carries no `Last refreshed` stamp, or `git` failed. **Absence of evidence, not evidence of failure.** |

Two consequences worth knowing. The health check reads `unknown` whenever the
daily refresh has not landed, because today's page was never fetched into this
repo — the dashboard will not blame step 1 for step 2's failure. And the render
never fetches from origin, so a stale local view reads `unknown` rather than
`failed`; click **Refresh from source** to look again.

**Setup:** open the automation in Cursor, add a **Webhook trigger**, and **save** —
Cursor generates the URL and API key only after saving. Put both in `.env.local`.
Without them the buttons stay disabled and everything else still works.

You can also re-process without the cloud:

- **Sync now** (top bar) or `npm run ingest` — re-parses the **local**
  `data/confluence/*.md` into the DB (does not fetch from Confluence).
- **In-app worker**: `npm run scheduler` — a `node-cron` process (default
  `0 8 * * *` in `TIMEZONE`) that re-runs the local sync.
- **Hosted (later)**: a ready-but-inactive `vercel.json` cron hitting the
  `CRON_SECRET`-guarded `/api/ingest` route.

---

## Secrets / configuration

All configuration lives in `.env.local` (gitignored — **never commit secrets**).
`.env` holds only the non-secret `DATABASE_URL` for the Prisma CLI. `.env.example`
documents everything.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite path (`file:./oncall.db`). |
| `SYNC_SOURCE` | no | `auto` (default) / `confluence` / `demo` / `live`. |
| `DEMO_MODE` | no | Legacy toggle; `true` forces bundled sample data. |
| `TEAM_TAG` / `TEAM_LABEL` / `TIMEZONE` | no | Analysis scope (defaults mirror the agent prompt). |
| `DD_SITE` | no | Datadog site (`datadoghq.com` = US1). |
| `DD_API_KEY` / `DD_APP_KEY` | live only | Datadog **read** access. |
| `INCIDENT_IO_API_KEY` | live only | incident.io **read** access (Bearer). |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_VULN_FILTER_ID` | optional | Vulnerability counts. |
| `APPLY_ENABLED` | no | `true` unlocks the Apply-suggestion write path. Default `false`. |
| `DD_APP_KEY_WRITE` | apply only | Datadog **write**-scoped app key (separate from the read key). |
| `CRON_SECRET` | hosted auto | Guards the `/api/ingest` route used by a scheduler. |
| `OPERATOR_NAME` | no | Name recorded in the apply + trigger audit trails. |
| `CURSOR_HEALTH_CHECK_WEBHOOK_URL` / `_API_KEY` | re-run only | Webhook trigger for the Health Check automation (**secrets**). |
| `CURSOR_DASHBOARD_REFRESH_WEBHOOK_URL` / `_API_KEY` | re-run only | Webhook trigger for the daily-refresh automation (**secrets**). |
| `CURSOR_WEBHOOK_AUTH_HEADER` / `_SCHEME` | no | Header the webhook key is sent in (default `x-api-key`, no scheme). Change if you get 401s. |
| `CURSOR_HEALTH_CHECK_URL` / `CURSOR_DASHBOARD_REFRESH_URL` | no | cursor.com links shown on Settings (non-secret). |
| `AUTOMATION_HOUR` / `_MINUTE` / `_TIMEZONE` / `_GRACE_MINUTES` | no | The earlier automation's daily slot (default 12:00 `America/Mexico_City`, 180 min grace) used for the health verdict. Set after the handoff so the closing week is complete before it is frozen. |
| `HANDOFF_WEEKDAY` / `_HOUR` / `_MINUTE` / `_TIMEZONE` | no | When the rotation changes hands, which is the real boundary of an on-call week (default Tuesday 11:00 `America/Mexico_City`). Not midnight — see [The week boundary](#the-week-boundary). |

Confluence and demo modes need **no** Datadog/incident.io/Jira keys — those are only
for `live` mode and the Apply write path.

---

## Apply suggestion (guarded Datadog write)

Each recommendation has an **Apply** button that turns the stored `before → after`
into a real monitor edit via the Datadog API. Guardrails:

- Disabled unless `APPLY_ENABLED=true` **and** `DD_APP_KEY_WRITE` is set.
- A **dev/prod target selector** chooses which scope/branch of the *same* monitor the
  change touches (single Datadog org).
- A **before → after diff preview** and **explicit confirmation** are required.
- Every attempt is written to an **`AppliedChange`** audit row (before, after,
  operator, target, response). The prior config is saved for **one-click Revert**.
- Idempotency/drift guard: the current config is re-checked before writing; if it no
  longer matches the recorded "before", the apply no-ops with a warning.

> **Terraform / GitOps caveat:** if these monitors are managed as code, a direct API
> edit can drift from state. The `AppliedChange` record gives you the exact
> `before → after` to mirror back into Terraform.

### Who is allowed to press Apply

**Nobody is authenticated. There is no login, no session, and no middleware.**
The only credential check in the app is the `CRON_SECRET` bearer token on
`/api/ingest`.

Every mutating server action — Apply, Revert, Move the pager, and recording an
ownership decision — is a POST endpoint reachable by anything that can reach the
origin. This is fine for `npm run dev` on a laptop, which is what it is built
for, and it is the assumption behind `APPLY_ENABLED` defaulting to `false`.

It stops being fine the moment the app is served on an interface other than
loopback. With `APPLY_ENABLED=true` and a write key present, an unauthenticated
caller can rewrite production monitor routing. If you deploy this anywhere
shared, put authentication in front of it first; the guardrails above limit the
*blast radius* of a write, not who may attempt one.

Writes are also attributed to the single configured `APPLY_OPERATOR`, not to a
person — so the audit trail records *that* a change happened, not who made it.

> **The committed database:** `prisma/oncall.db` is deliberately in git so the
> history travels with the repo. A reroute performed in `real` mode stores the
> monitor's full `message` in its `AppliedChange` row — internal Slack channels,
> webhook handles, on-call emails — and that lands in git history. The full body
> is what makes one-click Revert possible, so this is a trade, not an oversight.
> Decide it deliberately before the first real-mode reroute.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dashboard (dev). |
| `npm run build` / `npm run start` | Production build / serve. |
| `npm run ingest` | Run one sync now (re-parses the local source). |
| `npm test` | Run the parser regression tests (`node --test`). |
| `npm run scheduler` | Start the automatic local sync worker. |
| `npm run seed` | Seed defaults + sample memory (idempotent). |
| `npm run prisma:migrate` | Create/apply a schema migration (dev). |
| `bash scripts/install.sh` | One-time setup. |
| `bash scripts/init.sh` | Initialize DB + first sync. |

---

## Portability

Everything DB-related goes through Prisma. Moving to Postgres (e.g. for a Vercel
deploy) is a provider swap, not a rewrite:

1. Change `datasource.provider` in `prisma/schema.prisma` from `sqlite` to
   `postgresql`.
2. Point `DATABASE_URL` at the Postgres instance.
3. `npx prisma migrate deploy`.

The schema deliberately avoids SQLite-vs-Postgres-incompatible features (no Prisma
`enum`; status/priority are `String` + app-level constants).

A ready-but-inactive `vercel.json` cron is included. When deployed to Vercel, set the
`CRON_SECRET` env var (Vercel sends it as `Authorization: Bearer <CRON_SECRET>`) and
the cron triggers a daily sync via `/api/ingest`. Until then the route returns 403.

---

## Troubleshooting

- **`DATABASE_URL` not found** — run `bash scripts/install.sh` (creates `.env`).
- **Empty dashboard** — run `bash scripts/init.sh` or `npm run ingest`.
- **Dashboard looks stale** — it only reflects the committed memory. Click
  **Refresh from source** (runs `git pull`) to pull the latest that the daily
  automation pushed to `main`; **Sync now** only re-parses the local
  `data/confluence/*.md` files.
- **Header reads "sync behind source", and syncing does not clear it** — the pull
  replaced `prisma/oncall.db` underneath the running server, which is still
  reading the old file. Restart `npm run dev`. See
  [the memory](#the-memory-shared-via-git) for why tracking the database causes
  this.
- **New Confluence format not showing** — did you paste the updated prompt from
  `agents/` into the Health Check automation? The cloud agent runs its pasted
  instructions, not this repo's copy. Committing a prompt change records what *should*
  run; pasting it is what makes it run.
- **No primary/secondary on the Overview** — the rotation is parsed out of the handoff
  page's prose, so a reworded line yields nothing. `npm run ingest` prints an
  `on-call:` warning when that happens; fix the wording to match the rotation-line
  format in the [Health Check prompt](./agents/) and re-run. An **Unverified** banner instead
  means the page carried the names forward because incident.io was unreachable —
  confirm the rotation in incident.io.
- **Live mode returns nothing** — verify keys in `.env.local` and set
  `SYNC_SOURCE=live`; a missing/unauthorized source degrades gracefully and is
  reported on the Settings page rather than failing the whole run.
- **Apply button disabled** — set `APPLY_ENABLED=true` and `DD_APP_KEY_WRITE`.
- **No out-of-office warnings ever appear** — almost always the two-copy rule: the
  `Coverage check` step was added to the prompt in `agents/` but not pasted into the
  Health Check automation's Agent Instructions, so published pages carry no block.
  `npm run ingest` prints `handoff: no "Coverage check" block on the page` when that is
  the case.
- **A rotation member shows no out-of-office state** — the agent could not resolve them
  in Slack, or the block did not mention that role. It reads *unknown*, never
  *available*; check the page's `Coverage check` block for a `could not be checked` line.
- **An automation reads `unknown`** — the dashboard could not read the evidence, so
  it is not claiming a failure. Usually origin has not been fetched since today's
  deadline: click **Refresh from source**. It also reads `unknown` when the handoff
  page carries no `Last refreshed` stamp (`npm run ingest` prints a `handoff:`
  warning then) or when `git log origin/main` failed.
- **An automation reads `failed` every morning** — the grace window is too short for
  how long the run actually takes. Raise `AUTOMATION_GRACE_MINUTES`.
- **Week close reads `stale`** — the Tuesday handoff never gave the week that ended its
  final refresh, so its archived page stops mid-week and every total on it is short by
  the days it never saw. This is invisible to the two states above, which only ask
  whether a run happened *today*: a week can be published every single day and still be
  archived truncated by the one run that was supposed to close it. Re-run the Health
  Check to rewrite the closing week's page, and check that the Phase A verification in
  the [prompt](./agents/) is actually pasted into the automation — this is the failure
  that prompted it. `unfrozen` is the milder version: the numbers are complete but the
  banner still says `Live page`, so the archive presents a finished week as in progress.
- **Re-run button disabled** — that automation has no webhook URL + API key in
  `.env.local`. Add a **Webhook trigger** to it in Cursor and save first.
- **Re-run returns a 401** — the key is being sent in the wrong header. Try
  `CURSOR_WEBHOOK_AUTH_HEADER=X-Api-Key`, then `x-cursor-api-key`, then
  `Authorization` with `CURSOR_WEBHOOK_AUTH_SCHEME=Bearer`.
- **`no such table: AutomationTrigger`** — run `npm run prisma:migrate` (or pull the
  migration) and restart the dev server so it picks up the regenerated client.

---

_Sources: the Growth Engineering Health Check agent (Confluence), or directly from
incident.io + Datadog (+ Jira) in `live` mode. Customer PII is redacted at the source
before anything is stored. No monitoring configuration is changed except through the
explicit, audited Apply action._
