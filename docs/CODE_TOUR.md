# Code tour

Current implementation and review context: [start here](context/00_START_HERE.md). This document includes development history; older intentions and engineering phase numbers are not current capability claims or academic review milestones.

One request, end to end, with a stop at every decision that could have gone the
other way. Read this before reading the code.

The request is the one the whole system exists to answer:

> A shock hits an ingredient. Which drugs are exposed, how badly, and who should
> ship the replacement?

---

## 0. Where a request enters

```
apps/api/src/main.ts          connects Mongo and Redis, then listens
  -> app.ts                   helmet, cors, rate limit, JSON body cap
  -> routes/index.ts          the map of the API — one line per module
  -> modules/<stage>/*.routes.ts
```

`routes/index.ts` is worth opening first. It is six lines and it is the table of
contents: a reader looking for "where does `/api/v1/logistics/recommendations`
go?" gets there in two hops.

Note what is _not_ there. The graph module has no router. It is read through the
cascade — "which drugs does this shock reach, and by what path" — because a raw
graph-dump endpoint would invite a client to re-implement the traversal with
different pruning than the cascade uses, and then two parts of the system would
disagree about the answer.

---

## 1. The five layers, and what each may do

Every module has the same shape. `modules/auth/README.md` is the reference, and
the rule is enforced mechanically rather than by convention: ESLint's
`no-restricted-imports` makes a controller importing a Mongoose model a _build
failure_.

| Layer      | May do                                                     | May **not** do                    |
| ---------- | ---------------------------------------------------------- | --------------------------------- |
| router     | map URL → middleware → controller                          | contain logic                     |
| controller | read validated input, call the service, shape the response | business logic, database access   |
| service    | orchestrate, decide, throw typed errors                    | touch `req`/`res`, touch Mongoose |
| repository | run queries, map snake_case ↔ camelCase                    | make decisions                    |
| model      | declare schema and indexes                                 | contain logic in hooks            |
| domain     | pure rules and arithmetic                                  | any I/O, the clock, randomness    |

The rule caught a real violation during the build: the bootstrap script was
importing `OrgModel` directly. The fix was to give the auth module a public
surface (`modules/auth/index.ts`), not to relax the rule.

---

## 2. `packages/contracts` — where the data covenant lives

Open `packages/contracts/src/provenance.ts` first. It is the most important file
in the repository.

```ts
export const quantitySchema = z.object(quantityShape).superRefine(refineCovenant);
```

`refineCovenant` is what turns a project rule into a parse error:

- a `DERIVED` or `MODELLED` value **must** carry a `calculation_method`
- a `MODELLED` value **must** carry a low-high band — a point estimate is
  rejected, because reporting a modelled figure as a point implies a precision
  the model does not have

There are four constructors — `real()`, `derived()`, `modelled()`, `scenario()`
— and no way to build a `Quantity` without going through one. So "every number
carries its source" is a property of the type system rather than something a
reviewer has to notice.

`packages/contracts/src/logistics.ts` does the same job for carrier quotes. A
`LIVE_QUOTE` without a `raw_response_ref` cannot be constructed, which means a
real quote is always distinguishable from a fabricated one — not by policy, but
because the fabricated one fails to parse.

---

## 3. `packages/connectors` — the single egress point

CI gate 3 fails the build on a `fetch` anywhere outside this package.

`http/cached-client.ts` does five things in order: build a cache key, return a
fresh cached response, wait its turn under the source's published rate limit,
fetch with retries, and validate against a zod schema.

Step five is why the class exists. `getJson` returns `Fetched<T>` — the data
_and_ the `Provenance` — so a caller physically cannot obtain data without also
obtaining its source. That is the mechanism behind the covenant.

Three bugs found here are worth knowing about, because each was invisible until
the system ran against a real network:

- **A 404 was retried four times.** `fetchWithRetries` called `waitBeforeRetry`
  for both outcome kinds. One wasted request became four, and the caller waited
  seven seconds to learn nothing.
- **A connect timeout was reported as "unreachable".** GDELT's TLS handshake
  takes about eleven seconds from some networks — raw TCP connects in 450ms, so
  it is their negotiation that is slow — and undici's connect ceiling is ten. The
  error said the host was down while `curl` on the same machine got a 200. See
  `http/slow-hosts.ts`, which exists entirely to hold that finding.
