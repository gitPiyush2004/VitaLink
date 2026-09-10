# Build log

One paragraph per phase gate: what was built, what passed, what is blocked, and
why. Written for a human reader, because this becomes the methodology chapter.

---

## Phase 0 — Foundation (gate: passed)

Built the monorepo and, more importantly, the machinery that makes the spec's
code standards enforceable rather than aspirational. npm workspaces across
`apps/{api,workers,web,brain}` and `packages/{contracts,connectors,graph,ui}`;
TypeScript in strict mode with `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes` and `noImplicitOverride` on top; ESLint 10 flat
config; Prettier; husky with lint-staged and commitlint; one `npm run verify`
script that CI runs verbatim so local and CI results cannot diverge.

The two ESLint rules that carry the architecture are `no-restricted-imports` on
`**/models/*` — which makes importing a Mongoose model outside a repository a
build error — and the same rule on `@modules/*/domain/*` and
`@modules/*/*.repository`, which stops one module reaching into another's
internals. Both were tested by deliberately violating them.

`packages/contracts` came next, and its `provenance.ts` is the most important file
in the repository. The `superRefine` on `quantitySchema` means a `DERIVED` value
with no `calculation_method` will not parse, and a `MODELLED` value without
assumptions, a confidence and a low-high band will not parse. The data covenant
is therefore a validation error rather than a convention somebody has to remember.
The same idea is applied to carrier quotes in `logistics.ts`: a `LIVE_QUOTE`
without a pointer to an archived raw carrier payload cannot be constructed at all,
because without one it is indistinguishable from a fabrication.

`modules/auth` was built through all five layers as the reference module every
later module copies, with its own README documenting the conventions. Two
refactors happened during it and both were the right call. First, `AuthService`
became a class with constructor injection rather than a closure factory, because
the factory exceeded the 50-line function budget and hiding six methods inside one
large function is exactly what the budget exists to prevent. Second, token
operations were extracted behind an injected `TokenService` interface, because a
service that imports `signAccessToken` directly cannot be unit tested without an
RSA key and a live Redis. The result is that
`__tests__/auth.service.test.ts` contains no mocking framework at all — the
stubs are plain objects.

**Passing at the gate:** `npm run verify` green (format, lint, typecheck, 35
tests, gates 1/2/3/5, secret scan). A deliberate `any`, a floating promise, a
magic number and a `models/` import from a service each fail the lint. `.env` is
gitignored and `.env.example` is committed with empty values.

**Blocked:** nothing.

**Deferred, deliberately:** Google OIDC with PKCE. Its schemas exist in
`@vitalink/contracts/auth` and the repository already has
`findUserByOauthSubject` and `findOrgByEmailDomain` for it, but password login is
sufficient for the MVP and OIDC is a day of redirect debugging that buys the
research question nothing.

---

## Phase 1 — Connectors, the single egress point (gate: passed, with three

external blockers recorded)

Built `packages/connectors` and its `CachedHttpClient`, which is the only place in
the system that makes an outbound HTTP request. CI gate 3 fails the build on a
`fetch` anywhere else.

The design decision that matters: `getJson` returns a `Fetched<T>` containing the
data **and** its `Provenance` together. A caller physically cannot obtain data
without also obtaining the source name, the exact URL queried and the fetch
instant. That is what makes Rule 1 structural instead of procedural. Everything
else in the client — the per-source rate limiter, the retry policy, the Redis TTL
cache, the zod validation — exists to make that guarantee cheap enough to always
use.

The cache, the clock, the sleeper and the logger are all injected as interfaces.
Three payoffs: the package does not depend on Redis or pino, a retry test runs in
microseconds because the sleeper does not sleep, and `fetched_at` is reproducible
because the clock can be frozen. A timestamp read from `new Date()` inside a
client would be untestable.

Then `scripts/probe-sources.ts`: eleven real requests, printing the response and
the provenance attached to it. Running it found four things worth recording.

**Two were bugs in my own code, both real.** First, a non-retryable status was
being retried: `attemptOnce` classified a 404 as fatal but `fetchWithRetries`
called `waitBeforeRetry` for both classifications, so an openFDA "no matches" 404
cost four requests and seven seconds instead of one request. Second, the openFDA
label query used `+AND+` as a separator; `URLSearchParams` percent-encodes a
literal `+` as `%2B`, so the query arrived as `%2BAND%2B` and matched nothing.
openFDA treats a space-encoded `+` as the separator, so the fix was to write
clauses separated by spaces. Both are now documented at the top of the files they
affected, because both are the kind of thing that costs an afternoon twice.

**Two were genuine external constraints, and the registry now reflects the
sources' own published numbers rather than my guesses.** GDELT answered with HTTP
429 and the body "Please limit requests to one every 5 seconds"; the registry said
one second, and now says five. Nominatim answered 403 because the User-Agent still
contained the `your-email@example.com` placeholder from `.env.example`; the client
now refuses to construct with a placeholder contact and says so, which is a better
failure than four retries ending in "returned 403".

### Probe results, 8 September 2026

| Source                     | Result                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| openFDA `drug/ndc`         | **OK** — 5 heparin sodium products with labeler names                                                                                                                                                         |
| openFDA `drug/ndc` count   | **OK** — **47** distinct labelers for heparin sodium, led by Fresenius Kabi (24 products), Hospira (10), Meitheal (10). One count aggregation, not paging. See the finding below: this number is not `z_api`. |
| openFDA `drug/label`       | **OK** — real storage text: "Store at 20° to 25°C (68° to 77°F); excursions permitted between 15° and 30°C"                                                                                                   |
| openFDA `drug/enforcement` | **OK** — recent Class II drug recalls with firm, date and reason. This is the series λ is fitted from.                                                                                                        |
| openFDA `drug/shortages`   | **OK** — resolved shortage records with posting dates. This is the series μ is fitted from, and the evaluation ground truth.                                                                                  |
| GDELT 2.0 DOC              | **BLOCKED** — persistent HTTP 429 from this network, including after a 25-second pause and three spaced retries via curl.                                                                                     |
| UN Comtrade                | **BLOCKED** — `UN_COMTRADE_API_KEY` not set. Free key, one registration.                                                                                                                                      |
| Nominatim                  | **OK** — geocoded to `[78.5952, 17.6795]` after the User-Agent fix                                                                                                                                            |
| OSRM                       | **OK** — two road routes Hyderabad→Mumbai, 704 km / 8.7 h and 755 km / 9.4 h, both with geometry                                                                                                              |
| Open-Meteo                 | **OK** — 48 hourly points, 24.6–32.1 °C at Hyderabad. This ambient range is what the cold-chain excursion term models for a 2–8 °C shipment.                                                                  |
| USGS                       | **OK** — 5 events M≥4 within 800 km in the last year, including M4.5 off Yārāda                                                                                                                               |

