#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# install.sh — one-time setup for the On-call Ops Dashboard.
# Idempotent: safe to re-run. Installs deps and seeds local env files.
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> On-call Ops Dashboard — install"
echo "    repo: $ROOT"

# --- Node version check ------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed. Install Node.js 20+ and retry." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node 20+ required (found $(node --version))." >&2
  exit 1
fi
echo "==> Node $(node --version) OK"

# --- Install dependencies ----------------------------------------------------
echo "==> Installing npm dependencies..."
npm install

# --- Seed local env files (never overwrite existing) -------------------------
if [ ! -f "$ROOT/.env.local" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env.local"
  echo "==> Created .env.local from .env.example (edit it to add API keys)"
else
  echo "==> .env.local already exists — left untouched"
fi

# Prisma CLI reads DATABASE_URL from .env. Ensure it exists (non-secret).
if [ ! -f "$ROOT/.env" ]; then
  echo 'DATABASE_URL="file:./oncall.db"' > "$ROOT/.env"
  echo "==> Created .env with DATABASE_URL"
else
  echo "==> .env already exists — left untouched"
fi

echo ""
echo "==> Install complete. Next steps:"
echo "    1) (optional) edit .env.local to add Datadog / incident.io / Jira keys"
echo "       — leave DEMO_MODE=true to run with bundled sample data."
echo "    2) bash scripts/init.sh     # create + seed the SQLite memory DB"
echo "    3) npm run dev              # start the dashboard on http://localhost:3000"
