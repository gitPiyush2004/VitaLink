# ADR-0011: Graph edges are oriented along supply flow, not along the relation's English reading

- Status: accepted, and it contradicts the specification's diagram
- Date: 2026-09-09

## Context

The specification's stage-3 diagram writes the manufacturer relation as:

```
drug --MADE_BY--> manufacturer
```

which is how the phrase reads in English: the drug is made by the manufacturer.
The cascade, meanwhile, "pins the alert to a node, then propagates **forward**
accumulating along every path".

## The problem, as found

Those two statements are incompatible, and running the system is what showed it.
A cascade from `manufacturer:hospira-inc` — a real node, built from live openFDA
data, and a firm that labels four of the eight seed drugs — returned:

```
The shock at manufacturer:hospira-inc reaches no drug in the current graph.
```

Forward traversal from a manufacturer had no outbound edge to follow, because
every `MADE_BY` edge pointed _into_ it.

That is not an edge case. It is the most common real disruption in the whole
system: openFDA's `drug/enforcement` reports name a `recalling_firm`, so a
manufacturer is precisely where an alert lands. A cascade engine that cannot
propagate from a manufacturer cannot process the majority of its own inputs.

## Options considered

**Keep the spec's direction and make the traversal relation-aware**, following
some relations forward and others backward. Rejected: it puts the flow semantics
in the traversal code, where nobody reading the graph — in the database, in the
graph explorer, in a Cytoscape render — can see them. Two people would then
disagree about which way an edge "really" points, and both would be right.

**Add reverse edges for every relation.** Rejected: it doubles the edge count,
makes path enumeration find each path twice, and leaves the exposure sum
double-counting unless the traversal filters by direction anyway.

**Orient every edge along the direction supply flows.** Accepted.

## Decision

Every edge in the graph points the way supply moves. Supply flows from the
manufacturer into the drug, so the edge is stored:

```
manufacturer --MADE_BY--> drug
```

The relation name is kept as `MADE_BY` because it is in the specification's
`EDGE_RELATIONS` enum and in `packages/contracts`, and changing a contract enum to
fix an orientation would be the wrong lever. The orientation rule is stated at the
top of `modules/graph/domain/build-graph.ts` and again on the function that builds
these edges.

## Consequences

- A shock at a manufacturer now reaches its drugs. Hospira propagates to
  methotrexate, vancomycin, atropine and heparin, each with the manufacturer's
  real listing share as the edge weight.
- **`MADE_BY` reads oddly as English in that direction.** That is the cost, and
  it is why the rule is documented in three places rather than assumed.
- The graph is a _flow_ graph, not a description of relationships. Anyone adding
  a relation must ask "which way does supply move?" and not "how does the phrase
  read?".
- Existing `MADE_BY` edges from before this change are orphans, since the edge id
  is `src|REL|dst`. They were deleted explicitly, along with the cascades computed
  on them, rather than left to accumulate as unreachable rows.

## What would reverse this decision

Nothing about the data. If the specification's diagram is treated as normative for
the _stored_ direction, then the traversal has to become relation-aware and this
ADR is the record of what that would cost.
