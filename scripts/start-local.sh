#!/usr/bin/env bash
# scripts/start-local.sh
#
# Starts the local development environment against the Coolify/Supabase
# database via an SSH tunnel. Discovers the database container IP
# automatically so you never have to look it up manually.
#
# Opens TWO tunnels:
#   - Direct connection (port 15432) -> container port 5432 (Prisma migrations)
#   - Supavisor pooled (port 16543) -> container port 6543 (Next.js app)
#
# Requires: DIRECT_URL or DATABASE_URL in your environment (for the password).
set -euo pipefail

# Load .env if it exists (already-set env vars take precedence)
if [ -f .env ]; then
  set -a
  . .env
  set +a
fi

SSH_HOST="ubuntu@100.114.43.64"
SSH_KEY="${HOME}/.ssh/scholarbase_oracle"
LOCAL_DIRECT_PORT="15432"
LOCAL_SUPVISOR_PORT="16543"
# Supavisor requires the tenant in the username (postgres.<tenant>).
POOLER_TENANT="${LOCAL_POOLER_TENANT:-dev_tenant}"

# Container IDs differ between environments — override via env vars if needed.
DB_CONTAINER="${LOCAL_DB_CONTAINER:-supabase-db-1gzzigqz5jnyp8nsmjxzcauc}"
SUPVISOR_CONTAINER="${LOCAL_SUPVISOR_CONTAINER:-supabase-supavisor-1gzzigqz5jnyp8nsmjxzcauc}"

DIRECT_TUNNEL_PID=""
SUPVISOR_TUNNEL_PID=""

cleanup() {
  echo ""
  echo "Stopping SSH tunnels..."
  if [ -n "$DIRECT_TUNNEL_PID" ]; then kill "$DIRECT_TUNNEL_PID" 2>/dev/null || true; fi
  if [ -n "$SUPVISOR_TUNNEL_PID" ]; then kill "$SUPVISOR_TUNNEL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

# Validate SSH key
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY"
  exit 1
fi

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

# Discover supavisor container IP
echo "Discovering supavisor container IP ($SUPVISOR_CONTAINER)..."
SUPVISOR_IP=$(ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_HOST" \
  "sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{println}}{{end}}' $SUPVISOR_CONTAINER" 2>/dev/null \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1) || true

if [ -z "$SUPVISOR_IP" ]; then
  echo "  WARNING: Could not discover supavisor IP. Falling back to database IP."
  SUPVISOR_IP="$DB_IP"
  LOCAL_SUPVISOR_PORT="$LOCAL_DIRECT_PORT"
else
  echo "  Supavisor IP: $SUPVISOR_IP"
fi

# Resolve database password from existing env URL
DB_PASSWORD=""
if [ -n "${DIRECT_URL:-}" ]; then
  DB_PASSWORD=$(echo "$DIRECT_URL" | sed -E 's#postgresql://postgres(\.[^:]*)?:([^@]+)@.*#\2#')
elif [ -n "${DATABASE_URL:-}" ]; then
  DB_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's#postgresql://postgres(\.[^:]*)?:([^@]+)@.*#\2#')
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: Could not determine database password."
  echo "  Set DIRECT_URL (or DATABASE_URL) in your environment before running this script."
  exit 1
fi

# Open direct tunnel (Prisma migrations use this)
echo "Opening direct tunnel on local port $LOCAL_DIRECT_PORT -> $DB_IP:5432..."
ssh -N -o ExitOnForwardFailure=yes -i "$SSH_KEY" -L "$LOCAL_DIRECT_PORT:$DB_IP:5432" "$SSH_HOST" &
DIRECT_TUNNEL_PID=$!

# Open supavisor tunnel (Next.js app uses this pooled connection)
echo "Opening supavisor tunnel on local port $LOCAL_SUPVISOR_PORT -> $SUPVISOR_IP:6543..."
ssh -N -o ExitOnForwardFailure=yes -i "$SSH_KEY" -L "$LOCAL_SUPVISOR_PORT:$SUPVISOR_IP:6543" "$SSH_HOST" &
SUPVISOR_TUNNEL_PID=$!

# Wait for tunnels to be ready
sleep 2

# Verify tunnels are listening
if ! kill -0 "$DIRECT_TUNNEL_PID" 2>/dev/null; then
  echo "ERROR: Direct SSH tunnel failed to start. Is port $LOCAL_DIRECT_PORT already in use?"
  exit 1
fi
if ! kill -0 "$SUPVISOR_TUNNEL_PID" 2>/dev/null; then
  echo "ERROR: Supavisor SSH tunnel failed to start. Is port $LOCAL_SUPVISOR_PORT already in use?"
  exit 1
fi

# Build connection strings
export DATABASE_URL="postgresql://postgres.${POOLER_TENANT}:${DB_PASSWORD}@127.0.0.1:${LOCAL_SUPVISOR_PORT}/postgres"
export DIRECT_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${LOCAL_DIRECT_PORT}/postgres"

echo ""
echo "============================================="
echo "  Local environment ready"
echo "============================================="
echo "  DATABASE_URL (pooled, for Next.js): postgresql://postgres.${POOLER_TENANT}:***@127.0.0.1:${LOCAL_SUPVISOR_PORT}/postgres"
echo "  DIRECT_URL (direct, for Prisma):    postgresql://postgres:***@127.0.0.1:${LOCAL_DIRECT_PORT}/postgres"
echo ""
echo "  Press Ctrl+C to stop the tunnels and dev server."
echo "============================================="
echo ""

npm run dev
