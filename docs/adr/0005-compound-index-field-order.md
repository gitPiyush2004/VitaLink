# ADR-0005: Compound index field order, and why each index exists

- Status: accepted
- Date: 2026-09-08

## Context

The spec requires that every compound index be justified, with its field order
explained (PART 3A.7). MongoDB can only use a compound index efficiently when the
query's equality predicates come before its sort — the "equality, sort, range"
rule — so field order is behaviour, not style.

## Decision

Indexes are declared in the Mongoose schema file, never created ad hoc in
application code, and each one is justified here.

### `users`

| Index                                | Why                                                                                                                                                        | Order reasoning                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ email: 1 }` unique                | Every login looks up by email; uniqueness must be enforced by the database, not by a service-level "does this exist?" check, which races under concurrency | single field                                                                                                                                     |
| `{ org_id: 1, created_at: -1 }`      | The admin screen lists one org's members, newest first                                                                                                     | equality field (`org_id`) before the sort field (`created_at`), so the index satisfies both the filter and the sort with no in-memory sort stage |
| `{ oauth_subject: 1 }` unique sparse | OIDC callback resolves a user by subject                                                                                                                   | **sparse**, because most users have no OAuth subject and a non-sparse unique index would reject the second `null`                                |

Note there is deliberately **no** `unique: true` on the `email` field definition
itself. Declaring it in both places produces a duplicate-index warning at boot and
two sources of truth for one fact. This was caught by the first API boot.

### `orgs`

| Index                  | Why                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `{ email_domains: 1 }` | Google sign-in resolves an org from the user's verified email domain on every sign-in. A multikey index over the array. |

## Consequences

- Indexes are visible next to the schema they belong to.
- `mongoose.set('autoIndex', false)` is set globally, so Mongoose does not create
  indexes implicitly at model-compile time. `syncIndexes()` is called explicitly
  at boot in development and test, and is deliberately **not** automatic in
  production, because `syncIndexes` drops indexes that are no longer declared and
  building an index on a live collection is an operational decision.
- Every future index added to this project gets a row in this file, or it does not
  get merged.
