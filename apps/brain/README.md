# `apps/brain` — the compute service

## What this is

CPU-bound numerical work: the reliability model today, and optimisation and ML
later. Python, because that is where numpy, scipy, networkx, OR-Tools and
scikit-learn live.

## Why it is separate

Not because "microservices are good architecture" (ADR-0006). Two concrete
reasons:

1. **Dependency isolation.** The numerical stack cannot live inside a Node
   process, and reimplementing the Tucker & Daskin model in TypeScript would make
   reproducing the paper's published table harder to trust, not easier.
2. **It is stateless, and structurally so.** Look at `requirements.txt`: there is
   no database driver. There is no `MONGO_URI` in its Docker Compose environment
   either, and that absence is commented. State arrives in the request and leaves
   in the response. The API is the single owner of truth, and this service cannot
   quietly become a second one.

## Layout

```
app/
├─ main.py       FastAPI assembly. Nothing else.
├─ config.py     tiny, because a stateless service needs almost no config
├─ schemas.py    pydantic v2 mirror of packages/contracts
├─ routers/      HTTP only: parse, call a service, return
├─ services/     wraps pure results in provenance envelopes
└─ domain/
   ├─ reliability.py       ← read this first. The paper's equations.
   ├─ paper_baseline.py    the paper's published parametrisation, kept separate
   └─ rate_estimation.py   fitting lambda and mu from openFDA history
tests/
├─ test_reliability.py     ← CI GATE 4
├─ test_rate_estimation.py
└─ test_reliability_api.py
```

## The one file to read: `domain/reliability.py`

It implements Tucker, E. L. and Daskin, M. S. (2021), _Pharmaceutical Supply
Chain Reliability and Effects on Drug Shortages_, arXiv:2107.09167.

Three echelons in series, each internally redundant:

| Echelon          | Redundancy            | Baseline MTBF | Baseline recovery |
| ---------------- | --------------------- | ------------- | ----------------- |
| API suppliers    | `z_api` in parallel   | 17.3 y        | 1.2 y             |
| Plants           | `z_plant` in parallel | 28.2 y        | 0.8 y             |
| Lines, per plant | `z_line` in parallel  | 8.5 y         | 0.08 y            |

```
p     = lam / (lam + mu)                                    eq. 1
r_api = 1 - p_api ** z_api                                  eq. 2
r_pl  = 1 - [ p_p + (1 - p_p) * p_l ** z_line ] ** z_plant  eq. 3
r     = r_api * r_pl                                        eq. 4
s     = 1 - r
D     = U / r - U                                           eq. 6
Fragility Index = 100 * s
```

Every function is pure: no I/O, no clock, no randomness, no FastAPI import. That
is what lets GATE 4 be arrange-act-assert over plain floats with no fixtures and
no mocks.

## CI GATE 4

```bash
npm run gate:reliability          # from the repo root
python -m pytest tests/test_reliability.py -q   # from here
```

It reproduces the paper's published configuration table:

| `(z_api, z_plant, z_line)` | Computed `s` | Paper publishes |
| -------------------------- | ------------ | --------------- |
| (1, 1, 1)                  | 9.914 %      | 10 %            |
| (2, 1, 1)                  | 4.071 %      | 4 %             |
| (2, 2, 1)                  | 0.555 %      | 1 %             |

The tolerance is half a percentage point — the rounding interval of figures
quoted to the nearest whole percent, not a number chosen to make the test pass.
The exact computed values are pinned separately at 1e-7, so a refactor that
shifted the arithmetic by a tenth of a percentage point would fail even though it
would still round correctly. The (2,2,1) row is the largest gap and has its own
test saying so out loud rather than hiding behind the tolerance.

The test file also asserts things the paper does not: monotonicity in every
redundancy count, that a second **supplier** helps more than a second **line**
(the paper's substantive finding, and the reason this model beats an ad-hoc
weighted risk score), and the eq. 6 identity in both directions as a cross-check
on the derived uptime.

## What is transcribed and what is derived

Stated here because the distinction matters more than the code.

**Transcribed from the paper** (via the project specification, which quotes them):
equations 1–4, the eq. 6 relation, and the baseline parametrisation table.

**Derived, not transcribed:** mean uptime. The paper's full text was not
accessible during the build, so rather than guess at its closed form, `U` is
computed by the frequency–duration method of classical reliability theory — the
system's up-to-down transition frequency `nu` is computed directly, then
`U = r / nu`. The paper's own `D = U/r - U` then holds as an identity, and
`test_reliability.py` asserts it, which is a real consistency check rather than a
restatement. This is repeated in `docs/MODEL_CARDS.md` and belongs in the
report's methodology, not in a footnote.

## Honest limitations, restated on every number

These are attached to each returned `Quantity`'s `assumptions`, so they travel
with a figure into a screenshot or a slide:

- **Echelons are assumed independent.** The model's strongest assumption. In
  reality one shock can hit a supplier and a plant together — which is precisely
  the correlated failure the cascade engine models separately.
- **Lifetimes are assumed exponential.** Constant hazard rate. The reason
  `estimate_repair_rate` fits an exponential too: matching the fit's distribution
  to the model's is more important than fitting a better-shaped one and then
  feeding it to a model that cannot use it.
- **`z_api` counts the observable market, not API manufacturers.** No free source
  publishes API-supplier counts. See the Phase 1 entry in `docs/BUILD_LOG.md`:
  heparin sodium has 47 distinct openFDA labelers, repackagers included, and using
  that raw number would report near-zero fragility for a drug that has been in
  recorded shortage.
- **`mu` is fitted only from resolved shortages, so it is optimistic.** Ongoing
  shortages have no duration yet, and they are by definition the long ones. The
  survivorship bias pushes repair rates up and Fragility Index down.
- **Plant and line rates always fall back to the paper's baseline.** There is no
  public series of plant or line failure events at all. Every response says so in
  `rate_origins`, per rate, rather than presenting six equally-trustworthy numbers.

## Running it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest -q
ruff check . && ruff format --check . && mypy app
```
