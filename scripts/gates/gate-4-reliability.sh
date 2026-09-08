#!/usr/bin/env bash
#
# CI GATE 4 — model fidelity.
#
# Runs the Python test that reproduces the configuration table published in
# Tucker & Daskin, arXiv:2107.09167. This is the highest-value test in the
# project: it is the difference between "we implemented a published reliability
# model" and "we invented a formula that looks like one".
#
# The spec is explicit that this must be green before any UI work begins.
set -euo pipefail

cd "$(dirname "$0")/../../apps/brain"

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

python -m pytest tests/test_reliability.py -q
