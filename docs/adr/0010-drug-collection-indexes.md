# ADR-0010: Index design for the catalogue and graph collections

- Status: accepted
- Date: 2026-09-09

## Context

PART 3A.7 requires every compound index to be justified with its field order
explained. MongoDB can only use a compound index for both a filter and a sort
when the equality predicates come first — the "equality, sort, range" rule — so
field order is behaviour, not style.

## Decision

Indexes are declared in the schema file, never created in application code, and
each one is justified here.

### `drugs`

| Index                                       | Query it serves                                                           | Order reasoning                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `{ nlem_critical: 1, is_single_source: 1 }` | the fragility board, filtered to critical and/or single-source drugs      | two equality fields; the more selective one (`nlem_critical`) first |
| `{ generic_name: 1 }`                       | the search box, and the ingestion upsert's lookup                         | single field                                                        |
| `{ ingredient_ids: 1 }`                     | resolving an alert's extracted ingredient name to the drugs containing it | multikey over the array                                             |

### `manufacturers`, `ingredients`

| Index                          | Query it serves                                                             |
| ------------------------------ | --------------------------------------------------------------------------- |
| `manufacturers { name: 1 }`    | an alert names a firm as free text; resolving it to a node is a name lookup |
| `manufacturers { country: 1 }` | country-scoped views                                                        |
| `ingredients { name: 1 }`      | same, for substances                                                        |
| `ingredients { hs_codes: 1 }`  | joining UN Comtrade trade rows onto ingredients                             |

### `nodes`

| Index                          | Query it serves                                                       | Reasoning                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ type: 1 }`                  | the map and the fragility board read one node type at a time          |                                                                                                                                            |
| `{ type: 1, label: 1 }`        | resolving an extracted entity name within a type                      | equality on `type` before the lookup on `label`                                                                                            |
| `{ point: '2dsphere' }` sparse | "facilities near this shock" as a geospatial query rather than a scan | **sparse**, because drugs, ingredients and countries have no point, and a non-sparse geospatial index over mostly-null documents is wasted |

### `edges`

| Index                | Query it serves                                                  |
| -------------------- | ---------------------------------------------------------------- |
| `{ src: 1, rel: 1 }` | forward traversal: what does this node lead to, by this relation |
| `{ dst: 1, rel: 1 }` | backward explanation: what reaches this node                     |
| `{ rel: 1 }`         | loading the graph for materialisation, by relation               |

The first two are the difference between a cascade that is a few hundred indexed
lookups and one that scans the whole edge collection once per hop.

### `cascades`

| Index                                     | Query it serves                                         | Reasoning                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `{ org_id: 1, input_hash: 1 }` **unique** | an identical re-run is a cache hit rather than new work | unique _per org_, not globally: two organisations may legitimately run the same analysis, and one must not see the other's result |
| `{ org_id: 1, started_at: -1 }`           | the cascade list, newest first                          | equality field before the sort field, so no in-memory sort stage                                                                  |

## Consequences

- `mongoose.set('autoIndex', false)` is global, so nothing is created implicitly
  at model-compile time. `syncIndexes()` runs explicitly at boot in development
  and test, and deliberately **not** in production, because `syncIndexes` drops
  indexes that are no longer declared.
- Every future index gets a row here, or it does not get merged.
