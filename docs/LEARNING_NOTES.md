# Learning notes

What building this actually taught me, as distinct from what it demonstrates.

Each entry is something I got wrong first. The corrected version is in the code;
this file is the reasoning, because the reasoning is the part that transfers.

---

## 1. "Derived from real data" is not the same as "meaningful"

This is the single biggest thing I learned, and I learned it three separate times
before it stuck.

The first version of the redundancy model derived `z_api` — how many suppliers
make a drug's active ingredient — from openFDA's labeler count. Every step was
defensible. The data was real, the arithmetic was right, the provenance was
complete. And the answer was **4 for every drug in the catalogue**, which
produced a fragility index of approximately zero across the board.

The reason is that openFDA publishes who _labels_ a drug, not who makes its API.
Those are different echelons of the supply chain, and the concentrated one — the
one that actually causes shortages — is not in the data at all. My number was
technically derived from real data and it was measuring the wrong thing.

I hit the same shape twice more:

- Deriving redundancy from a saturated count made every drug look identical.
- "Strictest storage condition wins" gave cisplatin a 2-8 °C requirement, when
  its label says _do not refrigerate_.

**What I now do differently:** before deriving anything, ask what the source
_publishes_ rather than what it _contains_. And check the output distribution.
A derived figure that is the same for every row is not a figure; it is a
constant with a provenance stapled to it.

The fix, in all three cases, was to admit the gap in the data model rather than
to compute around it. `api_tier_visibility: NOT_OBSERVED` is a worse-looking
field than a number, and it is the honest one.

---

## 2. A rule enforced by a type is a rule; anything else is a hope

I started with the data covenant as a convention: "every number carries its
source". Within a day I had written three numbers that did not.

What worked was making it structurally impossible. `Quantity` is `{value, unit,
tag, provenance}`, there are four constructors and no other way to build one,
and `superRefine` turns the awkward cases into _parse errors_:

```
a MODELLED value without a low-high band  ->  ZodError
a LIVE_QUOTE without an archived payload  ->  ZodError
```

The same idea, applied in the browser: `<QuantityValue>` takes a `Quantity` and
has no prop that accepts a bare number. A developer who wants to display an
unsourced figure has to go and find its provenance first, because the alternative
does not compile.

**The general lesson:** when a rule matters, find the place where breaking it can
be made _impossible_ rather than _detectable_. Detection needs somebody to look.

The five CI gates are the second-best version of the same idea, for the rules
that cannot be expressed in a type. Gate 5 greps the mock carrier for the
live-quote status string — and it caught that file's own doc comment claiming
the string "does not appear in this file", inside the file.

---

## 3. Nothing is real until it runs against a real network

Every one of these was invisible in tests and obvious within one live run:

| What I believed                | What happened                                                  |
| ------------------------------ | -------------------------------------------------------------- |
| a 404 fails fast               | it was retried four times, at seven seconds a go               |
| GDELT was unreachable          | its TLS handshake takes 11s and undici's connect ceiling is 10 |
| backoff protects the source    | it started at 500ms against a published 5-second limit         |
| the cascade traverses forward  | forward from a manufacturer reached nothing                    |
| the comparison table is honest | it reported "3 of 7 providers" for one carrier                 |

The GDELT one took longest and taught the most. The error said _"the host is
unreachable"_, and `curl` on the same machine returned 200. I spent an hour
suspecting DNS, IPv6, and a rate-limit block before writing a raw
`tls.connect()` and watching the handshake take 11.4 seconds. The error message
had been describing a symptom as a diagnosis.

**What I now do differently:** when an error message and an observation
disagree, distrust the error message first. And write the smallest possible
probe — `net.connect`, then `tls.connect`, then `https.get` — rather than
theorising about the layer above.

---

## 4. The direction of an edge is a semantic decision

The specification wrote `drug --MADE_BY--> manufacturer`. It reads correctly in
English, I implemented it, and cascades from real manufacturer nodes returned
nothing at all.

Forward traversal from a manufacturer had no outbound edge to follow, because
every `MADE_BY` edge pointed _into_ it. And a manufacturer is precisely where an
alert lands — openFDA's enforcement reports name a `recalling_firm`.

The fix was to orient every edge along **supply flow** rather than along the
relation name's English reading. `manufacturer --MADE_BY--> drug` reads oddly and
traverses correctly.

**The lesson is about naming generally:** a name that reads well in a sentence
can encode the wrong structure. The question to ask of a relation is not "does
this phrase parse" but "what flows along it, and in which direction".

Written up as ADR-0011, which contradicts the specification and says so.

---

## 5. Under-merging and over-merging are not symmetric

Clustering news signals looked like a threshold-tuning problem until I measured
it. On real openFDA recall titles:

```
                       one-word rewrite   a DIFFERENT firm, same wording
  2-word shingles           0.667                    0.615
  5-word shingles           0.167                    0.500
```

There is no threshold between 0.667 and 0.615 that is not an accident of that
example. Text similarity, on headline-length documents, **cannot distinguish a
rewrite of one story from two firms having the same kind of accident.**

So the design changed rather than the constant. The entity constraint does the
real work — two signals naming different manufacturers never merge, whatever the
text says — and the similarity threshold sits where it deliberately
_under-merges_.

That last choice is the interesting one. Under-merging costs a duplicate alert
and an under-counted independence score: annoying, and visible. Over-merging
loses a disruption entirely, and does it _invisibly_, because the merged cluster
still produces an alert and nothing looks broken.