**9 of 11 live. Nothing was fabricated to fill the other two.**

### Finding: a distinct-labeler count is **not** `z_api`, and using it as one would

### make every drug look resilient

The probe was written expecting a small number. Heparin sodium returned **47**
distinct labelers. Reading the actual buckets explains why, and it matters:

```
  24  Fresenius Kabi USA, LLC
  10  Hospira, Inc.
  10  Meitheal Pharmaceuticals Inc.
   9  McKesson Corporation dba SKY Packaging     <-- a repackager
   9  Sandoz Inc.
```

openFDA's `labeler_name` is whoever put their name on the carton. That includes
repackagers, relabelers and private-label distributors, none of which is an
independent API supplier — and several of which may be repackaging the _same_
upstream API. Feeding 47 into `r_api = 1 - p^z_api` would produce a reliability of
essentially 1.0 and a Fragility Index of essentially 0 for a drug that has in fact
been in recorded shortage.

This is precisely the failure mode the spec warns about: a number that is
technically derived from real data and still means nothing. So:

- `z_api` is derived from distinct labelers **after excluding repackaging and
  relabeling marketing categories**, and the exclusion rule is stored in the
  `Quantity`'s `calculation_method`.
- The raw distinct-labeler count is kept and displayed alongside it as an
  explicitly-labelled **upper bound** on supplier redundancy.
- The gap between the two is itself informative, and is shown.

Even after the exclusion, `z_api` remains an _observable-market_ count, not a
count of API manufacturers — no free source publishes the latter. That limitation
belongs in the model card and in the report's threats-to-validity section, not
hidden behind a plausible integer. Implemented in Phase 5.

### Consequence of the GDELT blocker, stated honestly

This is not cosmetic. GDELT is the source that makes SENSE more than a regulatory
feed — openFDA reports a recall once the FDA publishes it, while GDELT can surface
the plant fire days earlier, and that difference is what the evaluation harness
measures as _lead time_.

More importantly, VERIFY counts **distinct registrable domains** as independent
sources, and requires two before promoting a cluster to an alert. Without GDELT
the only independence available is openFDA versus CDSCO. So the honest expectation
is that most clusters will land in the Quarantine view with reason
`insufficient_independent_sources`, and the verification ablation in PART 11 will
have a thin corpus.

The client is complete and correct; it cannot be _verified_ from this network.
Per rule of engagement 9 it is recorded as blocked and the build moves on. The
retry-and-report path is exercised by unit tests against a scripted `fetch`.

**Passing at the gate:** `npm run verify` green, 74 tests. Every returned value
carries valid provenance, shown in the probe output. Gate 3 green.

**Deferred within this phase:** DailyMed SPL, CDSCO PDF parsing (needs
`pdfplumber` in the brain), NPPA ceiling prices, OSM Overpass, data.gov.in and WHO
EML. All six have registry entries with their rate limits and TTLs; none has a
client yet. The MVP's graph is built from openFDA plus Comtrade, and the missing
sources are the difference between a graph and a _complete_ graph — which is a
Phase 4 concern, not a Phase 1 one.

---

## Phase 5 (brought forward) — QUANTIFY and GATE 4 (gate: passed)

Brought forward ahead of SENSE, VERIFY and MAP on the spec's own instruction:
"do not build the dashboard before `test_reliability.py` is green", and more
practically because this is the one component whose failure would invalidate
everything downstream. If the reliability model cannot reproduce the paper, the
Fragility Index is just a number I made up, and no amount of pipeline around it
would fix that.

Built `apps/brain`: FastAPI, layered `routers/` → `services/` → `domain/`, with
no database driver in `requirements.txt` and no `MONGO_URI` in its Compose
environment. That absence is the design (ADR-0006): the brain is stateless, so it
cannot quietly become a second owner of truth.

`domain/reliability.py` implements equations 1–4 and the eq. 6 relation from
arXiv:2107.09167 as pure functions. `domain/paper_baseline.py` holds the paper's
published parametrisation in its own module, so the line between "the equations"
and "one parametrisation of the equations" cannot blur.

### GATE 4 result

| `(z_api, z_plant, z_line)` | Computed `s` | Paper publishes |
| -------------------------- | ------------ | --------------- |
| (1, 1, 1)                  | 9.914 %      | 10 %            |
| (2, 1, 1)                  | 4.071 %      | 4 %             |
| (2, 2, 1)                  | 0.555 %      | 1 %             |

**Green.** The tolerance is 0.5 pp, which is the rounding interval of figures
quoted to the nearest whole percent — not a tolerance chosen to make the test
pass. The exact values are pinned separately at 1e-7, so a refactor that shifted
the arithmetic by a tenth of a percentage point would fail even though it would
still round correctly.

The first run failed, and it failed for the right reason: my hand-computed
regression pins were off in the sixth decimal place. The paper-table assertions
passed immediately. The pins now hold the values the implementation produces,
which agreed with the independent hand calculation to five decimal places.

**The (2,2,1) row is worth stating plainly.** It computes 0.555 % against a
published 1 %, a 0.45 pp gap — the largest in the table. It is inside the rounding
interval, but "rounds to the same whole percent" is a weaker claim than "matches
to three decimals", and a reader deserves to know which one is being made. There
is a test named `test_the_largest_gap_to_the_paper_is_documented` that asserts it
explicitly rather than letting a loose tolerance hide it.

### What is transcribed and what is derived

