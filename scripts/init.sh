#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# init.sh — initialize the system: generate the Prisma client, create/upgrade
# the SQLite "memory" DB schema, seed defaults, and run a first sync.
# Idempotent: safe to re-run (migrations + upserts).
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> On-call Ops Dashboard — init"

if [ ! -d node_modules ]; then
  echo "ERROR: dependencies missing. Run 'bash scripts/install.sh' first." >&2
  exit 1
fi

# --- Prisma client + schema --------------------------------------------------
echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Applying database schema (migrations)..."
# deploy applies committed migrations; if none exist yet, fall back to db push.
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null || true)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

# --- Seed defaults + sample memory (idempotent) ------------------------------
echo "==> Seeding SyncSettings defaults + sample data (if empty)..."
npm run seed

# --- First sync --------------------------------------------------------------
echo "==> Running an initial sync (respects DEMO_MODE)..."
npm run ingest || echo "WARN: initial ingest failed (check API keys or leave DEMO_MODE=true)."

echo ""
echo "==> Init complete. Start the dashboard with:  npm run dev"
echo "    The SQLite memory DB lives at prisma/oncall.db (committed to the repo)."