- **The retry backoff undercut the source's own rate limit.** GDELT publishes one
  request every five seconds; the backoff started at 500ms. A 429 was answered
  500ms later by a request guaranteed to 429 — four attempts inside 3.5 seconds,
  all four wasted. The schedule now starts at the source's published interval.

---

## 4. Stage 1–2: `modules/signals`

Three files carry the judgement, and each exists to stop one specific lie.

**`domain/simhash.ts`** stops twenty copies of one wire story counting as twenty
sources. It also holds a measurement table that changed the design: on
headline-length text, five-word shingles score a one-word rewrite at 0.167 —
indistinguishable from unrelated text. Shingle size now adapts to document
length, and the SimHash prefilter is skipped below twenty features because its
distance is noise there.

**`domain/independence.ts`** stops two endpoints of one agency counting as two
sources. Every observation collapses to one _independence key_: an agency feed
keys to the agency, a news article to its registrable domain. So openFDA
enforcement and openFDA shortages both key to `fda.gov`, and the alert's
explanation says "2 observations collapsed to 1 source" rather than leaving a
reader to wonder.

**`domain/veracity.ts`** stops one authoritative source clearing a two-source
bar. Veracity is a _product_ — independence × credibility × recency — not a
weighted sum. Under a sum, a single regulator's fresh statement would score
around 0.6 and clear a 0.5 threshold while failing the one rule VERIFY exists to
enforce. A product cannot do that: any term near zero drags the result to zero,
which is correct for a conjunction of requirements.

The stage's honest output is the **quarantine**, not the alert list. On a live
run over 123 clusters it published zero alerts — because an FDA recall is
usually reported by the FDA and nobody else. That is a finding about
corroboration, and the UI shows it as one.

---

## 5. Stage 3–4: `modules/catalog` and `modules/cascade`

`catalog/domain/redundancy-derivation.ts` documents three attempts at the same
number and is worth reading for that reason alone. The surviving design splits
what the data can support (`z_plant`, DERIVED from the numbers-equivalent of the
HHI over per-labeler product counts) from what it cannot (`z_api`, SCENARIO,
because openFDA does not publish the API tier at all).

`catalog/domain/storage-parsing.ts` was rewritten three times against real
labels. The failures are instructive: insulin parsed as "ambient"; cisplatin,
whose label says _do not refrigerate_, parsed as "2-8C". The parser now handles
sticky clause scope, in-use parentheticals, and negation-as-prohibition — and it
returns the _forbidden_ ranges as data, which the carrier eligibility gate then
acts on.

`cascade/domain/exposure.ts` sums over **every** path rather than taking the
shortest, because exposure accumulates: two independent routes from a shock to a
drug are worse than one. The stored `calculation_method` substitutes every term,
so a reader can recompute the score by hand.

`cascade/domain/cover-projection.ts` is where the covenant forced a design. None
of the three inputs stage 4 wants is publicly available — not inventory, not
incoming supply, not demand. Inventing a curve was forbidden; reporting nothing
would have dropped the most useful output. So days of cover at t0 is an explicit
**SCENARIO** input with **no default** — the operator knows it and no API does —
and the band is labelled a sensitivity range, never a confidence interval.

---

## 6. Stage 5: `apps/brain`

Python, because the model is arithmetic from a paper and the paper's authors
work in Python.

`app/domain/reliability.py` implements equations 1–4 of Tucker & Daskin
(arXiv:2107.09167) directly, and `tests/test_reliability.py` reproduces the
paper's configuration table to within its own quoting precision. That test is
**GATE 4**. If the model ever drifts from the published result, the build fails.

Mean uptime is derived rather than transcribed: the paper gives availability, and
the frequency-duration method turns it into a duration. The derivation is in the
docstring.

---

## 7. Stage 8: `modules/logistics`

The gate before the score, and that order is the design.

`domain/eligibility-gate.ts` runs nine hard constraints. A carrier that fails one
is **eliminated**, not down-ranked — it appears in the table marked NOT ELIGIBLE
with its reasons and _no score at all_, because a low score would imply it was
considered on the merits and lost.

Two rules inside carry most of the value:

- **`'unknown'` fails a constraint that requires the capability.** The whole
  reason capabilities are a tri-state is so a guess cannot pass as a fact.
- **An unproven deadline is unmet.** A carrier that returns neither an arrival
  date nor a transit time has not shown it will arrive on time.

