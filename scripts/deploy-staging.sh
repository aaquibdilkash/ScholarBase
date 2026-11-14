#!/usr/bin/env bash
# scripts/deploy-staging.sh
#
# Deploys committed Prisma migrations to the STAGING database via an SSH tunnel.
# Uses the direct connection (DIRECT_URL) for prisma migrate deploy.
#
# Requires: DIRECT_URL in your environment (for the password).
#           STAGING_DB_CONTAINER env var to override the container ID.
set -euo pipefail

# Load .env if it exists (already-set env vars take precedence)
if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

SSH_HOST="ubuntu@100.114.43.64"
SSH_KEY="${HOME}/.ssh/scholarbase_oracle"
LOCAL_PORT="15432"

# Staging container ID — override via env var if different
DB_CONTAINER="${STAGING_DB_CONTAINER:-supabase-db-1gzzigqz5jnyp8nsmjxzcauc}"

TUNNEL_PID=""

cleanup() {
  echo ""
  echo "Stopping SSH tunnel..."
  if [ -n "$TUNNEL_PID" ]; then kill "$TUNNEL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# Validate SSH key
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  exit 1
fi

# Validate DIRECT_URL
if [ -z "${DIRECT_URL:-}" ]; then
  echo "ERROR: DIRECT_URL environment variable is required."
  echo "  Example: export DIRECT_URL='postgresql://postgres:PASSWORD@HOST:PORT/dbname'"
  exit 1
fi

# Extract password from existing DIRECT_URL
DB_PASSWORD=$(echo "$DIRECT_URL" | sed -E 's/postgresql:\/\/postgres:([^@]+)@.*/\1/')

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: Could not extract password from DIRECT_URL."
  exit 1
fi

echo "============================================="
echo "  Deploy Prisma migrations to STAGING"
echo "============================================="
echo ""

# Discover database container IP (container may be on multiple Docker networks;
# take the first valid IP address found)
echo "Discovering database container IP ($DB_CONTAINER)..."
DB_IP=$(ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_HOST" \
  "sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{println}}{{end}}' $DB_CONTAINER" 2>/dev/null \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1) || true

if [ -z "$DB_IP" ]; then
  echo "ERROR: Could not discover database container IP."
  echo "  Make sure you can SSH to $SSH_HOST and the container $DB_CONTAINER is running."
  exit 1
fi
echo "  Database IP: $DB_IP"

# Open SSH tunnel
echo "Opening SSH tunnel on local port $LOCAL_PORT -> $DB_IP:5432..."
ssh -N -o ExitOnForwardFailure=yes -i "$SSH_KEY" -L "$LOCAL_PORT:$DB_IP:5432" "$SSH_HOST" &
TUNNEL_PID=$!

sleep 2

if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
  echo "ERROR: SSH tunnel failed to start. Is port $LOCAL_PORT already in use?"
  exit 1
fi

# Override DIRECT_URL to point through the tunnel
export DIRECT_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/postgres"

echo ""
echo "Checking for failed migrations..."
node scripts/prisma-resolve-failed-migration.mjs

echo ""
echo "Running prisma migrate deploy..."
npx prisma migrate deploy

echo ""
echo "Verifying migration status..."
npx prisma migrate status

echo ""
echo "============================================="
echo "  Staging deployment complete"
echo "============================================="
