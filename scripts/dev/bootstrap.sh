#!/usr/bin/env bash
#
# One-time local setup: generate the RS256 keypair, write .env from the template,
# and print what still needs filling in by hand.
#
# Run once after cloning:  bash scripts/dev/bootstrap.sh
set -euo pipefail

cd "$(dirname "$0")/../.."

if [ -f .env ]; then
  echo ".env already exists; leaving it alone."
  echo "Delete it first if you want a fresh one."
  exit 0
fi

echo "Generating an RS256 keypair for access tokens..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

openssl genpkey -algorithm RSA -out "$TMP_DIR/private.pem" -pkeyopt rsa_keygen_bits:2048 2>/dev/null
openssl rsa -pubout -in "$TMP_DIR/private.pem" -out "$TMP_DIR/public.pem" 2>/dev/null

# Newlines are escaped so each key fits on one .env line.
PRIVATE_KEY="$(awk '{printf "%s\\n", $0}' "$TMP_DIR/private.pem")"
PUBLIC_KEY="$(awk '{printf "%s\\n", $0}' "$TMP_DIR/public.pem")"
BRAIN_SECRET="$(openssl rand -hex 32)"
WEBHOOK_SECRET="$(openssl rand -hex 32)"

cp .env.example .env

# BSD sed (macOS) and GNU sed disagree about -i, so write through a temp file.
python3 - "$PRIVATE_KEY" "$PUBLIC_KEY" "$BRAIN_SECRET" "$WEBHOOK_SECRET" <<'PY'
import sys, pathlib
private_key, public_key, brain_secret, webhook_secret = sys.argv[1:5]
path = pathlib.Path('.env')
text = path.read_text()
text = text.replace('JWT_PRIVATE_KEY=', f'JWT_PRIVATE_KEY={private_key}')
text = text.replace('JWT_PUBLIC_KEY=', f'JWT_PUBLIC_KEY={public_key}')
text = text.replace('BRAIN_SHARED_SECRET=change-me-to-a-long-random-string', f'BRAIN_SHARED_SECRET={brain_secret}')
text = text.replace('WEBHOOK_SIGNING_SECRET=change-me-to-a-long-random-string', f'WEBHOOK_SIGNING_SECRET={webhook_secret}')
path.write_text(text)
PY

echo
echo "Wrote .env with a fresh keypair and random shared secrets."
echo
echo "Optional, all free, all fill in by hand if you want the matching source:"
echo "  UN_COMTRADE_API_KEY    https://comtradeplus.un.org  (trade import shares)"
echo "  DATA_GOV_IN_API_KEY    https://data.gov.in          (Indian facility datasets)"
echo "  NOMINATIM_USER_AGENT   put a real contact address in it (their usage policy)"
echo "  ANTHROPIC_API_KEY      only needed to enable LLM extraction in VERIFY"
echo "  DSV_*                  register at https://developer.dsv.com for demo quotes"
echo
echo "Everything else works with no keys at all. Next:"
echo "  docker compose -f infra/docker-compose.yml up -d mongo redis"
echo "  npm run seed"
echo "  npm run dev:api"
