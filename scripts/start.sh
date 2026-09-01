#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# start.sh — one command from a fresh clone to a running dashboard.
#
# Orchestrates the existing scripts rather than duplicating them: install.sh
# owns dependencies and env files, init.sh owns seeding and the first sync.
# What this adds is the missing middle — collecting credentials interactively —
# and launching the server.
#
# Usage:
#   bash scripts/start.sh              # configure, then dev server (default)
#   bash scripts/start.sh --prod       # configure, then build + production
#   bash scripts/start.sh --no-prompt  # never ask (CI); use whatever is set
#   bash scripts/start.sh --sync       # also reseed + run an ingest
#   bash scripts/start.sh --no-server  # configure only, do not launch
#
# Idempotent. Never overwrites a credential that is already set, and never
# echoes one to the terminal.
# -----------------------------------------------------------------------------
set -euo pipefail

# Anything this script creates holds secrets until proven otherwise.
umask 077

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="$ROOT/.env.local"
ENV_TMP="$ENV_FILE.tmp"

cleanup() { rm -f "$ENV_TMP"; }

# The signal handlers must EXIT, not fall through. Falling through lets a signal
# delete the temp file while set_env is still appending to it: the loop silently
# recreates it and the rename then installs a .env.local containing only the
# lines written after the interrupt, destroying every credential above them.
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

MODE="dev"
PROMPT=1
FORCE_SYNC=0
RUN_SERVER=1

while [ $# -gt 0 ]; do
  case "$1" in
    --prod|--production) MODE="prod" ;;
    --dev) MODE="dev" ;;
    --no-prompt|--yes|-y) PROMPT=0 ;;
    --sync) FORCE_SYNC=1 ;;
    --no-server) RUN_SERVER=0 ;;
    -h|--help)
      sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "ERROR: unknown option '$1'. Try --help." >&2
      exit 1
      ;;
  esac
  shift
done

# A non-interactive shell (CI, piped input) must never block on a prompt.
if [ ! -t 0 ]; then PROMPT=0; fi

echo "==> On-call Ops Dashboard — start (mode: $MODE)"

# --- Dependencies and env files ----------------------------------------------
# install.sh is idempotent, but it also runs `npm install`, so only reach for it
# when something it owns is actually missing.
if [ ! -d node_modules ] || [ ! -f "$ENV_FILE" ] || [ ! -f "$ROOT/.env" ]; then
  echo "==> Running install.sh (missing dependencies or env files)..."
  bash scripts/install.sh
else
  echo "==> Dependencies and env files present"
fi

if ! chmod 600 "$ENV_FILE"; then
  echo "    WARN: could not chmod 600 $ENV_FILE — secrets may be world-readable." >&2
fi

# --- Env file helpers --------------------------------------------------------

# Current value of a key, with one layer of quotes stripped. Empty when unset.
# Parsed by line match rather than a regex so a key is never treated as a
# pattern. Last occurrence wins, matching how dotenv reads the file.
get_env() {
  local key="$1" line raw=""
  [ -f "$ENV_FILE" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "${key}="*) raw="${line#*=}" ;;
    esac
  done <"$ENV_FILE"
  case "$raw" in
    '"'*'"') raw="${raw#\"}"; raw="${raw%\"}" ;;
    "'"*"'") raw="${raw#\'}"; raw="${raw%\'}" ;;
  esac
  printf '%s' "$raw"
}

# Values are written single-quoted. Verified against the repo's own dotenv 17
# and @next/env: inside single quotes both readers take backslashes and double
# quotes literally, while inside double quotes `\n` becomes a real newline and a
# stray `"` ends the value early, turning a following ` #` into a comment.
#
# Two characters survive nothing, so they are refused instead of mangled:
#
#   $  `@next/env` expands `$VAR` in single AND double quotes, so a value
#      containing one silently absorbs another variable's contents. Writing
#      `\$` fixes the app but leaves a literal backslash for `dotenv`, which
#      the CLI scripts use and which does no expansion at all.
#   '  would close the quoting.
env_value_is_storable() {
  case "$1" in
    *'$'*)
      echo "    REFUSED: contains '\$', which the app expands and the CLI does not." >&2
      echo "    Set this one directly in .env.local." >&2
      return 1
      ;;
    *"'"*)
      echo "    REFUSED: contains a single quote, which cannot be quoted safely." >&2
      echo "    Set this one directly in .env.local." >&2
      return 1
      ;;
  esac
  return 0
}

