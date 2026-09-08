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