The paper's full text was not accessible during the build; the equations came from
the project specification, which quotes them. Equations 1–4 and the eq. 6 relation
are therefore transcribed. **Mean uptime is not.** Rather than guess at the
paper's closed form for `U` and label the guess "paper eq. 5", it is computed by
the frequency–duration method of classical reliability theory: the system's
up-to-down transition frequency `nu` is derived directly, then `U = r / nu`. The
paper's `D = U/r - U` then holds as an identity, and the test suite asserts it in
both directions — including `r = U / (U + D)`, which would catch a units error
immediately. The derivation is labelled as ours on every number it produces and in
the model card. Claiming otherwise would have been the exact overclaim this
project exists to avoid.

### Beyond the paper

The test file asserts properties the paper does not, because the scenario engine's
whole premise depends on them: monotonicity in every redundancy count, and that a
second **supplier** helps more than a second **line**. The second is the paper's
substantive finding and the reason this model beats an additive risk score —
suppliers fail less often but take 1.2 years to recover against a line's 29 days.
An additive score gets that backwards, which is why it is the named baseline in
the results chapter.

### Rate estimation, and the case that matters

`domain/rate_estimation.py` fits `lambda` from openFDA recall counts (Poisson MLE)
and `mu` from resolved shortage durations (exponential MLE, matching the model's
own distributional assumption). Below three events it falls back to the paper's
baseline and tags that specific rate `PAPER_BASELINE_FALLBACK`.

The important case is a drug with **zero** recalls. Fitting would give
`lambda = 0`, a perfectly reliable drug, and a Fragility Index of zero — a
confident claim built on no evidence at all. It falls back instead, and there is a
test named after that scenario.

Two limitations are now attached to every number the service returns, in the
`Quantity`'s `assumptions`, rather than living only in a document: `mu` is fitted
only from resolved shortages and is therefore optimistic, and `z_api` counts the
observable market rather than API manufacturers.

**Passing at the gate:** 116 pytest tests including GATE 4; ruff clean; ruff
format clean; mypy `strict` clean over 13 source files.

**One toolchain decision reversed during this phase:** `disallow_any_explicit`
was enabled in the mypy config and then removed. It flags every
`model_config = ConfigDict(...)` line, because pydantic's own `ConfigDict` is a
TypedDict with `Any`-typed values — a lint failure about a library's types rather
than ours. `strict = true` already forbids implicit `Any`, untyped defs and
untyped calls, which is the guarantee that matters. Recorded here rather than
silently dropped.

**Deferred:** `z_plant` from DailyMed SPL establishments (the client is not built,
so `z_plant` is currently 1 and says so). The ₹ loss band, which needs NPPA
ceiling prices. Both are Phase 4 concerns.

---

## Phase 4a — Catalogue and graph: the phase where real data changed the design

Built `packages/graph` (graphology model, structural metrics, path enumeration)
and the `catalog` module, which turns openFDA into the drug universe. Then ran it
against live openFDA, and it went wrong in four separate ways, three of them
invisible to synthetic test data. This entry is mostly about those, because they
are worth more than the code.

### Finding 1: `z_api` cannot be derived from openFDA at all

Attempt one used the raw distinct labeler count. Heparin sodium returned **47**,
which fed into `r_api = 1 - p^47` gives a Fragility Index of essentially zero for
a drug that has been in recorded shortage.

Attempt two replaced the count with the **numbers-equivalent of the Herfindahl
index**, `1 / HHI` — the standard industrial-organisation conversion from a share
distribution to "the equivalent number of equal-sized firms". It discounts the
long tail of one-listing relabelers arithmetically rather than through a
hand-maintained exclusion list, and gave 19.6 for heparin instead of 47. Still
enough for near-zero fragility, so the value was saturated at 4 on the argument
that `r_api` moves by less than the model's own parameter uncertainty above that.

Running that across the whole seed set is what settled it: **every drug came out
at exactly 4.** Amoxicillin 57 labelers, metformin 128, insulin glargine 11,
atropine 71 — all saturated to the same number. A metric that returns the same
answer for every input is not a metric.

The mistake was not the arithmetic, it was the **echelon**. `labeler_name` is
whoever puts their name on the finished carton, which is a proxy for the
finished-dose _plant_ tier — the paper's `z_plant` — and a reasonable one. It is
not, and never was, a proxy for the API-supplier tier: dozens of finished-dose
labelers routinely buy from a handful of upstream API producers, and openFDA does
not publish who those are.

So the derivation now reports what the data measures:

- **`z_plant`** from the labeler numbers-equivalent. `DERIVED`, varies across
  drugs, genuinely informative.
- **`z_api`** from trade concentration when UN Comtrade data is available, and
  otherwise **1, tagged `SCENARIO`**, with `api_tier_visibility: NOT_OBSERVED`
  and a caveat stating plainly that this **overstates** fragility.

Overstating is the deliberate direction to be wrong in for a resilience tool, and
because the echelons are in series a `z_api` of 1 dominates — which is the
correct conclusion: _these drugs are all exposed at a tier we cannot observe._
Variation between drugs then comes from the per-drug fitted failure and repair
rates, which openFDA genuinely does publish. It also makes the free Comtrade key
load-bearing rather than nice-to-have, which is a true statement about the system.

### Finding 2: openFDA silently truncates `count` aggregations

A metformin labeler count returned exactly **100 buckets summing to 629 listings,
with a minimum bucket of 1** — a cut-off tail, presented with nothing to indicate
it had been cut off. Asking for openFDA's maximum raised metformin to 128
labelers, and the client now returns `wasTruncated` so a floor is never reported
as a total. The `calculation_method` on the stored number says so too.

### Finding 3: the label parser was wrong three times, and one way was dangerous

`temperature_requirement` is read from the real label (spec 6.5) and feeds a
**hard constraint**: a carrier that cannot hold the range is eliminated outright.
A wrong parse does not shade a score, it disqualifies the wrong carrier.

**Round one — two regex bugs.** Insulin glargine parsed as `ambient`. The pattern
was `/\b(?:...|refrigerat|...)\b/i`, and in "Refrigerated" the character after
`refrigerat` is `e`, so the trailing `\b` never matched. The numeric fallback
missed too, because labels write `36°F to 46°F` and the unit letter sits between
the number and the word "to".

