#!/usr/bin/env bash
#
# Runs ruff on staged Python files from the pre-commit hook.
#
# ruff lives in apps/brain/.venv, not on PATH, so the hook has to find it. If it
# is not installed at all — a contributor who has only touched the TypeScript
# side — the hook says so and passes rather than blocking the commit. CI installs
# it unconditionally and is the real gate.
set -euo pipefail

cd "$(dirname "$0")/../.."

RUFF=""
if [ -x apps/brain/.venv/bin/ruff ]; then
  RUFF="apps/brain/.venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
  RUFF="ruff"
else
  echo "ruff not found (apps/brain/.venv not set up); skipping Python lint."
  echo "  set it up with: cd apps/brain && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt"
  exit 0
fi

# Paths arrive absolute from lint-staged; ruff handles that fine.
"$RUFF" format "$@"
"$RUFF" check --fix "$@"