# Replace the key in place, or append it. Writes a sibling temp file and renames
# it, so an interrupt can never leave .env.local truncated.
set_env() {
  local key="$1" value="$2" line found=0
  : >"$ENV_TMP"
  chmod 600 "$ENV_TMP"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "${key}="*)
        printf "%s='%s'\n" "$key" "$value" >>"$ENV_TMP"
        found=1
        ;;
      *) printf '%s\n' "$line" >>"$ENV_TMP" ;;
    esac
  done <"$ENV_FILE"
  [ "$found" -eq 0 ] && printf "%s='%s'\n" "$key" "$value" >>"$ENV_TMP"
  mv "$ENV_TMP" "$ENV_FILE"
}

# Ask for a secret. Never echoes it, never passes it as an argv, never appends
# to history. Sets SECRET_SAVED so callers can tell "entered now" from
# "already there".
SECRET_SAVED=0
ask_secret() {
  local key="$1" label="$2" value=""
  SECRET_SAVED=0
  if [ -n "$(get_env "$key")" ]; then
    echo "    $key — already set, leaving it alone"
    return 0
  fi
  printf '    %s (blank to skip): ' "$label"
  read -r -s value || true
  echo
  if [ -z "$value" ]; then
    echo "    $key — skipped"
    return 0
  fi
  if ! env_value_is_storable "$value"; then
    return 0
  fi
  set_env "$key" "$value"
  SECRET_SAVED=1
  echo "    $key — saved"
}

# Ask for a non-secret. Pass a third argument to hide the current value, for
# fields that are personal data rather than configuration.
ask_plain() {
  local key="$1" label="$2" hide="${3:-}" current shown value=""
  current="$(get_env "$key")"
  if [ -n "$hide" ]; then
    shown="$([ -n "$current" ] && echo "already set" || echo "empty")"
  else
    shown="$current"
  fi
  printf '    %s [%s]: ' "$label" "$shown"
  read -r value || true
  if [ -n "$value" ] && [ "$value" != "$current" ]; then
    env_value_is_storable "$value" && set_env "$key" "$value"
  fi
}

ask_yes_no() {
  local answer=""
  printf '  %s [y/N]: ' "$1"
  read -r answer || true
  [[ "$answer" =~ ^[Yy] ]]
}

# Datadog's documented sites. The key pair is about to be sent here as headers,
# so a typo must not become an exfiltration target.
is_known_dd_site() {
  case "$1" in
    datadoghq.com|us3.datadoghq.com|us5.datadoghq.com|datadoghq.eu) return 0 ;;
    ap1.datadoghq.com|ap2.datadoghq.com|ddog-gov.com) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Credentials -------------------------------------------------------------
