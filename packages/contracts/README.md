# `@vitalink/contracts`

## What this is

Every schema in Vitalink, defined once with [zod](https://zod.dev), and the
TypeScript types inferred from those schemas.

## Why it exists

Four runtimes have to agree on the same shapes: the React app, the Express API,
the BullMQ workers, and the Python compute service. Without a single source of
truth they drift, and the drift shows up as a runtime error in the demo rather
than a type error at build time.

The React app, the API and the workers import these schemas directly. The Python
service mirrors them as pydantic v2 models in `apps/brain/app/schemas.py`, and a
contract test compares the two so the mirror cannot rot silently.

## How it is laid out

| File             | Contents                                                                     |
| ---------------- | ---------------------------------------------------------------------------- |
| `provenance.ts`  | **Read this first.** The `Quantity` envelope and the four provenance tags.   |
| `enums.ts`       | Every closed vocabulary: roles, scopes, node types, quote statuses, urgency. |
| `common.ts`      | Response envelope, cursor pagination, GeoJSON point, error codes.            |
| `catalog.ts`     | Drugs, ingredients, manufacturers, facilities, hubs, lanes, districts.       |
| `graph.ts`       | Graph nodes and edges, per-drug structural metrics, propagation paths.       |
| `signals.ts`     | `RawSignal`, LLM `Extraction`, `VerifiedAlert`, quarantine records.          |
| `reliability.ts` | The Tucker & Daskin model's input and output contract.                       |
| `cascade.ts`     | Cascade requests, exposed drugs, cover projections.                          |
| `logistics.ts`   | Shipment requests, carrier capabilities, quotes, eligibility, scoring.       |
| `scenarios.ts`   | Joint (sourcing x logistics) scenarios, outcome vectors, recommendations.    |
| `events.ts`      | Event names, payloads, queue names, and the `EventBus` interface.            |
| `auth.ts`        | Login, OAuth and access-token claim shapes.                                  |

## The one thing to understand

`provenance.ts` does not just _describe_ the data covenant, it _enforces_ it. The
`superRefine` on `quantitySchema` means:

- a `DERIVED` value without a `calculation_method` will not parse
- a `MODELLED` value without assumptions, a confidence and a low-high band will
  not parse

So "every number carries its source" is a validation failure rather than a
convention someone has to remember. Same idea in `logistics.ts`: a `LIVE_QUOTE`
without an archived raw carrier payload will not parse, because without one it
cannot be told apart from a fabrication.

## Adding a schema

1. Add it to the file whose concern it belongs to (or create a new file for a new
   concern, and export it from `index.ts`).
2. If the Python service uses it, mirror it in `apps/brain/app/schemas.py`.
3. Numbers are `quantitySchema`, never `z.number()`. If you find yourself wanting
   a bare number on a persisted document, that is the covenant telling you the
   number has no source yet.
