# `@vitalink/connectors` — the only egress point

## What this is

Every outbound HTTP request in Vitalink. Public data sources today, carrier APIs
from the logistics phase onward. Nothing else in the system is allowed to make a
network call.

## Why it exists

Spec Rule 3. But the reason behind the rule is Rule 1: every number Vitalink
stores has to carry its source, the exact query that produced it, and the instant
it was fetched. If a `fetch` could happen anywhere, a number could arrive without
those, and the whole data covenant would rest on nobody forgetting.

So `getJson` returns a `Fetched<T>`:

```ts
type Fetched<T> = {
  data: T;
  provenance: Provenance; // source_name, source_url, query, fetched_at
  fromCache: boolean;
  rawBody: string; // kept so a LIVE_QUOTE can be proved
};
```

**A caller cannot obtain the data without also obtaining the provenance for it.**
That is the single idea in this package. It turns "every number carries its
source" from a convention into a property of the type system.

CI gate 3 (`npm run gate:no-http`) fails the build on a `fetch`, `axios`, `got`,
`undici` or `superagent` anywhere outside this directory.

## What the client does, in order

1. builds a deterministic cache key: `sha256(sourceId + url)`, truncated
2. returns a fresh cached response, without touching the network
3. waits its turn under the source's **published** rate limit
4. fetches, retrying on 429 and 5xx only
5. validates the body against a zod schema, then attaches provenance

## Layout

```
src/
├─ http/
│  ├─ cached-client.ts    ← read this first. The single egress point.
│  ├─ rate-limiter.ts     per-source request spacing
│  ├─ retry.ts            backoff schedule and Retry-After handling
│  ├─ connector-error.ts  one error type, with a `kind` callers switch on
│  └─ ports.ts            the injected cache, clock, sleeper and logger
├─ sources/
│  ├─ source-registry.ts  ← the table of every source, its limit and its TTL
│  ├─ openfda.client.ts   NDC, label, enforcement, shortages
│  ├─ gdelt.client.ts     live news, and the domain that makes corroboration real
│  ├─ comtrade.client.ts  trade shares, which become SOURCED_FROM edge weights
│  ├─ geo.client.ts       Nominatim geocoding, OSRM routing
│  └─ hazard.client.ts    Open-Meteo temperature, USGS seismicity
└─ carriers/              carrier adapters (logistics phase)
```

## Decisions worth defending

**Dependencies are injected, not imported.** The cache, the clock, the sleeper and
the logger all arrive as interfaces (`http/ports.ts`). Three payoffs: this package
does not depend on Redis or pino; a retry test runs in microseconds because the
sleeper does not sleep; and `fetched_at` is reproducible under test because the
clock is frozen. A timestamp read from `new Date()` deep inside a client is
untestable.

**No jitter on the backoff.** The conventional advice is to randomise so that
recovering clients do not synchronise. It is absent for two reasons: the data
covenant forbids a PRNG in runtime code, and there is nothing to de-correlate —
ingestion runs as one worker per queue behind a per-source rate limiter. Jitter
would buy nothing and cost the determinism that makes `backoffDelayMs(3) === 2000`
a meaningful assertion. ADR-0008.

**4xx is not retried; 429 is.** A 400 or a 404 fails identically next time.
Retrying it turns one wasted request into four. 429 is different: it is the server
explicitly asking us to wait, and `Retry-After` is honoured when present.

**A schema mismatch is a hard failure.** If openFDA changes a field's type, this
package throws `malformed_response` rather than half-parsing the record. A source
that changed shape must fail loudly; silently degraded records look fine right up
to the moment someone reads them.

**Rate limits are the sources' numbers, not ours.** GDELT's five-second interval
is in the registry because GDELT answered a faster caller with HTTP 429 and the
body "Please limit requests to one every 5 seconds". Nominatim's one-per-second
and its contactable-User-Agent requirement are conditions of use. The client
refuses to start with a placeholder email in the User-Agent, because Nominatim
answers those with 403 — which is exactly what the first probe run received.

## Known limitation

The rate limiter is **in-process**. Two worker containers would each get their own
allowance. That is acceptable today because ingestion runs as a single worker per
queue, and the honest fix is one file: move the last-request timestamp into Redis,
which is already a dependency. ADR-0007.

## Verifying it against the real world

```bash
npx tsx --env-file=.env scripts/probe-sources.ts
```

Eleven probes, all real requests, printing what came back and the provenance
attached to it. A source that cannot be reached is reported as `BLOCKED` and
recorded in `docs/BUILD_LOG.md`. **No probe ever fabricates a response.** The
current results, and the three genuine external blockers, are in the build log.

## Adding a source

1. Add a row to `sources/source-registry.ts` with the source's **published** rate
   limit and a TTL derived from its refresh rate. If you are guessing the limit,
   go and read their usage policy first.
2. Add `sources/<name>.client.ts` with a zod schema for only the fields Vitalink
   uses, all of them optional unless the source guarantees them.
3. Add a probe to `scripts/probe-sources.ts` and run it. If it does not return
   live data, say so in the build log rather than working around it.
