# Vitalink

An open-data pharmaceutical supply-chain resilience platform. It watches public
sources for disruptions, traces how one shock propagates through a supply graph
built from live regulatory data, quantifies the exposure, and produces a carrier
recommendation whose every constraint came from the drug's own label.

The whole system runs on data anyone can fetch: openFDA, GDELT, UN Comtrade,
OpenStreetMap, USGS. No dataset is bundled, and there is a CI gate that fails the
build if one ever is.

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

Docker Desktop, Node 22+, and Python 3.11+ for the reliability service.

### 2. Bootstrap

```bash
git clone https://github.com/gitPiyush2004/VitaLink && cd VitaLink
npm install
bash scripts/dev/bootstrap.sh          # generates .env with a fresh RS256 keypair
docker compose -f infra/docker-compose.yml up -d mongo redis
```

No API key is required. Every source works unauthenticated; the optional ones
are listed at the end of the bootstrap output.

### 3. Create an account

```bash
npm run bootstrap:org --workspace @vitalink/api -- "Your Org" you@example.com 'A-Long-Password-2026!'
```

The password policy wants twelve characters, three character classes, and no
substring of your email local part.

### 4. Populate from live sources

Nothing here is seeded. Each command fetches real data:

```bash
npm run refresh:catalog --workspace @vitalink/api    # openFDA NDC + labels -> drugs
npm run rebuild:graph   --workspace @vitalink/api    # -> the supply graph
```

### 5. Start it

```bash
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173
```

Sign in and work left to right across the tabs — they are the loop, in order.

### 6. Or run the whole loop from the command line

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

| Stage      | What it does                                                          | Where                              |
| ---------- | --------------------------------------------------------------------- | ---------------------------------- |
| 1 SENSE    | Pulls openFDA enforcement, openFDA shortages, GDELT news              | `modules/signals`                  |
| 2 VERIFY   | Deduplicates, clusters, corroborates, scores veracity, quarantines    | `modules/signals`                  |
| 3 MAP      | Builds the supply graph from live openFDA listings and Comtrade flows | `modules/catalog`, `modules/graph` |
| 4 TRACE    | Propagates one shock forward, accumulating exposure over every path   | `modules/cascade`                  |
| 5 QUANTIFY | Tucker & Daskin availability model, in Python                         | `apps/brain`                       |
| 6 SIMULATE | Builds the joint (sourcing × logistics) scenario matrix               | `modules/scenarios`                |
| 7 DECIDE   | Pareto front, then a weighted objective over it                       | `modules/scenarios`                |
| 8 EXECUTE  | Carrier eligibility gate, six sub-scores, a ranked recommendation     | `modules/logistics`                |
| 9 LEARN    | Not built. See "What is not here".                                    | —                                  |

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

- **The physical layer.** No geocoded facilities, no hubs, no lanes. Everything
  downstream of it is therefore absent rather than estimated: facilities at
  risk, population affected, rupee loss, cold-chain excursion probability, and
  lane-level risk in carrier scoring. Each is reported as unavailable _with the
  reason_, never as zero.
- **Five of six carriers.** FedEx, UPS, DHL, Kuehne+Nagel and CEVA have no
  callable public quote API without an approved commercial account. They are
  still registered and still appear in every comparison table, with the verified
  reason on each row — a table showing one price reads as "there is one option"
  when the truth is "there is one option we can see".
- **Stage 9, LEARN.** No outcome tracking, so no calibration and no drift
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
projects, 318 tests, and five CI gates.

```bash
cd apps/brain && python -m pytest      # 116 tests, including GATE 4
```

**GATE 4** is the one worth knowing about. `apps/brain/tests/test_reliability.py`
reproduces the configuration table from Tucker & Daskin (arXiv:2107.09167) to
within the paper's own quoting precision, and pins the exact values to 1e-7. If
the reliability model ever drifts from the published result, that test fails.

---

## Reading the code

Start at `docs/CODE_TOUR.md`, which walks one request end to end.

`apps/api/src/modules/auth/README.md` is the reference module: every other
module copies its layout exactly. `modules/logistics/README.md` and
`modules/scenarios/README.md` each explain their own design decisions and the
mistakes that produced them.

The twelve ADRs in `docs/adr/` record the decisions that could reasonably have
gone the other way, including the two that contradict the specification.

---

## Layout

```
apps/
  api/       Express 5, the nine-stage loop, one module per stage
  brain/     FastAPI, the Tucker & Daskin reliability model
  web/       React control tower, one tab per stage
  workers/   BullMQ consumers for the scheduled ingestion
packages/
  contracts/ zod schemas shared by every process — the data covenant lives here
  connectors/ the single HTTP egress point, and the carrier adapters
  graph/     graphology traversal
  ui/        React primitives; `<QuantityValue>` is the important one
docs/        BUILD_LOG, CODE_TOUR, LEARNING_NOTES, MODEL_CARDS, CARRIER_STATUS, adr/
scripts/     the five CI gates, and the source probe
```