**Round two — "strictest condition wins" is wrong.** With the regexes fixed,
three drugs parsed as 2-8 °C and all three were wrong:

| Drug         | Real label text                                                                              | Correct answer                      |
| ------------ | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| cisplatin    | "Store at 20° to 25°C. **Do not refrigerate.**"                                              | 15-25C, refrigeration **forbidden** |
| amoxicillin  | "Store dry powder at or below 25°C. Store **reconstituted** suspension under refrigeration." | 15-25C                              |
| methotrexate | "Store at 20°C to 25°C. **After first puncture**, store vials at 2°C to 8°C."                | 15-25C                              |

The cisplatin case is dangerous in both directions: it eliminates every correct
carrier _and_ mandates refrigeration the label explicitly forbids. The rule that
is actually right is the one a pharmacist would state: **the shipping condition is
the one that applies to unopened, un-reconstituted product.** A negated condition
is recorded as a `prohibited` entry, which turns out to be a useful hard
constraint of its own — a reefer-only service is the wrong choice for cisplatin.

**Round three — scope is sticky, and labels must not be merged.** Two more
failures, both only visible on live data.

The parser was receiving several labels' storage sections _joined into one
string_. Those are different products. Three live insulin glargine labels gave
BASAGLAR's `"Not In-Use (Unopened) Refrigerated (36°F to 46°F [2°C to 8°C])"`
alongside LANGLARA's `"In-use (opened) ... Room temperature only (Do not
refrigerate)"`. Joined, LANGLARA's in-use parenthetical prohibited 2-8 °C and
cancelled BASAGLAR's requirement — and insulin came out ambient again, the exact
failure round one was supposed to have fixed. Labels are now parsed individually
and combined afterwards, and when products disagree that disagreement is reported
rather than resolved silently: a shipment carries a specific NDC, not a generic
name.

The second was that a negation belongs to the **scope** its sentence sits in, not
to the sentence alone. "Do not refrigerate" under an "In-use (opened)" heading
forbids refrigeration of _opened_ product. The parser now walks clauses carrying a
current scope, and a prohibition inherits it. Atropine's "AVOID FREEZING Store
PHENOHYTRO ELIXIR at 20°-25°C" — a prohibition and a requirement in one
unpunctuated clause — falls out of the same mechanism.

Two regex details in there are load-bearing enough to have their own comments.
`(?<!not )in-?use` exists because insulin labels write "Not In-Use (Unopened)" for
the shipping condition, and a naive marker strips exactly the clause that matters.
And `String.split` with a zero-width lookahead tests every position, so without
that lookbehind the engine splits both before "Not" and before "In-Use", leaving a
clause consisting of the single word "Not".

### Finding 4: the layering lint caught a real violation in my own code

The bootstrap script imported `OrgModel` and `createAuthRepository` directly, and
`no-restricted-imports` refused it. The fix was not to relax the rule: every
module now has an `index.ts` public surface exporting a wired service, and
`AuthService` gained an `ensureOrg` method so the script never sees a model. That
is the rule paying for itself on day one.

### Live result

```
OK  heparin sodium            47 labelers   15-25C
OK  amoxicillin               57 labelers   15-25C
OK  insulin glargine          11 labelers   2-8C     cold chain + monitoring
OK  cisplatin                 16 labelers   15-25C   FORBIDS 2-8C
OK  metformin hydrochloride  128 labelers   15-25C
OK  vancomycin hydrochloride  50 labelers   15-25C
OK  methotrexate              41 labelers   15-25C
OK  atropine sulfate          71 labelers   15-25C   FORBIDS frozen
8 of 8 refreshed from live openFDA.
```

Every one of those temperature values is now correct against its real label, and
every one was wrong at some point during this phase.

**Passing at the gate:** `npm run verify` green — 169 TypeScript tests, gates 1,
2, 3, 5 and the secret scan. 116 Python tests including GATE 4. The catalogue was
populated end to end against live openFDA and a real Mongo, not a fixture.

**One infrastructure note:** the Compose file maps Mongo to host port **27018**
and Redis to **6380**, not the defaults. A locally-installed `mongod` binds
`127.0.0.1:27017`, and macOS resolves `localhost` to `127.0.0.1` before the
wildcard address Docker binds to — so a container on 27017 is silently shadowed
and every connection lands on the local instance with the wrong credentials. That
cost twenty minutes and is commented in the Compose file.

**Deferred:** the `graph` module that persists nodes and edges (the catalogue and
the traversal both exist; the wiring between them is next), Comtrade country
edges (blocked on the free key), DailyMed establishments for a real `z_plant`
cross-check, and NPPA ceiling prices for the rupee band.

---

## Phase 4b / 6 — MAP persistence and TRACE (gate: passed)

Built the `graph` module (persisted nodes and edges, whole-graph materialisation,
a rebuild that re-derives from the catalogue) and the `cascade` module (path
enumeration, the exposure formula, cover projection). Both were exercised against
the live catalogue, and doing so produced the most consequential finding in the
project so far.

### The graph, built from live openFDA

```
nodes upserted: 333
edges upserted: 443
```

The rebuild is a full re-derivation rather than an incremental patch. Every node
and edge id is a deterministic slug, so a rebuild is idempotent — and an
incremental updater would have to work out which edges to _delete_ when a drug's
manufacturer list shrinks, which is exactly the bug that leaves a stale edge for a
cascade to traverse.

The build reports the three relations it **cannot** construct, as data rather than
as a log line, because the UI has to say "no country dependency observed" next to
an empty panel. An empty panel with no explanation reads as "no risk", which is
the opposite of the truth.

### Finding: the graph's edges were pointing the wrong way

The specification's stage-3 diagram writes the manufacturer relation as
`drug --MADE_BY--> manufacturer`, which is how the phrase reads in English. The
cascade propagates _forward_. Those two are incompatible, and running it is what
showed it:

```
$ cascade manufacturer:hospira-inc 30
The shock at manufacturer:hospira-inc reaches no drug in the current graph.
```

Hospira labels four of the eight seed drugs. Forward traversal from a manufacturer
had no outbound edge to follow, because every `MADE_BY` edge pointed _into_ it.

