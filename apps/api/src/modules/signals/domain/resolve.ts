/**
 * Pinning an alert to a node in the supply graph (spec stage 2, entity resolution).
 *
 * This is the join between VERIFY and TRACE. An alert that resolves to a node can
 * be cascaded from; an alert that does not is a headline. So the temptation is to
 * resolve aggressively, and the temptation is exactly wrong: a cascade run from
 * the *wrong* node produces a confident, wholly fictional list of exposed drugs.
 *
 * So the bar is high and the failure mode is "unresolved with a reason".
 *
 * ## Why not fuzzy matching
 *
 * Levenshtein distance over company names matches "Aurobindo Pharma" to
 * "Auromedics Pharma" — two different firms, one of which is a subsidiary of the
 * other, which is worse than no match because it looks right. Instead the match
 * is exact-after-normalisation, plus a containment rule for the case where a
 * source writes a longer form of the same name.
 *
 * `normaliseEntity` from `cluster.ts` does the normalisation, so a name matches
 * here on the same terms it clusters on. One definition of "the same company",
 * not two that can disagree.
 *
 * Pure functions.
 */

import { normaliseEntity } from './cluster';

export type NodeCandidate = {
  nodeId: string;
  label: string;
  type: 'drug' | 'manufacturer' | 'ingredient';
};

export type Resolution = {
  nodeId: string | null;
  /** How the pin was made, or why it could not be. Rendered on the alert. */
  basis: string;
};

/** What resolution reads off an alert's lead signal. */
export type Resolvable = {
  manufacturer: string | null;
  drugOrIngredient: string | null;
};

/**
 * Exact-after-normalisation, then containment in one direction only.
 *
 * Containment is asymmetric on purpose: a *source* naming "Hikma
 * Pharmaceuticals USA" should match the node "Hikma Pharmaceuticals", because
 * the source is being more specific about the same firm. The reverse —
 * a node label containing the source's name — is rejected, because "Pharma"
 * appearing in a source would otherwise match every manufacturer in the graph.
 */
function matches(sourceName: string, nodeLabel: string): 'exact' | 'contained' | null {
  const source = normaliseEntity(sourceName);
  const node = normaliseEntity(nodeLabel);
  if (source === null || node === null) return null;

  if (source === node) return 'exact';

  const MIN_CONTAINMENT_LENGTH = 6;
  if (node.length >= MIN_CONTAINMENT_LENGTH && source.includes(node)) return 'contained';

  return null;
}

/**
 * The verdict when a signal named no entity at all.
 *
 * The ordinary case for a GDELT headline, which is why headline-only clusters
 * are corroboration material rather than cascade triggers in their own right.
 */
const NAMED_NOTHING: Resolution = {
  nodeId: null,
  basis:
    'Unresolved: the signal named neither a manufacturer nor a drug. A GDELT headline usually ' +
    'names neither in a form this arm can extract, which is why headline-only clusters are ' +
    'corroboration material rather than cascade triggers.',
};

/** Candidates matching one name, best match kind first. */
function findMatches(
  name: string,
  candidates: NodeCandidate[],
  type: NodeCandidate['type'],
): { candidate: NodeCandidate; kind: 'exact' | 'contained' }[] {
  return candidates
    .filter((candidate) => candidate.type === type)
    .flatMap((candidate) => {
      const kind = matches(name, candidate.label);
      return kind === null ? [] : [{ candidate, kind }];
    })
    .sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'exact' ? -1 : 1));
}

/**
 * Resolves an alert to one node, or explains why it could not.
 *
 * The manufacturer is tried first. That is the ordering the data justifies: an
 * FDA enforcement report names `recalling_firm` as a structured field, and the
 * drug name it carries is a product description that often names a dosage form
 * rather than a generic. So the firm is the more reliable pin.
 *
 * Ambiguity is a **failure**, not a coin flip. Two manufacturers matching one
 * name means we do not know which one, and picking either would produce a
 * cascade that is precise about the wrong firm.
 */
export function resolveToNode(signal: Resolvable, candidates: NodeCandidate[]): Resolution {
  const attempts: { field: string; name: string; type: NodeCandidate['type'] }[] = [
    ...(signal.manufacturer === null
      ? []
      : [{ field: 'manufacturer', name: signal.manufacturer, type: 'manufacturer' as const }]),
    ...(signal.drugOrIngredient === null
      ? []
      : [{ field: 'drug_or_ingredient', name: signal.drugOrIngredient, type: 'drug' as const }]),
  ];

  if (attempts.length === 0) return NAMED_NOTHING;

  for (const attempt of attempts) {
    const found = findMatches(attempt.name, candidates, attempt.type);

    if (found.length === 1) {
      const only = found[0];
      if (only === undefined) continue;
      return {
        nodeId: only.candidate.nodeId,
        basis:
          `Resolved on ${attempt.field} "${attempt.name}" to ${only.candidate.type} node ` +
          `${only.candidate.nodeId} ("${only.candidate.label}") by ${only.kind} match after ` +
          'normalising corporate suffixes. A cascade can be run from this node.',
      };
    }

    if (found.length > 1) {
      return {
        nodeId: null,
        basis:
          `Ambiguous: ${attempt.field} "${attempt.name}" matched ${String(found.length)} nodes ` +
          `(${found.map((one) => one.candidate.label).join(', ')}). Left unresolved rather than ` +
          'guessed — a cascade from the wrong firm is precise about the wrong thing, which is ' +
          'worse than no cascade at all.',
      };
    }
  }

  return {
    nodeId: null,
    basis:
      `Unresolved: ${attempts.map((one) => `${one.field} "${one.name}"`).join(' and ')} matched ` +
      'no node in the current graph. Either the entity is not in the catalogue yet — the graph ' +
      'is built from eight seed generics, not the whole pharmacopoeia — or the name is spelled ' +
      'differently. Matching is exact after normalisation; fuzzy matching was rejected because ' +
      'it pairs a firm with its own subsidiary.',
  };
}
