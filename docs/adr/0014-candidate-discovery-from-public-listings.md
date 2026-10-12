# ADR 0014: Discover product candidates from live listings, and never score them

Accepted, 12 October 2026.

An investigation could identify the medicine an FDA event names, but not answer the question that follows it: what else is there? Matching was a verification function over the medicines already ingested, and the local catalogue is a slice of the ingested set, not the market. Discovery therefore queries openFDA directly, by active ingredient, at the moment it is asked.

Drugs@FDA supplies approval records, therapeutic-equivalence codes and marketing status. The Orange Book carries the same codes but publishes them as a downloadable archive, which gate 2 rejects as a bundled dataset; the API is the only form of that evidence this project can hold.

There is no aggregate candidate score. A single number would combine five independent findings — one of which is routinely _unknown_ — into a ranking that reads as confidence. Each attribute keeps its own three-valued verdict, and the ordering is stated: exclusions sink, then confirmed matches, then fewer unknowns. An analyst can see why a product is where it is.

Hard exclusions are stored separately from attribute differences. An expired listing, a bulk ingredient and a route with no overlap disqualify a candidate; a different dosage form or marketing category is a fact to weigh. Collapsing the two would bury the disqualifying ones inside the ordinary ones.

Strength is compared as a normalised concentration, not as text and not as a bare number. `5000 [USP'U]/mL` and `5,000 UNITS/100mL` print the same figure and differ a hundredfold. Where either side cannot be parsed, or the units are not commensurable, the verdict is `unknown` — never `match`. USP Units and International Units are kept in separate families because they are not interchangeable for every substance; unqualified "UNITS" is read as a USP unit only because candidates are compared within one active ingredient.

An absent TE code means no code is published. It is not a finding of non-equivalence and is never rendered as one. Where an application covers several approved products, the code is resolved only when the matching products agree; disagreement withholds it. A shared active ingredient is not therapeutic equivalence, and nothing in this feature asserts substitutability.

Coverage is reported rather than silently capped: retrieval stops at one hundred listings, and the set states that more may exist. Applications skipped by the batch limit are reported separately from applications queried that returned no record — the first was not checked, the second has nothing published. An earlier version conflated distinct applications with listing count and reported a shortfall that did not exist.
