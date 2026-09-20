#!/usr/bin/env bash
# Update the CRM on the Hostinger VPS to the latest main.
#
# Run from the app directory on the server:
#   bash scripts/deploy-hostinger.sh
#
# Steps: pull, install exactly what the lockfile says, build, restart PM2.
# Stops at the first failure so a broken build never replaces a running one.
# Warns about missing .env entries but does not edit .env.

set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
PM2_NAME="${PM2_NAME:-clarke-crm}"

echo "==> Deploying CRM in $APP_DIR"

if [ ! -f .env ]; then
  echo "!!  No .env file here. Copy your environment variables in first." >&2
  exit 1
fi

# --- Environment sanity (warn only) -----------------------------------------
warn_missing() {
  if ! grep -qE "^$1=." .env; then
    echo "!!  .env is missing $1 — $2"
  fi
}
warn_missing WEBSITE_API_KEY        "the website cannot post leads without it"
warn_missing WEBSITE_ORIGIN         "CORS falls back to allowing any origin"
warn_missing WEBSITE_STAFF_API_URL  "the Applications page will show 'not connected'"
warn_missing WEBSITE_STAFF_API_KEY  "the Applications page will show 'not connected'"
warn_missing PUBLIC_BASE_URL        "ad campaigns cannot be published to Meta without it"

# --- Code -------------------------------------------------------------------
echo "==> Pulling latest main"
git fetch --quiet origin
git checkout --quiet main
BEFORE="$(git rev-parse --short HEAD)"
git pull --ff-only --quiet origin main
AFTER="$(git rev-parse --short HEAD)"
echo "    $BEFORE -> $AFTER"

# --- Dependencies + build ---------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> pnpm not found; enabling via corepack"
  corepack enable >/dev/null 2>&1 || npm install -g pnpm
fi

echo "==> Installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Building"
pnpm build

# --- Restart ----------------------------------------------------------------
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  echo "==> Restarting PM2 process '$PM2_NAME' (picks up .env changes)"
  pm2 restart "$PM2_NAME" --update-env
  pm2 save >/dev/null 2>&1 || true
else
  echo "!!  PM2 process '$PM2_NAME' not found. Start it once with:"
  echo "    pm2 start dist/server.js --name $PM2_NAME && pm2 save"
  echo "    (or set PM2_NAME=<name> if it runs under a different name: pm2 list)"
  exit 1
fi

echo "==> Done. Now at $AFTER. Check: pm2 logs $PM2_NAME --lines 30"
