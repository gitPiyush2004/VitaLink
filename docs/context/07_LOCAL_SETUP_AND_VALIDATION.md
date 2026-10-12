# Setup and validation

Use the repository README for full startup commands. The development stack needs Node compatible with installed Vite/Vitest (Node 22.12+ or Node 24 is suitable), Python 3.11+, MongoDB and Redis. The CI matrix uses Node 22 and Python 3.12. The local acceptance run used Python 3.13.

```sh
npm ci
bash scripts/dev/bootstrap.sh
docker compose -f infra/docker-compose.yml up -d mongo redis
npm run bootstrap:org --workspace @vitalink/api -- "Your Org" you@example.com 'A-Long-Password-2026!'
python3 -m venv apps/brain/.venv
apps/brain/.venv/bin/pip install -r apps/brain/requirements-dev.txt
```

Start brain, API, workers and web in separate terminals, following the root README. Dockerfiles and the same-origin nginx proxy are supplied for full Compose startup. Local process execution was verified; Docker execution was not available on the development host.

## What must be connected

- MongoDB and Redis; generated JWT keys and random service/webhook secrets from bootstrap.
- FastAPI brain using the same `BRAIN_SHARED_SECRET` as the API environment. Ensure that secret is available to the brain process; the service's README explains its configuration.
- Public FDA endpoints need no key for the current workflow.
- Nominatim needs a contactable User-Agent and respectful rate limiting; geocoding failures remain visible.
- Optional news/trade source access can fail or be limited; source health must preserve that condition.
- LLM fields are reserved and not wired; there is no LLM connection required to run the current app.
- Carrier quoting is optional and not validated live. Five registered carrier adapters need implementation, not just keys. DSV needs actual schema validation and account access. See [current state](02_CURRENT_STATE.md).

Keep `CARRIER_MOCK_MODE=false`. Never commit `.env`, generated keys, local access files, databases, logs or `.obsidian` preferences. Shared example values are setup placeholders, not deployment secrets.

## Reproducible repository checks

```sh
npm run verify
npm run docs:context:check
npx tsc --noEmit -p tsconfig.json
npm run build --workspace @vitalink/web
cd apps/brain
.venv/bin/ruff format --check .
.venv/bin/ruff check .
.venv/bin/mypy app
.venv/bin/pytest -q
```

`verify` includes formatting, ESLint, API/worker/web type checks, TypeScript tests, provenance/fixture/HTTP/mock-quote/secret gates and documentation consistency. Python has separate lint/type/test checks; pytest includes the paper reproduction gate.

The connected implementation passed on 13 October 2026 **434 TypeScript tests across 35 files and 118 Python tests**. These are dated check results, not a hardcoded expectation for future commits. The web production build passed with a large-chunk warning; Python reported a Starlette deprecation warning. Paper reproduction verifies formulas and reference configurations, not predictive accuracy.

## Local acceptance evidence

The exercised flow used real FDA data and a real heparin product identifier. It verified product matching, a 46-node evidence graph, 15–25°C label storage, a reliability response, coherent conditional tracing, saved response comparison, case notes/history and evidence export. Stock/cost/consignment inputs were labelled engineering assumptions. All actual carrier results were unavailable.

Sign-in/sign-out, bodyless session refresh, unauthorised-request rejection and desktop/narrow-screen behavior were inspected. These checks do not replace penetration testing, clinical validation, real commercial integrations or production operations.

## Frozen public coverage audit

```sh
npm run eval:audit -- /path/to/regulatory-snapshot.json /path/to/report.json
```

The snapshot must contain public incidents and source-health metadata, excluding private cases and credentials. The audit records a source hash and coverage measurements; retain the timestamped input to reproduce the exact figures. Changing the live feed changes the results. See [data and evidence](04_DATA_AND_EVIDENCE.md).

## Documentation maintenance

```sh
npm run docs:context
npm run docs:context:check
```

The generator inventories tracked and nonignored new files outside `docs/context`, extracts static source structure and records fingerprints. The check fails for missing/stale/extra file notes or broken local Markdown links. CI does not require Obsidian; its CLI is used locally to author and inspect the same portable Markdown vault.

## Phase 1 acceptance and current local URL

The final review build was exercised at `http://localhost:5180`, proxied to API port 4001 with the queue/cache in Redis database 1. MongoDB remains on local port 27018 and brain on 8000. An earlier non-watching process remained on 4000; these alternate ports isolate the current worker queue. Normal fresh-checkout defaults remain web 5173 and API 4000.

To use alternate ports, run `API_PORT=4001 WEB_ORIGIN=http://localhost:5180 REDIS_URL=redis://127.0.0.1:6380/1 npm run dev:api`, the worker with the same Redis URL, and `VITALINK_API_PROXY_TARGET=http://localhost:4001 npm run dev --workspace @vitalink/web -- --port 5180`. These are local runtime choices, not hardcoded deployment settings.

Two real-source cases completed with no stock, quotes or route assumptions: heparin candidate investigation and recall lot-scope escalation intent. HTML/JSON exports and auth/org/concurrency checks passed. Separate-database repository checks preserved versions through monitor pruning and rejected changed archive interpretations. The verified 47-snapshot archive reimport was idempotent. See [review readiness](14_PHASE1_REVIEW_READINESS.md).
