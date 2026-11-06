#!/usr/bin/env bash
# Promote staging to origin/production (authenticated with GITHUB_TOKEN from
# .env). Thin wrapper around scripts/deploy-branch.sh.
set -euo pipefail
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-branch.sh" production "$@"
