# Vitalink

A medicine supply investigation workspace for procurement and supply-chain
analysts working with FDA-regulated products. Watch actual shortage presentations
and recalls, preserve their scope, identify related medicines, trace a stated
upstream disruption, compare response options, and record the decision.

The operations workspace connects the existing signal, graph, reliability and
carrier engines. It distinguishes official source evidence, derived relationships,
model outputs and operator assumptions. Inventory and supplier offers come from
the operator; the application does not infer them from public records.

The globe and layered panels take visual inspiration from
[God’s Eye View](https://github.com/bilawalsidhu/gods-eye-view). Map points identify
recalling-firm cities, not factories or delivery routes.

Start with the [project context vault](docs/context/00_START_HERE.md) for the
purpose, current state, architecture, evidence limits, research and roadmap.
The [file index](docs/context/FILE_INDEX.md) links a context note for every
versionable file outside that vault, with source declarations, dependencies,
consumers and fingerprints. Open `docs/context` as an Obsidian vault or read the
same notes on GitHub. The overview was authored through the official Obsidian CLI.

The review is the final review of **academic Phase 1**. Alternative-product
discovery is built and runs against live openFDA. Public cost benchmarks and
road-route exposure comparison remain
[proposed additions](docs/context/06_REVIEW_AND_ROADMAP.md), not completed features.

---

## The one thing to understand first

**Every number in this system carries its origin, and a number that cannot be
sourced is not displayed.**

That is not a style preference. It is enforced three ways:

- **In the type system.** A stored figure is a `Quantity` — `{value, unit, tag,
provenance}` — and the zod schema _refuses to construct_ one that breaks the
  rule. A `MODELLED` value without a low-high band is a parse error, not a code
  review comment. A `LIVE_QUOTE` without an archived raw payload cannot exist.
- **In CI.** Five gates run on every commit. Gate 1 fails the build if a
  persisted numeric field is a bare `Number`. Gate 2 fails it if runtime code
  imports a fixture. Gate 5 fails it if the mock carrier could ever emit a live
  quote status.
- **In the UI.** `<QuantityValue>` takes a `Quantity`, not a number, so a
  source-less figure is a _type error_ in the browser too. Every value renders
  with a tag chip — REAL, DERIVED, MODELLED, SCENARIO — and hovering shows the
  source, the exact URL queried, and the full substituted formula.

The consequence you will notice most: **the system says "not available" a lot,
and always says why.** Population at risk, rupee loss, facilities affected — all
refused, each with the reason. Those are the numbers a demo most wants, and none
of them can be honestly produced from open data yet.

---

## Running it

### 1. Prerequisites

Docker Desktop (or local MongoDB/Redis), Node 22.12+ or Node 24, and Python 3.11+
for the reliability service. The installed Vitest version also supports Node 26.

### 2. Bootstrap

```bash
git clone https://github.com/gitPiyush2004/VitaLink && cd VitaLink
npm install
bash scripts/dev/bootstrap.sh          # generates .env with a fresh RS256 keypair
docker compose -f infra/docker-compose.yml up -d mongo redis
```

FDA ingestion requires no API key. Geocoding requires a contactable Nominatim
User-Agent; optional news, trade and carrier integrations have their own access
requirements. Missing credentials remain visible as unavailable.

### 3. Create an account

```bash
npm run bootstrap:org --workspace @vitalink/api -- "Your Org" you@example.com 'A-Long-Password-2026!'
```

The password policy wants twelve characters, three character classes, and no
substring of your email local part.

### 4. Start the connected workspace

```bash
python3 -m venv apps/brain/.venv
apps/brain/.venv/bin/pip install -r apps/brain/requirements.txt
(cd apps/brain && .venv/bin/uvicorn app.main:app --port 8000 --env-file ../../.env)
```

In separate terminals:

```bash
npm run dev:api      # http://localhost:4000
npm run dev:workers  # immediate regulatory ingestion, then hourly refreshes
npm run dev:web      # http://localhost:5173
```

Sign in, open a regulatory event, then an investigation. Medicine analysis fetches
its catalogue data on demand. Inspect Analysis, Trace, Logistics, Response and
Record in that investigation. Sources shows feed coverage, watchlists, and the
separate signal verification/quarantine workflow. Earlier tools remain available
through **Analysis tools**.

Alternatively, after bootstrap and configuring `.env`, the complete Compose setup
uses the supplied API, worker, brain and web Dockerfiles:

```bash
docker compose -f infra/docker-compose.yml up --build
```

The web container proxies `/api` on the same origin, preserving the refresh-cookie
flow. Keep `CARRIER_MOCK_MODE=false` for real-data operation (the template default).
DSV quote mapping still needs validation with an actual account; the five other
carriers are unavailable stubs and require adapter implementation as well as
credentials. No live quote has been established. Container execution remains
untested on the original development host.

For the module contract and limits, read
[operations](apps/api/src/modules/operations/README.md). For reproducible data
coverage evaluation, read [evaluation](eval/README.md).

### 5. Earlier stage tools from the command line

Each script prints the arithmetic rather than just the answer.

```bash
npm run sense     --workspace @vitalink/api
npm run cascade   --workspace @vitalink/api -- ingredient:heparin-sodium 30
npm run recommend --workspace @vitalink/api -- <cascade-id> drug:heparin-sodium 120
npm run decide    --workspace @vitalink/api -- <cascade-id> drug:heparin-sodium <recommendation-id>
```

To see the carrier comparison produce a winner rather than seven rows of "no
quote", set `CARRIER_MOCK_MODE=true` in `.env`. Its prices are labelled
`SANDBOX` everywhere they appear, and `env.ts` refuses to parse a production
config with the flag on.

---

## The loop

| Stage           | What it does                                                                              | Where                              |
| --------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| 1 SENSE         | Pulls openFDA enforcement, openFDA shortages, GDELT news                                  | `modules/signals`                  |
| 2 VERIFY        | Deduplicates, clusters, corroborates, scores veracity, quarantines                        | `modules/signals`                  |
| 3 MAP           | Builds ingredient/labeler associations from openFDA catalogue evidence                    | `modules/catalog`, `modules/graph` |
| 3b ALTERNATIVES | Discovers products sharing the active ingredient and compares them attribute by attribute | `modules/operations`               |
| 4 TRACE         | Propagates one shock forward, accumulating exposure over every path                       | `modules/cascade`                  |
| 5 QUANTIFY      | Tucker & Daskin availability model, in Python                                             | `apps/brain`                       |
| 6 SIMULATE      | Builds the joint (sourcing × logistics) scenario matrix                                   | `modules/scenarios`                |
| 7 DECIDE        | Pareto front, then a weighted objective over it                                           | `modules/scenarios`                |
| 8 EXECUTE       | Carrier eligibility, scoring and a recorded recommendation; no booking                    | `modules/logistics`                |
| 9 LEARN         | Not built. See "What is not here".                                                        | —                                  |

---

## Five findings that changed the design

Each of these was discovered by running the system against live data, and each
is written up in full in `docs/BUILD_LOG.md`.

**A number can be derived from real data and still mean nothing.** The first
version derived the API-supplier count from openFDA's labeler count. It produced
`z_api = 4` for every drug in the catalogue and a fragility index of effectively
zero. openFDA publishes who _labels_ a drug, not who makes its active
ingredient — different echelons, and the concentrated one is invisible. The fix
was to admit the tier is unobserved: `z_api = 1`, tagged SCENARIO, with
`api_tier_visibility: NOT_OBSERVED` on the record.

**Edge direction is a semantic choice, not a naming one.** The specification
writes `drug --MADE_BY--> manufacturer`, which reads correctly in English. A
cascade from a real manufacturer node then reached nothing, because forward
traversal had no outbound edge to follow — and a recalling firm is precisely
where an alert lands. Edges now follow _supply flow_. ADR-0011.

**Two feeds from one agency are one source.** openFDA's enforcement endpoint and
its shortages endpoint are different URLs, different schemas, and the same
organisation publishing on the same authority. Counting them as two would
satisfy the two-independent-sources rule with one source saying something twice.
`independenceKey` collapses them, and the alert's own explanation says so.

**Text similarity cannot cluster headlines on its own.** Measured on real openFDA
recall titles: a one-word rewrite of the same story scores 0.667, and a
_different firm's_ identically-worded recall scores 0.615. There is no threshold
between them that is not an accident of the example. The entity constraint does
the real work, and the similarity threshold is set where it deliberately
under-merges — because over-merging loses a disruption and does so invisibly.

**"Doing nothing" does not recover instantly.** The scenario engine's recovery
term fell back to an intervention's lead time, and the DO_NOTHING baseline has a
lead time of zero. The baseline was therefore reported as recovering in zero
days: flattered on the one axis where it is worst. It now uses the shock's own
duration.

---

## What is not here, and why

Stated plainly, because a capability list that omits the gaps is not a
capability list.

- **The physical layer.** Recalling-firm cities are geocoded; verified production
  facilities, hubs, dependency relationships and delivery lanes are absent. Everything
  downstream of it is therefore absent rather than estimated: facilities at
  risk, population affected, rupee loss, cold-chain excursion probability, and
  lane-level risk in carrier scoring. Each is reported as unavailable _with the
  reason_, never as zero.
- **Live carrier integration.** FedEx, UPS, DHL, Kuehne+Nagel and CEVA are
  unavailable stubs, not credential-ready rate adapters. DSV has a concrete
  adapter with an unverified quote schema. All stay visible in comparisons with
  missing-data reasons. Historical portal research is in `docs/CARRIER_STATUS.md`.
- **Stage 9, LEARN.** Case notes and decision history exist, but no validated
  outcome series, calibration or drift
  detection. It is also why the `reliability` carrier sub-score is always
  neutral: there is no tracking history to compute an on-time rate from, and
  inventing one would be a fabricated number driving a real decision.
- **CP-SAT.** The scenario matrix is capped at fifty rows, and enumerating fifty
  rows is exact. `solver` records which method ran, so an eventual switch is
  visible in the data.
- **The LLM.** No narrative generation is wired up. The contract fields exist
  and are null. Where a language model would eventually write prose, the system
  currently prints the stored calculation method — which is what the model would
  have been paraphrasing anyway.

---

## Verifying it

```bash
npm run verify
```

Runs, in order: Prettier, ESLint at `--max-warnings 0`, TypeScript across three
projects, TypeScript tests, five CI gates and context-documentation checks.
With candidate discovery added, this passes 368 TypeScript tests across 24 files.

```bash
cd apps/brain && python -m pytest      # 118 tests in the connected implementation, including GATE 4
```

**GATE 4** is the one worth knowing about. `apps/brain/tests/test_reliability.py`
reproduces the configuration table from Tucker & Daskin (arXiv:2107.09167) to
within the paper's own quoting precision, and pins the exact values to 1e-7. If
the reliability model ever drifts from the published result, that test fails.

---

## Reading the code

Start at [the context vault](docs/context/00_START_HERE.md), then use
[the file index](docs/context/FILE_INDEX.md). `docs/CODE_TOUR.md` walks an earlier
request end to end; its historical stages complement the connected workflow notes.

`apps/api/src/modules/auth/README.md` is the reference module: every other
module copies its layout exactly. `modules/logistics/README.md` and
`modules/scenarios/README.md` each explain their own design decisions and the
mistakes that produced them.

The fourteen ADRs in `docs/adr/` record the decisions that could reasonably have
gone the other way, including the two that contradict the specification.

---

## Layout

```
apps/
  api/       Express 5, the nine-stage loop, one module per stage
  brain/     FastAPI, the Tucker & Daskin reliability model
  web/       React operations workspace and earlier stage tools
  workers/   BullMQ consumers for the scheduled ingestion
packages/
  contracts/ zod schemas shared by every process — the data covenant lives here
  connectors/ the single HTTP egress point, and the carrier adapters
  graph/     graphology traversal
  ui/        React primitives; `<QuantityValue>` is the important one
docs/        context vault, BUILD_LOG, CODE_TOUR, LEARNING_NOTES, MODEL_CARDS, adr/
scripts/     the five CI gates, and the source probe
```

After changing source or authored context, run `npm run docs:context`, then
`npm run docs:context:check`. CI checks coverage, fingerprints and local note links;
it does not require the Obsidian desktop app.