That is not an edge case — it is the most common real disruption in the system.
openFDA's `drug/enforcement` reports name a `recalling_firm`, so a manufacturer is
precisely where an alert lands. A cascade engine that cannot propagate from a
manufacturer cannot process the majority of its own inputs.

The fix, recorded as **ADR-0011**: every edge is oriented along the direction
**supply flows**, not along the English reading of its relation name. Supply flows
from the manufacturer into the drug, so the edge is stored
`manufacturer --MADE_BY--> drug`. The relation name stays as the spec's enum
declares it; only the orientation changes, and the rule is stated in three places
because `MADE_BY` reads oddly in that direction and that is the cost.

The alternative — keeping the spec's direction and making the traversal
relation-aware — was rejected because it puts the flow semantics in the traversal
code, where nobody reading the graph in the database or in a Cytoscape render can
see them. Two people would then disagree about which way an edge really points and
both would be right.

The 390 stale `MADE_BY` edges from before the change were deleted explicitly,
along with the one cascade computed on them, rather than left as unreachable rows.

### The cascade, after the fix

```
$ cascade manufacturer:hospira-inc 30
shock: Hospira, Inc.  [manufacturer]

EXPOSED DRUGS (4), most exposed first:
  methotrexate              exposure 1.8%  cover 29.4 d  stockout day 12-32
  vancomycin hydrochloride  exposure 1.2%  cover 29.6 d  stockout day 12-33
  atropine sulfate          exposure 1.2%  cover 29.6 d  stockout day 12-33
  heparin sodium            exposure 1.1%  cover 29.7 d  stockout day 12-33
```

The low exposure figures are the correct conclusion, not a bug: Hospira holds a
small share of each drug's observed listings, so a Hospira-only shock is a small
shock to each of those drugs. The stored `calculation_method` says so in full,
with every term substituted:

> `exposure = [sum over paths of prod(edge weights) * decay^length] * (1 + HHI) /
> max(1, total makers - affected makers), clamped to [0, 1]. Here: 1 path(s)
> summed to 0.0176 at decay 0.75; HHI 0.0454 gives a concentration multiplier of
> 1.0454; 41 makers less 41 affected gives a redundancy divisor of 1. Raw 0.0184.
> Every maker of an exposed drug is counted as affected, because the OPERATES
> relation is not ingested and there is no facility geography to narrow it — which
> OVERSTATES exposure.*

That last sentence is the one that matters. Without facility geography the cascade
cannot tell which of a drug's 41 makers a shock actually touches, so it assumes
all of them — which inflates exposure, in the safe direction, and says so on the
number rather than in a document.

### Cover projection: the covenant forcing a design

None of the three inputs stage 4 asks for is publicly available — not inventory,
not incoming supply, not hospital demand. The spec's modelled route needs OSM
catchments and district populations, which are not ingested either.

Two of the three possible responses were wrong: inventing a plausible inventory
curve (exactly what Rule 1 forbids), and reporting nothing at all (the stockout
day is the cascade's most useful output). What the code does instead is take days
of cover at t0 as an explicit **SCENARIO** input — the operator's own figure,
which they genuinely know and no API does — and derive the projection from there.
The band is a sensitivity range and is labelled as one, never as a confidence
interval, and the whole assumption set travels on the number.

The `assumed_cover_days` field on the request has **no default**, deliberately. A
default would make the most consequential assumption in the projection invisible.

One test in that file is worth naming: `takes the stockout band low from the low
cover edge, not the high`. The pessimistic cover edge crosses the safety threshold
_first_, so it produces the earlier day. Inverting it would report the optimistic
day as the worst case, which is the wrong direction to be wrong in for a shortage
tool and looks entirely plausible on screen.

**Passing at the gate:** `npm run verify` green — 207 TypeScript tests, all five
gates. The graph and a cascade both ran end to end against live openFDA data and a
real Mongo. Gate 1 required nine new structural-count justifications in the
cascade model, each written down with its reason rather than waved through.

**Deferred:** the reliability call from the cascade into the Python brain (the
service is wired and GATE 4 is green; joining them is a Phase 7 concern), and the
physical layer, which is what would let a cascade terminate at a district
population rather than at a drug.

---

## Phase 11 — EXECUTE: the pharmaceutical carrier recommender

**Gate:** a cascade produces a shipment with **zero manual input**, and the
comparison table shows every carrier attempted with a reason for each one that
could not quote.

**Status:** passing. `npm run verify` green — 272 TypeScript tests, 116 Python
tests, all five CI gates. The whole path ran end to end against live openFDA data,
a real cascade record and a real Mongo:

```
$ npm run recommend -- cascade-77c56e8d-… drug:heparin-sodium 120

CONSTRAINTS, all derived — none of these was asked of the operator:
  temperature      15-25C
  forbidden        (none stated on the label)
  handling         gdp
  deadline         2026-09-27T21:19:07.870Z
  urgency          LOW
  customs          false

DERIVATION, in order:
  - Days of cover band is 19.3-40.0; the LOW edge of 19.3 days classifies as LOW
    (thresholds: <=2 CRITICAL, <=5 HIGH, <=14 NORMAL).
  - 19.3 days of cover (LOW edge) minus a 1-day receiving and QC margin gives
    18.3 usable days, so the deadline is 2026-09-27T21:19:07.870Z.
  - Temperature requirement 15-25C was parsed from the drug's own openFDA label,
    not asked of the operator. …
  - Lane IN-IN is domestic, so customs brokerage is not required.
  - Gross weight 120.0 kg and volume 0.036 m3 are the operator's consignment
    figures — no public source states how much of a drug a facility needs. …
