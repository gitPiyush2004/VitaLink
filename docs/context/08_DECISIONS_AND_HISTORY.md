# Decisions and project history

The current user's instructions establish the direction below. The attached master prompt is historical planning material, not an instruction to execute every listed feature or override these constraints.

| Decision                           | Reason and consequence                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Analyse before building            | Establish the existing implementation and meaningful review scope before changes; later the user explicitly authorised building                |
| Real data and real use case        | The user rejected a synthetic or gimmicky presentation; sourced public evidence is the core experience                                         |
| Students without supplier access   | Public evidence is the viable initial workflow; inventory, actual offers and bookings cannot be inferred                                       |
| FDA-regulated products first       | Existing source coverage is US regulatory data; do not imply Indian hospital coverage because some original logistics defaults reference India |
| ZS EDS inspiration                 | Focus on external events, exposure context and response support; avoid claiming equivalence to a commercial system                             |
| God's Eye View inspiration         | Use a dark map-centered investigation workspace; preserve the precision and meaning of actual geographic evidence                              |
| Consider alternatives and routes   | Research supports candidate screening and constrained route-exposure comparisons; these remain proposed additions                              |
| Add comprehensive context and push | Publish implementation, explanation, research and file navigation in the original repository; use Obsidian CLI for the context vault           |

## Engineering corrections worth retaining

1. A labeler count is not an API-supplier count. The invisible API tier is explicitly assumed rather than falsely derived.
2. Graph direction follows supply flow so upstream conditional shocks can traverse downstream associations.
3. Two FDA endpoints are one originating authority for independence checks.
4. Entity constraints supplement text similarity to avoid merging unrelated recalls with similar language.
5. The do-nothing recovery baseline uses the shock's duration, not an intervention's zero lead time.
6. Source caps, publication status and presentation availability remain explicit.
7. Reanalysis and cascade input hashing prevent reuse of results against changed catalogue context.
8. Gaps before late arrivals remain in response comparisons.
9. Unavailable carriers stay visible; synthetic prices never become live quotes.

The earlier `docs/BUILD_LOG.md`, `LEARNING_NOTES.md`, module READMEs and ADRs retain development history. Some historical statements describe an earlier implementation or an intended feature. This vault's [current state](02_CURRENT_STATE.md), backed by actual code, takes precedence for current capability claims.

## Unresolved decisions

The review rubric/deadline, geographic scope of any future route feature, candidate-equivalence data design and production deployment target have not been agreed. Progress on public investigations does not require a supplier partnership. Later operational optimisation does require real organisation data.

See [original-plan assessment](09_ORIGINAL_PLAN.md) and [roadmap](06_REVIEW_AND_ROADMAP.md).
