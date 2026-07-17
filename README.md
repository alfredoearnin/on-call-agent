# On-call Ops Dashboard

A local dashboard for the **Growth Team Ops Review**. It ingests directly from
**Datadog** + **incident.io** (and Jira for vulnerabilities), stores everything
in a repo-committed **SQLite "memory" DB**, and surfaces:

1. **Daily incidents / alerts** presented during the day.
2. **Learned monitor-tuning recommendations** (priority/threshold/routing/scope
   changes) with cross-run history — and a guarded **Apply** button that can push
   a change straight to Datadog.

It reimplements, in TypeScript, the analysis that [`on-call.md`](./on-call.md)
performs for its Confluence report. `on-call.md` remains the governing spec.

> The dashboard is **read-only by default**, with a **single, deliberate,
> human-in-the-loop write path**: the "Apply suggestion" action (disabled unless
> you explicitly enable it). Everything else only reads.

---

## Quick start

```bash
bash scripts/install.sh    # deps + local env files
# (optional) edit .env.local to add API keys; leave DEMO_MODE=true otherwise
bash scripts/init.sh       # create + seed the SQLite memory DB, run a first sync
npm run dev                # http://localhost:3000
```

With `DEMO_MODE=true` (the default) the dashboard runs against bundled sample data
that mirrors real Growth monitors — no credentials required.

---

## The "memory" (shared via git)

The database is a **committed SQLite file** at `prisma/oncall.db`. Because it is
tracked in git, anyone who clones the repo inherits the same incident and
recommendation history. Every sync appends a new snapshot; recommendation rows
are never deleted, so the ledger of "what was tried and what worked" compounds
over time.

**Caveat — single writer.** A SQLite file is a binary blob, so two people who
ingest and commit concurrently will hit a merge conflict git can't auto-resolve.
This is fine for a single daily writer. If it conflicts:

```bash
git checkout --theirs prisma/oncall.db   # or --ours, then:
npm run ingest                           # re-run to reconcile the latest state
```

If multiple writers/automation appear, that's the signal to move to Postgres
(see [Portability](#portability)).

---

## Secrets / configuration

All configuration lives in `.env.local` (gitignored — **never commit secrets**).
`.env` holds only the non-secret `DATABASE_URL` for the Prisma CLI. `.env.example`
documents everything.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite path (`file:./oncall.db`). |
| `DEMO_MODE` | no | `true` (default) uses bundled sample data; `false` calls real APIs. |
| `TEAM_TAG` / `TEAM_LABEL` / `TIMEZONE` | no | Analysis scope (defaults mirror `on-call.md`). |
| `DD_SITE` | no | Datadog site (`datadoghq.com` = US1). |
| `DD_API_KEY` / `DD_APP_KEY` | for live | Datadog **read** access. |
| `INCIDENT_IO_API_KEY` | for live | incident.io **read** access (Bearer). |
| `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` / `JIRA_VULN_FILTER_ID` | optional | Vulnerability counts. |
| `APPLY_ENABLED` | no | `true` unlocks the Apply-suggestion write path. Default `false`. |
| `DD_APP_KEY_WRITE` | for apply | Datadog **write**-scoped app key (kept separate from the read key). |
| `CRON_SECRET` | for auto | Guards the `/api/ingest` route used by a scheduler. |
| `OPERATOR_NAME` | no | Name recorded in the apply audit trail. |

---

## Daily sync (manual or automatic — your choice)

Set the mode on the **Settings** page (`manual` or `automatic`). Every trigger
runs the same idempotent analysis pipeline.

- **Manual**
  - **UI**: the **Sync now** button in the top bar.
  - **CLI**: `npm run ingest`.
- **Automatic**
  - **In-app worker**: `npm run scheduler` — a `node-cron` process that fires on
    the configured schedule (default `0 8 * * *`, i.e. 08:00 in `TIMEZONE`). It
    honors the Settings `enabled` flag.
  - **OS-level (no long-lived process)** — macOS `launchd` or crontab, e.g.:
    ```cron
    0 8 * * *  cd /path/to/on-call-agent && /usr/bin/env npm run ingest >> /tmp/oncall-sync.log 2>&1
    ```
  - **Hosted (later)**: a ready-but-inactive `vercel.json` cron hitting the
    `CRON_SECRET`-guarded `/api/ingest` route.

---

## Apply suggestion (guarded Datadog write)

Each recommendation has an **Apply** button that turns the stored
`before → after` into a real monitor edit via the Datadog API. Guardrails:

- Disabled unless `APPLY_ENABLED=true` **and** `DD_APP_KEY_WRITE` is set.
- A **dev/prod target selector** chooses which scope/branch of the *same* monitor
  the change touches (single Datadog org).
- A **before → after diff preview** and **explicit confirmation** are required.
- Every attempt is written to an **`AppliedChange`** audit row (before, after,
  operator, target, response). The prior config is saved for **one-click Revert**.
- Idempotency/drift guard: the current config is re-checked before writing; if it
  no longer matches the recorded "before", the apply no-ops with a warning.

> **Terraform / GitOps caveat:** if these monitors are managed as code, a direct
> API edit can drift from state. The `AppliedChange` record gives you the exact
> `before → after` to mirror back into Terraform.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dashboard (dev). |
| `npm run build` / `npm run start` | Production build / serve. |
| `npm run ingest` | Run one sync now (CLI). |
| `npm run scheduler` | Start the automatic sync worker. |
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

A ready-but-inactive `vercel.json` cron is included:

```json
{ "crons": [{ "path": "/api/ingest", "schedule": "0 15 * * *" }] }
```

It does nothing locally. When deployed to Vercel, set the `CRON_SECRET` env var
(Vercel sends it as `Authorization: Bearer <CRON_SECRET>`), and the cron will
trigger a daily sync via `/api/ingest`. Until then the route returns 403.

---

## Troubleshooting

- **`DATABASE_URL` not found** — run `bash scripts/install.sh` (creates `.env`).
- **Empty dashboard** — run `bash scripts/init.sh` or `npm run ingest`.
- **Live mode returns nothing** — verify keys in `.env.local` and set
  `DEMO_MODE=false`; a missing/unauthorized source degrades gracefully and is
  reported on the Settings page rather than failing the whole run.
- **Apply button disabled** — set `APPLY_ENABLED=true` and `DD_APP_KEY_WRITE`.

---

_Sources: incident.io + Datadog (+ Jira). Customer PII is redacted at ingestion
before anything is stored. No monitoring configuration is changed except through
the explicit, audited Apply action._
