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
on-call.md   ← the PROMPT / spec (this repo + pasted into the Health Check agent)
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

## `on-call.md` — the prompt for the Confluence pages

[`on-call.md`](./on-call.md) is **not documentation — it is the prompt** that the
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

**Two copies, keep them in sync:**

| Copy | Where | Role |
| --- | --- | --- |
| Repo copy | `on-call.md` (this repo) | Versioned reference; the dashboard parser targets this format. |
| Agent copy | Pasted into the **Growth Engineering Health Check** automation's *Agent Instructions* | What the cloud agent actually executes. |

When you change `on-call.md`, update **both**: commit the repo copy **and** paste the
new version into the Health Check automation (the cloud agent does not read this
repo). Only then will new Confluence pages reflect the change.

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
  green, secondary in blue, next handoff), the alert-volume trend chart, top tuning
  recommendations, SLO links, and vulnerabilities.
- **Daily** — incidents & alerts scoped to a whole **week** or a single **day**
  (two selectors), in either a **List** view (grouped by disposition) or a
  **Timeline** view (grouped by day). Every alert shows a **TL;DR** + a collapsible
  **"What happened"**.
- **Carryover** — still-firing incident.io alerts carried over from prior weeks
  (Datadog reads OK/No Data) that need a manual clear.
- **Recommendations** / **Monitors** — the learned tuning recommendations and
  per-monitor detail, with the guarded Apply/Revert path.
- **Settings** — data source + freshness, sync history, and refresh controls.

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
   `on-call.md`.
2. **On-call dashboard — daily refresh** — fetches the latest Confluence page, writes
   it to `data/confluence/handoff.md`, runs `npm run ingest`, and opens a PR that
   **auto-merges** to `main`. Then you `git pull` locally.

You can also refresh without the cloud:

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
| `TEAM_TAG` / `TEAM_LABEL` / `TIMEZONE` | no | Analysis scope (defaults mirror `on-call.md`). |
| `DD_SITE` | no | Datadog site (`datadoghq.com` = US1). |
| `DD_API_KEY` / `DD_APP_KEY` | live only | Datadog **read** access. |
| `INCIDENT_IO_API_KEY` | live only | incident.io **read** access (Bearer). |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_VULN_FILTER_ID` | optional | Vulnerability counts. |
| `APPLY_ENABLED` | no | `true` unlocks the Apply-suggestion write path. Default `false`. |
| `DD_APP_KEY_WRITE` | apply only | Datadog **write**-scoped app key (separate from the read key). |
| `HEALTHCHECK_WEBHOOK_URL` / `HEALTHCHECK_WEBHOOK_SECRET` | optional | Lets the **Refresh from source** button trigger the cloud Health Check agent. |
| `CRON_SECRET` | hosted auto | Guards the `/api/ingest` route used by a scheduler. |
| `OPERATOR_NAME` | no | Name recorded in the apply audit trail. |

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

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dashboard (dev). |
| `npm run build` / `npm run start` | Production build / serve. |
| `npm run ingest` | Run one sync now (re-parses the local source). |
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
- **Dashboard looks stale** — it only reflects what's in `data/confluence/*.md`.
  Run the daily-refresh automation (or **Refresh from source**), then `git pull`;
  **Sync now** only re-parses the files already on disk.
- **New Confluence format not showing** — did you paste the updated `on-call.md` into
  the Health Check automation? The cloud agent runs its pasted instructions, not this
  repo's copy.
- **Live mode returns nothing** — verify keys in `.env.local` and set
  `SYNC_SOURCE=live`; a missing/unauthorized source degrades gracefully and is
  reported on the Settings page rather than failing the whole run.
- **Apply button disabled** — set `APPLY_ENABLED=true` and `DD_APP_KEY_WRITE`.

---

_Sources: the Growth Engineering Health Check agent (Confluence), or directly from
incident.io + Datadog (+ Jira) in `live` mode. Customer PII is redacted at the source
before anything is stored. No monitoring configuration is changed except through the
explicit, audited Apply action._