There is one exception to the gate's no-short-circuit rule, and it was a
correction: an `UNAVAILABLE` quote reports rule 7 alone. Running the other eight
rules against an empty payload produced four "findings" per carrier that were
really one — "DSV misses the deadline" is not a claim you can make about a
carrier that never answered.

`domain/score.ts` holds a bug worth remembering. Ranking compared final scores
with `!==`, and a weighted sum of six terms plus a 2-point bonus produces
60.00000000000001 rather than 60 — so the merit tie-break could never fire, and
a preference bonus meant to _break_ a tie was silently _reversing_ one on a
difference of 1e-14. In the file whose header says a preference you cannot see is
a bug.

---

## 8. Stage 6–7: `modules/scenarios`

Two answers, and only one of them is an opinion.

`domain/pareto.ts` computes the front: a dominated scenario is no better on any
axis and worse on one, so it can be discarded with **no judgement at all**. That
set is a fact about the options.

The weighted objective then picks one point off it, which requires saying how
many rupees a day of shortage is worth. Nobody can derive that. So the weights
are configuration, they are stored with the answer, and every term's raw value
sits beside its normalised one — because min-max normalisation turned a
one-and-a-half-percentage-point spread into a decisive 1.000-versus-0.000 on a
live run, and a reader has to be able to see that happening.

---

## 9. `packages/ui` — the covenant, in the browser

`<QuantityValue>` takes a `Quantity`, not a number. There is no prop that accepts
a bare number, so rendering a source-less figure is a type error in the browser
exactly as it is on the server.

`UnavailableValue` is the other half. A field that could not be computed renders
as _"not available — why?"_ with the reason on hover. Never a zero and never a
dash: "zero facilities at risk" and "we do not know how many facilities are at
risk" are opposite claims, and a dash makes the reader guess which one they are
looking at.

---

## 10. The gates

`scripts/gates/` — five of them, run by `npm run verify`.

1. **provenance** — every persisted numeric field is a `Quantity`, or is on an
   explicit structural-count list with a written reason
2. **no fixtures** — runtime code imports no sample data; also fails on
   _constructing_ the mock carrier outside the composition root
3. **one egress point** — no `fetch` outside `packages/connectors`
4. **the paper table** (Python) — the reliability model matches Tucker & Daskin
5. **no fake live quotes** — the mock adapter cannot emit a live status; the
   string does not appear in its file, including in its comments

Gate 2 was strengthened during the build rather than relaxed: its import check
could not see `import { MockCarrierAdapter } from '@vitalink/connectors'`,
because the specifier has no "mock" in it. Gate 5 caught the mock adapter's own
doc comment claiming the live-quote string "does not appear in this file" —
inside the file.

---

## Where to look when something is wrong

| Symptom                           | Look at                                                  |
| --------------------------------- | -------------------------------------------------------- |
| a number renders without a tag    | it is not a `Quantity`; find where it stopped being one  |
| a source returns nothing          | `docs/BUILD_LOG.md` — it may be recorded as blocked      |
| a cascade reaches no drug         | edge direction; ADR-0011                                 |
| a carrier is missing from a table | it cannot be — `collectQuotes` iterates the adapter list |
| a figure looks too good           | check its tag; SCENARIO means somebody assumed it        |

## The connected investigation entry point

Start at `apps/web/src/operations/Workspace.tsx`: the monitor, real source records and saved investigations. `Evidence.tsx` preserves product/lot scope. `InvestigationPanel.tsx` keeps analysis, trace, logistics, response and activity history together.

On the server, `modules/operations/operations.ingestion.ts` maps actual FDA responses to stable incidents. The repository shares public regulatory data but scopes investigations and watches by organisation. `operations.analysis.ts` fetches medicine facts, conservatively matches them to the incident and calls the existing Python model through the connector.

`OperationsService.trace` asks `GraphService.forShock` for a coherent observed snapshot, then uses `CascadeService.run`. The cascade cache includes its input data. The logistics panel uses the original shipment derivation and eligibility/scoring engine, attaching the resulting recommendation only after its organisation and context are checked.

`domain/response-plan.ts` computes deterministic inventory gaps from recorded operator inputs. Stock arriving late cannot fill an earlier gap. The resulting SCENARIO quantities and Pareto comparison support a documented choice without asserting clinical suitability or placing an order. `eval/audit.ts` separately replays a frozen public snapshot to measure coverage.