if [ "$PROMPT" -eq 1 ]; then
  echo ""
  echo "==> Credentials. Blank answers keep the current value."
  echo "    Skip everything and the dashboard runs on bundled sample data."
  echo ""
  echo "  Datadog (read) — this is what takes the dashboard off demo data:"
  ask_plain DD_SITE "Datadog site"
  ask_secret DD_API_KEY "Datadog API key"
  ask_secret DD_APP_KEY "Datadog application key"

  if [ -n "$(get_env DD_API_KEY)" ] && [ -n "$(get_env DD_APP_KEY)" ]; then
    dd_site="$(get_env DD_SITE)"
    dd_site="${dd_site:-datadoghq.com}"
    if ! is_known_dd_site "$dd_site"; then
      echo "    WARN: '$dd_site' is not a known Datadog site — skipping verification."
      echo "          Fix DD_SITE if that is a typo; the keys were not sent anywhere."
    else
      # Headers arrive on curl's stdin (-H @-), so the keys never reach the
      # process list and never touch disk. printf is a builtin, so they are not
      # in another process's argv either. Timeouts bound the hang.
      code="$(printf 'DD-API-KEY: %s\nDD-APPLICATION-KEY: %s\n' \
        "$(get_env DD_API_KEY)" "$(get_env DD_APP_KEY)" \
        | curl -sS -o /dev/null -w '%{http_code}' \
          --connect-timeout 5 --max-time 15 \
          -H @- "https://api.${dd_site}/api/v1/monitor?page_size=1" \
          2>/dev/null || true)"
      case "$code" in
        200) echo "    Datadog keys verified against api.${dd_site}" ;;
        403) echo "    WARN: Datadog returned 403 — keys reached the API but lack monitor read scope." ;;
        401) echo "    WARN: Datadog returned 401 — the key pair was rejected." ;;
        000) echo "    WARN: could not reach api.${dd_site} to verify the keys." ;;
        *)   echo "    WARN: Datadog returned HTTP $code while verifying the keys." ;;
      esac
    fi

    if [ "$(get_env DEMO_MODE)" = "true" ]; then
      if ask_yes_no "Datadog keys are set. Turn DEMO_MODE off and use live data?"; then
        set_env DEMO_MODE "false"
        echo "    DEMO_MODE=false — ingestion will read live Datadog"
      fi
    fi
  fi

  echo ""
  if ask_yes_no "Configure incident.io (incident history)?"; then
    ask_secret INCIDENT_IO_API_KEY "incident.io API key"
  fi

  echo ""
  if ask_yes_no "Configure Jira (vulnerability counts, hand-off drafts)?"; then
    ask_plain JIRA_BASE_URL "Jira base URL"
    ask_plain JIRA_EMAIL "Jira account email" hide
    ask_secret JIRA_API_TOKEN "Jira API token"
  fi

  echo ""
  echo "  Apply — writes to Datadog."
  echo "  Enabling this lets the dashboard EDIT REAL MONITORS from the browser:"
  echo "  the Apply button on /recommendations rewrites live notification"
  echo "  routing. It is off by default and needs a key separate from the read"
  echo "  key, so read access cannot be used to write. Leave it off unless you"
  echo "  intend to change production monitors from this machine."
  if ask_yes_no "Enable Apply and set the Datadog write key?"; then
    ask_secret DD_APP_KEY_WRITE "Datadog write application key"
    # Only flip the flag for a key entered just now. Someone who set
    # APPLY_ENABLED=false while keeping the key meant it.
    if [ "$SECRET_SAVED" -eq 1 ]; then
      set_env APPLY_ENABLED "true"
      echo "    APPLY_ENABLED=true — the Apply button now writes to Datadog"
    else
      echo "    APPLY_ENABLED left at '$(get_env APPLY_ENABLED)' — no new key entered"
    fi
  fi
else
  echo "==> Skipping prompts (non-interactive or --no-prompt)"
fi

# --- Database ----------------------------------------------------------------
# The SQLite memory DB is committed, so a clone already has data. Generate the
# client and apply migrations every time (cheap, and required after a schema
# change); only seed and sync when asked or when the DB is genuinely absent.
echo ""
if [ ! -f "$ROOT/prisma/oncall.db" ] || [ "$FORCE_SYNC" -eq 1 ]; then
  echo "==> Running init.sh (seed + first sync)..."
  bash scripts/init.sh
else
  echo "==> Generating Prisma client..."
  npx prisma generate
  echo "==> Applying migrations..."
  npx prisma migrate deploy
  echo "    Database ready. Use --sync to reseed and pull fresh data."
fi

# --- Server ------------------------------------------------------------------
if [ "$RUN_SERVER" -eq 0 ]; then
  echo ""
  echo "==> Configuration complete (--no-server). Start it with: npm run dev"
  exit 0
fi

echo ""
if [ "$MODE" = "prod" ]; then
  echo "==> Building for production..."
  npm run build
  SERVER_SCRIPT="start"
  echo "==> Starting production server (Next prints the URL below)..."
else
  SERVER_SCRIPT="dev"
  echo "==> Starting dev server (Next prints the URL below)..."
fi

# exec replaces this shell, so the EXIT trap will not fire — clean up first.
cleanup
trap - EXIT INT TERM
exec npm run "$SERVER_SCRIPT"