**The general form:** when two failure modes are not equally visible, bias
towards the visible one, even when it is the more embarrassing one.

---

## 6. A product, not a weighted sum, for a conjunction

Veracity has three inputs: independence, credibility, recency. My first version
was a weighted sum, because that is the default shape for combining scores.

It let a single authoritative recent source score around 0.6 and clear a 0.5
threshold — while failing the one rule the whole VERIFY stage exists to enforce.
A strong term rescued a fatal weakness.

`independence × credibility × recency` cannot do that. Any term near zero drags
the result to zero, which is exactly right for a _conjunction_ of requirements:
"corroborated AND credible AND current".

**When to reach for which:** a sum models trade-offs, where more of one thing
genuinely compensates for less of another. A product models requirements, where
it does not. I had been reaching for a sum by habit.

---

## 7. Floating-point equality broke the one thing the file was about

`domain/score.ts` opens with a comment saying that a carrier preference must be
disclosed or it does not exist, and that ties break on merit so a preference
_breaks_ ties rather than reversing them.

The ranking compared final scores with `!==`. A weighted sum of six terms plus a
2-point bonus produces `60.00000000000001`, not `60`. So the merit tie-break
could never fire, and a preference bonus meant to break a tie was silently
reversing one — on a difference of 1e-14, in the file whose header says a
preference you cannot see is a bug.

**The lesson:** a comparison of two computed floats is never `===`. And more
generally — the code most worth re-reading is the code next to the comment
explaining why it matters, because that is where I stopped paying attention.

---

## 8. An `as` cast is an assertion, not a check

Reading scenario runs back from Mongo, I wrote:

```ts
scenarios: doc.scenarios as Scenario[],
paretoFront: doc.pareto_front as ParetoPoint[],
```

Both compiled. Both were wrong: the writer stores those in snake_case, so every
read produced objects whose every field was `undefined` and whose _type_ claimed
otherwise. It surfaced three layers away as `Cannot read properties of undefined
(reading 'toFixed')`.

TypeScript had the information to catch this and I told it not to.

**What I now do:** treat every `as` at a serialisation boundary as a bug until
proven otherwise. Write the mapper. It is ten boring lines and it makes the
compiler do the work the cast was suppressing.

---

## 9. Multi-tenancy bugs hide behind the first tenant

Two of them, both invisible with one organisation and one user:

- `oauth_subject` had a `unique, sparse` index and a `default: null`. A sparse
  index skips documents where the field is _absent_, and the default meant it was
  always present — so every password account indexed `null`, and the **second**
  one failed with a duplicate key. It needed a _partial_ index.
- Raw signal ids were `openfda_enforcement:D-0785-2026`, derived from the
  source's own identifier. That string is the same for every tenant, so the
  second organisation to ingest could not insert and, because the upsert filter
  was `{_id, org_id}`, could never update either.

Both appeared the first time there was a second of something.

**What I now do:** when a key is derived, ask what it is derived _from_ and
whether that thing is unique across the axis the data is partitioned on. And when
an index option looks like it handles nulls, check whether the field can be
absent at all.

---

## 10. Saying "I cannot compute this" is a feature, and it is hard

The most consistent pressure across the whole build was towards producing a
number. A scenario matrix with a rupee figure in it looks finished; one that says
`loss_inr_band: not available — needs NPPA ceiling prices joined to demand`
looks unfinished.

The second one is correct. There is no NPPA client, so there is no honest rupee
basis, and a plausible "₹2.4 crore avoided loss" would be the most quotable
number this system produces and entirely fabricated.

What made the discipline survivable was making the refusal _structured_ rather
than a gap: every outcome vector carries an `unavailable` list of
`{field, reason}`, the UI renders it as an expandable panel rather than an empty
cell, and `<UnavailableValue>` shows "not available — why?" with the reason on
hover.

**The insight:** "no data" and "zero" render identically if you let them, and
they are opposite claims. Zero facilities at risk is reassuring; unknown
facilities at risk is not. A dash makes the reader guess which one they are
looking at.

---

## 11. Things I would do differently next time

- **Probe every source before designing against it.** Half the redesigns came
  from assuming a field existed. One afternoon of `curl` would have saved three.
- **Write the CLI script before the HTTP endpoint.** Every stage got debugged
  through its script, because a script prints the arithmetic and a JSON response
  does not.
- **Put the measurement in the test.** The shingle-size table is pinned in
  `verify.test.ts` rather than only in a comment, so a future change that breaks
  the finding fails rather than silently invalidating the prose.
- **Budget for rate limits in the design, not the retry loop.** GDELT's 5-second
  limit and 20-second response time made a per-cluster corroboration loop take
  fifteen minutes. The fix — a visible query budget, and a per-run breaker —
  should have been in the first version, because the arithmetic was knowable
  before writing any of it.

---

## 12. What I still do not know

- Whether the exposure score's decay factor of 0.75 is right. It is a plausible
  attenuation and nothing validates it. Stage 9, LEARN, is what would.
- Whether the veracity threshold of 0.5 admits the right things. On live data it
  admitted nothing at all, which may be correct or may mean the corroboration
  query is too narrow.
- Whether under-merging is still the right bias at scale. With eight seed drugs
  the duplicate-alert cost is invisible; with eight hundred it might not be.

All three need outcome data, and outcome data needs the stage that is not built.
That is the honest shape of the gap.