```

Everything under CONSTRAINTS came from the drug's own label and the cascade's
cover band. The three things on the command line — the cascade, the drug, and the
consignment weight — are exactly the three no public source states.

### The honesty of the comparison table cost three fixes

The first run of that script produced a table that was technically correct and
misleading in three separate ways. All three were only visible because it was run
against live data rather than against the unit tests, which passed throughout.

**"Recommended from 3 of 7 providers."** There is one provider quoting. The mock
carrier returns three service options — road, air, express — and the coverage
count was counting _quotes_. It overstated coverage threefold on precisely the
metric that exists to stop coverage being overstated. `buildCoverageNote` now
counts distinct providers, and there is a test named `counts providers, not
quotes` holding it there.

**The note called a mock a "provider".** Fixing the count alone would have left
"Recommended from 1 of 7 providers", which is true and still lets a screenshot
imply a carrier quoted. The note now _names_ the providers that quoted, so the
mock's own display name — "Mock Carrier (development only)" — does the disclosing
wherever the note travels. That needed no new concept of "is this a mock": naming
the source was enough.

**Six carriers were each reported as missing the deadline.** The gate is designed
not to short-circuit, and a carrier that returned nothing was being run through
all nine rules against an empty payload. So DSV, which has no credentials in this
environment, was reported as missing the deadline, supporting no temperature range
_and_ having undocumented GDP — three failures derived from the absence of a
response, presented alongside the one real failure. "DSV misses the deadline" is
a claim that cannot be supported about a carrier that never answered.

Rule 7 now fires alone. That is the single exception to the no-short-circuit
guarantee, it is documented at the top of the gate, and two tests hold both
halves: an unavailable quote reports only `quote_unavailable`, and a carrier that
_did_ quote still reports every failure it has.

### The weighting responds, and the sanity check proves it

The spec asks for one test by name: under a CRITICAL profile a carrier that is
₹6 k cheaper but 25 hours slower must lose to the faster one, and under LOW the
same pair must reverse. Both hold. A third test asserts the sub-score _values_ are
identical under both profiles, so the reversal is caused by the weights swapping
and not by some input having quietly changed — the failure mode where the test
passes for the wrong reason.

Under CRITICAL the margin is under 2 points. That is worth knowing rather than
smoothing over: with only a ₹6 k spread the profile does flip the answer, but not
by much, and the stored breakdown is what lets an operator see it was close.

### A tie that was silently being reversed

`rankCandidates` compared final scores with `!==`. A weighted sum of six terms
plus a 2-point preference bonus produces 60.00000000000001, not 60 — so the
tie-break on un-bonused merit could never fire, and a preference bonus that was
meant to _break_ a tie was instead _reversing_ one on a difference of 1e-14. The
comparison now uses a thousandth-of-a-point epsilon, which is two orders of
magnitude below the precision scores are reported at.

This is the failure the design was explicitly trying to avoid — "a preference you
cannot see is a bug" — and it was in the code that says so.

### Three places a number was technically right and meant nothing

**Prohibited temperature ranges stopped at a warning string.** The label parser
correctly found cisplatin's "Do not refrigerate", and the eligibility gate had a
rule for exactly that case, and the two were never connected: the prohibition was
formatted into a human-readable warning and dropped. It is now a persisted field
on the drug, threaded through to the gate.

The first live run then crashed on `undefined.length`, because drug documents
written before that field existed read it back as `undefined` under `lean()` —
Mongoose's schema default only applies on write. The mapper defaults to `[]` with
a comment stating that an empty list means "no prohibition has been parsed",
which is not the same claim as "the label forbids nothing".

**The weight profile's rationale was overwritten by the run's own derivation.**
`rationale` ("why this profile weights things this way") and `selected_because`
("why this profile is in force for this shipment") are two different sentences,
and the mapper was using the second for both. The score breakdown printed the
entire five-line shipment derivation where the one-line weighting explanation
belonged. They are separate fields again, and the rationale comes from the live
table rather than from the stored copy.

**The mock-mode startup warning misdescribed its own output.** It said the mock's
quotes are "labelled ESTIMATED". They are labelled `SANDBOX_QUOTE`. A warning
whose job is to prevent a mock being mistaken for a carrier had the wrong status
string in it.

### What is neutral, and says so on the row

Two of the six sub-scores contribute at the documented neutral value under every
profile today, and the reason is printed on the row rather than in a footnote:

- **`reliability`** — no carrier publishes a machine-readable on-time figure, and
  Vitalink has no tracking history yet. Inventing a plausible percentage would be
  a fabricated number driving a real decision.
- **`risk`** — a quote does not say which hubs it transits, and the physical layer
  is not ingested, so there is no way to tell whether a lane runs through the
  shocked region.

Scoring either zero would punish a carrier for our ignorance; scoring either 100
would reward them for it.

### NO_ELIGIBLE_CARRIER is an answer, and it was exercised

Re-running the same cascade with 3 days of assumed cover derives a CRITICAL
urgency and a deadline of _now_ — 0.4 days at the low edge, minus the 1-day
receiving margin, floored at zero. Every service then misses it:

```
COMPARISON  (Recommended from 1 of 7 providers: Mock Carrier (development only).
             6 returned no quote — see the reason on each row. 1 of the providers
             that did quote was ruled ineligible by a hard constraint.)

  Mock Carrier (development only)  INR 14,200  SANDBOX_QUOTE  NOT ELIGIBLE
      x deadline_miss: Arrives 2026-09-13T…, which is 96.0h after the required
        deadline of 2026-09-09T…

  RECOMMENDED: NO ELIGIBLE CARRIER — see the reasons above
