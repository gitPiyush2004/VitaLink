/**
 * The Pareto front, and the objective that picks one point off it (spec 6.11).
 *
 * Two separate jobs, deliberately in one file because they are the two halves of
 * one honest answer.
 *
 * ## The Pareto front is the objective answer
 *
 * A scenario is *dominated* when another scenario is at least as good on every
 * axis and strictly better on at least one. Dominated scenarios can be discarded
 * without any judgement at all — nobody's preferences make them worth choosing.
 * What survives is the front: the set of genuine trade-offs, where buying an
 * improvement on one axis costs you something on another.
 *
 * That set is a *fact* about the options. It needs no weights and involves no
 * opinion, which is why it is computed separately and shown separately.
 *
 * ## The objective is the subjective answer, and it is labelled as one
 *
 * Picking one point off the front requires saying how much a day of shortage is
 * worth in rupees. Nobody can derive that; it is a policy choice. So the weights
 * are configuration, they are displayed with the answer, and the ranking is
 * reproducible from the stored per-scenario objective values.
 *
 * An operator who disagrees with the weighting can look at the front and pick a
 * different point, and the system will not have hidden the alternatives from
 * them. That is the whole reason for computing both.
 *
 * ## Normalisation, and why min-max against the candidate set
 *
 * The objective sums terms measured in units that cannot be added — expected
 * shortage is dimensionless, cost is rupees, recovery is days, CO2 is kilograms.
 * Each is min-max normalised against the candidate set first, so the weights
 * mean what they look like they mean. The alternative — absolute scales — would
 * need a defensible "worst possible cost", which nobody has.
 *
 * **Min-max amplifies a small absolute spread into a decisive-looking one**, and
 * that is worth knowing before reading a ranking. On a live run the exposures
 * were 0.0184 and 0.0028 — a difference of one and a half percentage points —
 * and normalisation turned them into 1.000 and 0.000, so the shortage term
 * decided the whole objective on a spread that small. The behaviour is correct
 * for "which of these options is best", and it is misleading for "how much does
 * this matter". Which is why the raw value sits next to the normalised one in
 * every stored breakdown, and why the Pareto front — which does no normalising
 * at all — is shown beside the ranking rather than instead of it.
 *
 * Pure functions.
 */

/** The two axes an operator actually trades off. Spec 6.11's Pareto plot. */
export type ParetoInput = {
  scenarioId: string;
  label: string;
  /** Lower is better. */
  expectedShortage: number;
  /** Lower is better. Intervention cost plus freight. */
  totalCostInr: number;
};

export type ParetoPoint = ParetoInput & {
  isDominated: boolean;
  /** Which scenario dominates it, when one does. Null on the front. */
  dominatedBy: string | null;
};

/**
 * Whether `other` dominates `point`: no worse on both axes, better on one.
 *
 * The `<=` on both and the strict `<` on one are the textbook definition, and
 * the consequence is worth stating: two scenarios with *identical* shortage and
 * cost neither dominate nor are dominated, so both stay on the front.
 *
 * That is the right answer rather than a gap. They are two distinct options —
 * different sourcing, different carrier — that happen to tie on the two axes
 * this plot shows. They may differ on recovery days or emissions, which the plot
 * does not show, so dropping one arbitrarily would hide a real alternative from
 * an operator who cares about the axis that is off-screen.
 */
function dominates(other: ParetoInput, point: ParetoInput): boolean {
  const noWorse =
    other.expectedShortage <= point.expectedShortage && other.totalCostInr <= point.totalCostInr;
  const strictlyBetter =
    other.expectedShortage < point.expectedShortage || other.totalCostInr < point.totalCostInr;

  return noWorse && strictlyBetter;
}

/**
 * Marks every dominated scenario, naming what dominated it.
 *
 * O(n²), and that is the right choice here: `MAX_SCENARIOS_PER_MATRIX` caps the
 * input at 50, so the quadratic pass is 2,500 comparisons — and the divide-and-
 * conquer alternative would be harder to read for no measurable gain.
 *
 * `dominatedBy` is part of the output because "this option was discarded" is a
 * claim an operator will want to check, and the answer is "because this other
 * option was cheaper *and* left less shortage".
 */
export function markDominated(points: ParetoInput[]): ParetoPoint[] {
  return points.map((point) => {
    const dominator = points.find(
      (other) => other.scenarioId !== point.scenarioId && dominates(other, point),
    );

    return {
      ...point,
      isDominated: dominator !== undefined,
      dominatedBy: dominator?.scenarioId ?? null,
    };
  });
}

/** The non-dominated set, cheapest first. The genuine trade-offs. */
export function paretoFront(points: ParetoInput[]): ParetoPoint[] {
  return markDominated(points)
    .filter((point) => !point.isDominated)
    .sort((left, right) => left.totalCostInr - right.totalCostInr);
}

// ---------------------------------------------------------------------------
// The objective
// ---------------------------------------------------------------------------

/** The five terms of spec 6.11's objective. Every one is "lower is better". */
export type ObjectiveTerms = {
  expectedShortage: number;
  totalCostInr: number;
  recoveryDays: number;
  criticalityWeightedImpact: number;
  co2Kg: number;
};

