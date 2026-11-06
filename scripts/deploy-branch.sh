#!/usr/bin/env bash
# scripts/deploy-branch.sh
#
# Shared implementation for the branch deploys:
#
#   staging     merge the branch you are on into staging, then push it
#   production  merge staging into production, then push it
#
# Both commands push through the HTTPS `origin` remote using GITHUB_TOKEN,
# read from the environment or the repo-root .env file. The token is passed as
# a per-command http.extraheader, so it is never written to .git/config and
# never printed.
#
# Usage: scripts/deploy-branch.sh <staging|production> [--yes]
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  staging|production) ;;
  *)
    echo "Usage: $0 <staging|production> [--yes]" >&2
    exit 2
    ;;
esac
shift

ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) ASSUME_YES=true ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Load .env if it exists (already-set env vars take precedence).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

REMOTE="origin"
STAGING_BRANCH="staging"
PRODUCTION_BRANCH="production"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_github_token() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    die "GITHUB_TOKEN is required. Add it to .env at the repo root:

  GITHUB_TOKEN=ghp_...

Use a personal access token with Contents: read/write for this repository."
  fi
}

require_https_origin() {
  local url
  # Read the configured value, not `git remote get-url` (which applies
  # url.*.insteadOf rewrites and can hide the actual transport).
  url="$(git config --get "remote.$REMOTE.url" || true)"
  case "$url" in
    https://*) ;;
    *)
      die "The $REMOTE remote is '${url:-<missing>}'. Token deploys need an HTTPS remote:

  git remote set-url $REMOTE https://github.com/<owner>/<repo>.git"
      ;;
  esac
}

require_clean_tree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "You have uncommitted changes. Commit or stash them before deploying."
  fi
}

current_branch() {
  local branch
  branch="$(git symbolic-ref --quiet --short HEAD || true)"
  [ -n "$branch" ] || die "HEAD is detached. Check out a branch before deploying."
  printf '%s\n' "$branch"
}

auth_header() {
  # Personal access tokens are sent as the basic-auth username with an empty
  # password: base64("<token>:").
  printf 'AUTHORIZATION: basic %s' \
    "$(printf '%s:' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
}

git_auth() {
  # Inject the Authorization header through Git's environment-based config so
  # the token never appears in the process argument list.
  GIT_TERMINAL_PROMPT=0 \
    GIT_CONFIG_COUNT=1 \
    GIT_CONFIG_KEY_0=http.extraheader \
    GIT_CONFIG_VALUE_0="$(auth_header)" \
    git "$@"
}

fetch_origin() {
  echo "Fetching $REMOTE..."
  git_auth fetch "$REMOTE" --prune
}

# Fast-forward the current branch to its remote only when the local copy is
# behind. A diverged branch is left alone; the push below reports it.
sync_branch() {
  local branch="$1"
  git rev-parse --verify --quiet "refs/remotes/$REMOTE/$branch" >/dev/null || return 0
  if git merge-base --is-ancestor "$branch" "$REMOTE/$branch"; then
    git merge --ff-only "$REMOTE/$branch" >/dev/null
  fi
}

push_branch() {
  local branch="$1"
  echo "Pushing $branch to $REMOTE..."
  git_auth push "$REMOTE" "$branch"
}

# Check out a local branch, creating it from the remote when missing.
checkout_branch() {
  local branch="$1"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git checkout "$branch"
  elif git rev-parse --verify --quiet "refs/remotes/$REMOTE/$branch" >/dev/null; then
    git checkout -b "$branch" --track "$REMOTE/$branch"
  else
    die "Branch $branch does not exist locally or on $REMOTE."
  fi
}

ORIGINAL_BRANCH="$(current_branch)"
MERGE_IN_PROGRESS=false

# Always leave the repo on the branch the command started from, and finish a
# conflicting merge so the next command does not run inside it.
cleanup() {
  local status=$?
  if [ "$MERGE_IN_PROGRESS" = true ]; then
    git merge --abort >/dev/null 2>&1 || true
  fi
  if [ "$(git symbolic-ref --quiet --short HEAD || true)" != "$ORIGINAL_BRANCH" ]; then
    git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

require_clean_tree
require_github_token
require_https_origin
fetch_origin

if [ "$MODE" = "staging" ]; then
  if [ "$ORIGINAL_BRANCH" = "$PRODUCTION_BRANCH" ]; then
    die "Refusing to merge production into staging. Check out the branch you want on staging."
  fi

  if [ "$ORIGINAL_BRANCH" = "$STAGING_BRANCH" ]; then
    sync_branch "$STAGING_BRANCH"
    push_branch "$STAGING_BRANCH"
    echo "Staging deploy complete."
    exit 0
  fi

  checkout_branch "$STAGING_BRANCH"
  sync_branch "$STAGING_BRANCH"

  echo "Merging $ORIGINAL_BRANCH into $STAGING_BRANCH..."
  MERGE_IN_PROGRESS=true
  git merge --no-edit "$ORIGINAL_BRANCH"
  MERGE_IN_PROGRESS=false

  push_branch "$STAGING_BRANCH"
  echo "Staging deploy complete: $ORIGINAL_BRANCH -> $STAGING_BRANCH."
  exit 0
fi

# Production: never promote a local staging that is behind the remote.
if git rev-parse --verify --quiet "refs/remotes/$REMOTE/$STAGING_BRANCH" >/dev/null; then
  if ! git merge-base --is-ancestor "$REMOTE/$STAGING_BRANCH" "$STAGING_BRANCH"; then
    die "Local $STAGING_BRANCH is behind $REMOTE/$STAGING_BRANCH. Deploy staging first (npm run deploy:staging:branch) or pull it, then retry."
  fi
fi

if [ "$ASSUME_YES" = false ]; then
  echo ""
  echo "  This will merge $STAGING_BRANCH into $PRODUCTION_BRANCH and push it to $REMOTE."
  echo ""
  if ! read -r -p "Type 'yes' to promote to production: " confirm; then
    echo "Aborted."
    exit 1
  fi
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

checkout_branch "$PRODUCTION_BRANCH"
sync_branch "$PRODUCTION_BRANCH"

echo "Merging $STAGING_BRANCH into $PRODUCTION_BRANCH..."
MERGE_IN_PROGRESS=true
git merge --no-edit "$STAGING_BRANCH"
MERGE_IN_PROGRESS=false

push_branch "$PRODUCTION_BRANCH"
echo "Production promotion complete: $STAGING_BRANCH -> $PRODUCTION_BRANCH."