```

That is the correct output. "No carrier can get this here in time" is what an
operator needs to hear, and the alternative — relaxing a constraint nobody asked
to relax so the table has a winner in it — is the failure this whole module is
shaped to avoid.

### Deferred, and why

- **FedEx, UPS, DHL, Kuehne+Nagel and CEVA live adapters.** None has a callable
  public quote API without an approved commercial account. They are registered
  with the verified reason for each, checked against their own developer portals
  and recorded in `docs/CARRIER_STATUS.md`. The stub-only rule from the build
  prompt applies: the interface exists, the phase is marked blocked, and no data
  is fabricated.
- **Tracking ingestion.** The `ShipmentTrackingEvent` contract exists; polling and
  webhooks are a later phase. It is what would make the `reliability` sub-score
  real.
- **Object storage for raw carrier payloads.** `raw_response_ref` currently points
  at a Redis key with a 30-day TTL, so a quote older than that keeps its reference
  and loses the payload behind it. Stated in the archiver's own doc comment rather
  than left to be discovered.
- **A transaction around superseding.** Two writes, ordered so a crash between
  them leaves a current recommendation with a stale flag rather than a shipment
  with no current recommendation at all.

### Gate bookkeeping

Gate 1 needed one new structural-count justification (`weighted_score`, whose
whole computation is stored alongside it). Gate 2 was **strengthened** rather than
relaxed: the import check could not see `import { MockCarrierAdapter } from
'@vitalink/connectors'` because the specifier has no "mock" in it, so a second
rule now looks for the _construction_ instead, which only the composition root may
do and only behind `CARRIER_MOCK_MODE`.

Gate 5 caught the mock adapter's own doc comment, which had claimed "the string
`LIVE_QUOTE` does not appear in this file" — inside the file. The comment now
describes the string instead of quoting it, and says why.

---

## Phase 12 — SENSE + VERIFY, and the corroboration that mostly fails

**Gate:** three public sources ingested, clustered, corroborated and scored, with
every rejection kept and explained.

**Status:** passing. Three sources are live — openFDA drug enforcement, openFDA
drug shortages, and GDELT — and a run stores 97 signals across 88 clusters.

The headline result is that **zero clusters published as alerts**, and that is
the finding rather than a failure. An FDA recall is usually reported by the FDA
and nobody else; under the two-independent-sources rule it is not publishable,
and the quarantine record says so with the reason. The system can now state a
number about itself: _how much of what it sees can it actually stand behind_.

### GDELT was not down; its handshake is slow

Recorded here because the diagnosis took an hour and the error message was
actively misleading.

Every GDELT request failed with `UND_ERR_CONNECT_TIMEOUT`, surfaced as _"GDELT
2.0 DOC API was unreachable"_, while `curl` on the same machine returned 200 for
the identical URL. DNS was fine. The A and AAAA records both resolved to the same
IPv4 address, so it was not a Happy Eyeballs problem. `net.setDefaultAutoSelectFamily(false)`
changed nothing.

A raw probe settled it:

```
raw TCP connected in 456 ms
TLS connected in 11477 ms, alpn = false
```

Their TLS negotiation takes eleven and a half seconds. Undici's connect ceiling
is ten, and an `AbortController` cannot raise it — the ceiling is inside the
dispatcher. `curl` succeeded because its default is far longer.

Three consequences, all in the code:

- `packages/connectors/src/http/slow-hosts.ts` exists to hold a 45-second connect
  timeout, opted into per source. Node's global `fetch` rejects the npm undici
  package's `Agent` with `UND_ERR_INVALID_ARG` — it validates that a dispatcher
  is one of _its own_ internal classes — so raising the ceiling means calling
  undici's own `fetch` for that one source. The branch is commented.
- `classifyThrow` now walks the cause chain for `UND_ERR_CONNECT_TIMEOUT` and
  reports a **timeout**, not a network failure. The two map to different
  `unavailable_reason` values on a carrier quote, so the distinction reaches the
  UI.
- The retry backoff no longer undercuts a source's published rate limit. GDELT
  allows one request every five seconds; the backoff started at 500ms, so a 429
  was answered 500ms later by a request guaranteed to 429 — four attempts inside
  3.5 seconds, all four wasted. `backoffDelayMs` now takes the source interval as
  a floor, and there is a test pinning it.

### Text similarity cannot cluster headlines, at any threshold

The clustering design changed because of one measurement. On a real openFDA
recall title, 11 words:

```
 shingle size   one-word rewrite   a DIFFERENT firm, same wording   unrelated
     n=2             0.667                    0.615                   0.000
     n=3             0.500                    0.583                   0.000
     n=5             0.167                    0.500                   0.000
```

Two things follow.

Five-word shingles are useless on this text: a one-word rewrite scores 0.167,
indistinguishable from unrelated. There are seven shingles and one changed word
destroys five of them. Shingle width now adapts to document length, and the
SimHash prefilter is skipped below twenty features because its Hamming distance
carries no information there — it had been rejecting genuine rewrites before
Jaccard ever ran.

More importantly: **at every width, a different firm's identically-worded recall
scores as similar as a genuine rewrite.** There is no threshold between 0.615 and
0.667 that is not an accident of the example. So the entity constraint is not a
refinement on top of text similarity — it is the part that works, and the
threshold sits where it deliberately under-merges. Under-merging costs a
duplicate alert and an under-counted independence score; over-merging loses a
disruption and does so invisibly. The measurement is pinned in the test file so a
future change cannot quietly invalidate the prose.

### Two feeds from one agency are one source

openFDA's enforcement endpoint and its shortages endpoint are different URLs,
different schemas, and the same organisation publishing on the same authority.
Counting them as two would satisfy the two-source rule with one source saying
something twice — and it would look exactly like corroboration.

`independenceKey` maps every agency source to the agency: both openFDA endpoints
key to `fda.gov`. The count's explanation says _"2 observations collapsed to 1
source: 1 came from a publisher already counted"_, because "1 independent source"
alone is ambiguous between "one feed answered" and "two answered and were
correctly counted as one".

One limitation is stated rather than solved: thehindu.com and
thehindubusinessline.com are the same publisher and count as two. Fixing it needs
a media-ownership dataset that is not open data in any citable form. The gap is
in `shareOwnership`, in the module README, and every alert names its domains so a
reader can spot the case.

### The corroboration budget is load-bearing, so it is visible

One targeted GDELT query per cluster, at 5 seconds minimum spacing and about 20
seconds per response, is fifteen minutes over forty clusters. An operator who
clicks Verify and waits fifteen minutes does not click it again.

So there is a budget of eight queries per run, spent highest-severity-first, plus
a per-run breaker: once the source fails, the rest are skipped rather than each
burning four retries on the same failure.

Both are **reported**. Clusters beyond the budget are recorded as _"corroboration
was NOT ATTEMPTED"_ rather than as _"no corroboration found"_ — nobody looked,
which is a different statement from having looked and found nothing. The first
version of the outcome note got this wrong: it counted only budget-exhausted
clusters, so during a run where GDELT 429'd after the first query it claimed
_"every cluster that had an entity to search on was corroborated"_. Reassuring
and false.

### The corroboration query was a guaranteed miss

The first version joined the firm and the drug:

```
"Fresenius Kabi USA, LLC" "TOCILIZUMAB-AAZG"
```

That is an implicit AND, and almost no article names both a corporate entity in
full and an INN in capitals. It looked like a targeted query and behaved like a
guaranteed zero. It now asks _did anyone else report an event of this kind at
this entity_ — the entity with its corporate suffix stripped, AND any one of
recall / shortage / contamination / halt / suspend / shut — which is narrow
enough that a quarterly-earnings article does not corroborate a recall.

### Two multi-tenancy bugs, both invisible with one tenant

**A sparse index that indexed everything.** `oauth_subject` had
`{unique: true, sparse: true}` and `default: null`. A sparse index skips
documents where the field is _absent_; the default meant it was always present.
So every password account indexed `null` and the **second** one failed with a
duplicate key — a bug that can only appear on a deployment's second user, which
is exactly when nobody is looking. It is a partial index on `$type: 'string'`
now.

**A derived id that was not tenant-scoped.** Raw signal `_id` was
`openfda_enforcement:D-0785-2026`, derived from the source's own identifier so
that re-ingestion is idempotent. That string is identical for every tenant, so
the second organisation's insert failed on the unique `_id` — and the upsert
filter `{_id, org_id}` could never match the first org's document, so it never
became an update either. One tenant could ingest and everybody else got a
duplicate-key error. The stored key is now `<org>:<external id>`, with the
source's identifier kept in `external_id`; nothing above the repository sees the
prefix.

Found because the CLI scripts had been writing to a hardcoded org called `cli`
while the UI signed in as a real one — which was itself the third instance of the
same class of mistake, and is why `scripts/cli-org.ts` now resolves the org the
way a user would.

**Deferred:** the LLM extraction arm. `ANTHROPIC_API_KEY` is unset, and the two
structured sources need no model at all — openFDA publishes `recalling_firm` and
`classification` as _fields_. GDELT headlines get keyword extraction, labelled
`KEYWORD` on every row with the basis recorded, because GDELT's DOC API returns
no article body and a title is the entire input available to any extractor.

---

## Phase 13 — SIMULATE and DECIDE

**Gate:** a joint (sourcing × logistics) matrix, a Pareto front, and a ranking
whose weights are visible.

**Status:** passing, end to end against a live cascade and a live recommendation:

```
$ npm run decide -- cascade-8eeb03d9-… drug:heparin-sodium logrec-2709c744-…