export type ObjectiveWeights = {
  alpha_shortage: number;
  beta_cost: number;
  gamma_recovery: number;
  delta_criticality: number;
  epsilon_co2: number;
};

/**
 * Min-max normalisation against the candidate set, with the degenerate case
 * returning zero rather than dividing by nothing.
 *
 * Zero, not 0.5: when every candidate has the same cost, cost is not a
 * differentiator and should contribute nothing to the ranking. Returning a
 * midpoint would add the same constant to every scenario, which is harmless
 * arithmetically and misleading in the stored breakdown — it would look as
 * though cost had been weighed.
 */
function normalise(value: number, min: number, max: number): number {
  return max === min ? 0 : (value - min) / (max - min);
}

export type ScoredObjective = {
  scenarioId: string;
  value: number;
  /** Each normalised term and its contribution, so the ranking is checkable. */
  breakdown: {
    term: string;
    raw: number;
    normalised: number;
    weight: number;
    contribution: number;
  }[];
};

/**
 * Ranks scenarios by the weighted objective.
 *
 * Lower is better throughout, so the winner is the minimum. That direction is
 * stated because it is the opposite of the carrier scoring in
 * `modules/logistics`, where higher wins — the two are different questions and
 * mixing the conventions up would silently invert a recommendation.
 */
export function scoreObjective(
  candidates: (ObjectiveTerms & { scenarioId: string })[],
  weights: ObjectiveWeights,
): ScoredObjective[] {
  const terms = [
    { term: 'expected_shortage', key: 'expectedShortage', weight: weights.alpha_shortage },
    { term: 'total_cost_inr', key: 'totalCostInr', weight: weights.beta_cost },
    { term: 'recovery_days', key: 'recoveryDays', weight: weights.gamma_recovery },
    {
      term: 'criticality_weighted_impact',
      key: 'criticalityWeightedImpact',
      weight: weights.delta_criticality,
    },
    { term: 'co2_kg', key: 'co2Kg', weight: weights.epsilon_co2 },
  ] as const;

  const ranges = new Map(
    terms.map((entry) => {
      const values = candidates.map((candidate) => candidate[entry.key]);
      return [entry.key, { min: Math.min(...values), max: Math.max(...values) }];
    }),
  );

  return candidates.map((candidate) => {
    const breakdown = terms.map((entry) => {
      const range = ranges.get(entry.key) ?? { min: 0, max: 0 };
      const raw = candidate[entry.key];
      const normalised = normalise(raw, range.min, range.max);

      return {
        term: entry.term,
        raw,
        normalised,
        weight: entry.weight,
        contribution: normalised * entry.weight,
      };
    });

    return {
      scenarioId: candidate.scenarioId,
      value: breakdown.reduce((sum, one) => sum + one.contribution, 0),
      breakdown,
    };
  });
}

/**
 * The chosen scenario: lowest objective value, ties broken by lower cost.
 *
 * @returns null for an empty candidate set. A caller must treat that as "no
 *   scenario could be built", which is a finding — not silently substitute the
 *   baseline, because the baseline is itself one of the candidates and its
 *   absence means enumeration failed.
 */
export function chooseScenario(scored: ScoredObjective[]): ScoredObjective | null {
  if (scored.length === 0) return null;

  const OBJECTIVE_TIE_EPSILON = 1e-9;
  return (
    [...scored].sort((left, right) => {
      const byValue = left.value - right.value;
      return Math.abs(byValue) > OBJECTIVE_TIE_EPSILON
        ? byValue
        : left.scenarioId.localeCompare(right.scenarioId);
    })[0] ?? null
  );
}

/** Column widths for the objective table, so it lines up in a terminal. */
const COLUMN = {
  term: 28,
  raw: 12,
  normalised: 5,
  weight: 6,
  contribution: 12,
  total: 40,
} as const;
const DECIMALS = 3;
const WEIGHT_DECIMALS = 2;
const RAW_DECIMALS = 1;

/** One row of the objective breakdown. */
function explainTerm(term: ScoredObjective['breakdown'][number]): string {
  return (
    `  ${term.term.padEnd(COLUMN.term)}` +
    `${term.raw.toFixed(RAW_DECIMALS).padStart(COLUMN.raw)}  ` +
    `${term.normalised.toFixed(DECIMALS).padStart(COLUMN.normalised)}  ` +
    `${term.weight.toFixed(WEIGHT_DECIMALS).padStart(COLUMN.weight)}  ` +
    `${term.contribution.toFixed(DECIMALS).padStart(COLUMN.contribution)}`
  );
}

/** The objective breakdown as an inspectable table. */
export function explainObjective(scored: ScoredObjective, label: string): string[] {
  return [
    `OBJECTIVE for ${label}   raw          norm   weight  contribution`,
    ...scored.breakdown.map(explainTerm),
    `  ${'TOTAL (lower is better)'.padEnd(COLUMN.term)}` +
      `${scored.value.toFixed(DECIMALS).padStart(COLUMN.total)}`,
  ];
}