PARETO FRONT (3 of 5 rows — no weights, no opinion)
CHOSEN: Buy from an already-qualified alternate supplier via Mock Air Freight
```

### Two answers, and only one of them is an opinion

The Pareto front is a _fact_ about the options: a dominated scenario is no better
on any axis and worse on at least one, so it can be discarded with no judgement
at all. Four of seven rows were dominated on the first live run.

Picking one point off the front requires saying how many rupees a day of shortage
is worth, which nobody can derive. So the weights are configuration, stored with
the answer, and every scenario's objective value is stored with its per-term
breakdown. An operator who disagrees looks at the front and picks differently.

### Min-max normalisation amplifies a trivial spread

Worth recording because it will mislead anyone reading a ranking. On the live
run the exposures were 0.0184 and 0.0028 — one and a half percentage points
apart — and normalisation turned them into 1.000 and 0.000. The shortage term
then decided the whole objective on that spread.

The behaviour is correct for _which of these is best_ and misleading for _how
much does this matter_. Which is why the raw value sits beside the normalised one
in every stored breakdown and in the UI, and why the front is shown next to the
ranking rather than instead of it.

### Doing nothing does not recover instantly

The recovery term fell back to an intervention's lead time when the reliability
model had no figure — and DO_NOTHING has a lead time of zero. The baseline was
reported as recovering in **zero days**, flattering it on the one axis where it
is worst. It now uses the shock's own duration from the cascade request.

### An `as` cast is not a mapping

The repository read `doc.scenarios as Scenario[]` and `doc.pareto_front as
ParetoPoint[]`. Both compiled; both were wrong, because the writer stores those
in snake_case. Every read produced objects whose fields were all `undefined` and
whose type claimed otherwise, surfacing three layers away as `Cannot read
properties of undefined (reading 'toFixed')`. There are explicit mappers now.

**Solver:** exhaustive enumeration, and not as a placeholder. The matrix is
capped at fifty rows; enumerating fifty and taking the minimum is exact and
faster than building a CP-SAT model. `solver` and `solver_status` record which
ran, so a future switch is visible in the data rather than silent.

---

## Phase 14 — The control tower

**Gate:** every stage visible in a browser, every number carrying its tag, every
gap explaining itself.

**Status:** passing. `npm run dev:web`, five tabs in loop order, and a production
build at 58 kB gzipped.

The covenant is enforced in the browser the same way it is on the server:
`<QuantityValue>` takes a `Quantity` and has no prop that accepts a bare number,
so rendering an unsourced figure is a type error. `<UnavailableValue>` renders
_"not available — why?"_ with the reason on hover — never a zero and never a
dash, because "zero facilities at risk" and "unknown facilities at risk" are
opposite claims and a dash makes the reader guess.

Three deliberate non-uses, each recorded in the file that does not use it:
`react-router` (five views, no deep links yet), `@tanstack/react-query` (load
once, reload on a button, no cache graph to coordinate), and
`eslint-plugin-react-hooks` (its one rule would need suppressing in the one place
the pattern is correct).

**One lint config change, argued rather than assumed.** `max-lines-per-function`
is off for `.tsx` and `complexity` is raised to 20 there — but only there.
Cyclomatic complexity in a component counts _display_ branches, and almost every
one is `value === null ? "not available — why?" : <Value/>`. Those ternaries
exist because this UI refuses to render a missing value as a zero, so the rule
was penalising precisely the property the project cares about most. It stays at
10 for `.ts`, where a branch is logic.

**Two tsconfig fixes.** `apps/api` and `apps/workers` both globbed
`packages/*/src/**/*.ts`, which swept in `packages/ui` — a React package — and
failed their typechecks on a browser dependency neither will ever import. The
packages are listed by name now.
