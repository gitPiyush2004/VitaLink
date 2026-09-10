/**
 * The Pareto front and the objective, and the line between them.
 *
 * The front is a fact about the options; the objective is a policy choice. The
 * tests are split the same way, because conflating them is exactly the mistake
 * this design exists to avoid — a system that shows one "optimal" option has
 * hidden the trade-off it made on the operator's behalf.
 */

import { describe, expect, it } from 'vitest';

import { OBJECTIVE_WEIGHTS } from '@config/weights';

import {
  chooseScenario,
  explainObjective,
  markDominated,
  paretoFront,
  scoreObjective,
  type ObjectiveTerms,
} from '../domain/pareto';

/**
 * Four options, arranged so the answer is known by hand.
 *
 *   baseline  shortage 0.30  cost      0   — cheapest, worst outcome
 *   cheap     shortage 0.20  cost 20,000
 *   good      shortage 0.10  cost 50,000   — best outcome, dearest
 *   dominated shortage 0.25  cost 60,000   — worse than `cheap` on both
 */
const POINTS = [
  { scenarioId: 'baseline', label: 'Do nothing', expectedShortage: 0.3, totalCostInr: 0 },
  { scenarioId: 'cheap', label: 'Reallocate', expectedShortage: 0.2, totalCostInr: 20_000 },
  { scenarioId: 'good', label: 'Alternate supplier', expectedShortage: 0.1, totalCostInr: 50_000 },
  {
    scenarioId: 'dominated',
    label: 'Qualify second source',
    expectedShortage: 0.25,
    totalCostInr: 60_000,
  },
];

describe('the Pareto front needs no weights and states no opinion', () => {
  it('discards an option that is worse on every axis', () => {
    // `dominated` costs more than `cheap` AND leaves more shortage. No
    // preferences make it worth choosing, so it can be dropped without any
    // judgement at all — which is what makes the front objective.
    const front = paretoFront(POINTS).map((point) => point.scenarioId);

    expect(front).not.toContain('dominated');
    expect(front).toEqual(['baseline', 'cheap', 'good']);
  });

  it('names what dominated a discarded option', () => {
    // "Why was that discarded" is a question an operator will ask, and the
    // answer has to be available from the record.
    const marked = markDominated(POINTS);
    const discarded = marked.find((point) => point.scenarioId === 'dominated');

    expect(discarded?.isDominated).toBe(true);
    expect(discarded?.dominatedBy).toBe('cheap');
  });

  it('keeps the baseline on the front when it is the cheapest', () => {
    // Doing nothing is genuinely on the front: it is the cheapest option, and
    // nothing dominates it. A front that dropped the baseline would be hiding
    // the fact that spending nothing is a real choice.
    expect(paretoFront(POINTS).map((one) => one.scenarioId)).toContain('baseline');
  });

  it('keeps two options that tie on both axes', () => {
    // Neither dominates the other, so both stay — and that is right rather than
    // a gap. They are distinct options that happen to tie on the two axes this
    // plot shows; they may differ on recovery days or emissions, which it does
    // not show. Dropping one arbitrarily would hide a real alternative from an
    // operator who cares about the off-screen axis.
    const twins = [
      {
        scenarioId: 'a',
        label: 'Reallocate via road',
        expectedShortage: 0.2,
        totalCostInr: 10_000,
      },
      {
        scenarioId: 'b',
        label: 'Reallocate via rail',
        expectedShortage: 0.2,
        totalCostInr: 10_000,
      },
    ];

    expect(paretoFront(twins)).toHaveLength(2);
    expect(paretoFront(twins).every((point) => point.dominatedBy === null)).toBe(true);
  });

  it('orders the front cheapest first, so it reads as a trade-off curve', () => {
    const costs = paretoFront(POINTS).map((point) => point.totalCostInr);
    expect(costs).toEqual([...costs].sort((left, right) => left - right));
  });
});

// ---------------------------------------------------------------------------
// The objective
// ---------------------------------------------------------------------------

const CANDIDATES: (ObjectiveTerms & { scenarioId: string })[] = [
  {
    scenarioId: 'baseline',
    expectedShortage: 0.3,
    totalCostInr: 0,
    recoveryDays: 30,
    criticalityWeightedImpact: 0.3,
    co2Kg: 0,
  },
  {
    scenarioId: 'good',
    expectedShortage: 0.1,
    totalCostInr: 50_000,
    recoveryDays: 10,
    criticalityWeightedImpact: 0.1,
    co2Kg: 400,
  },
];

describe('the objective is an opinion, and a reproducible one', () => {
  it('prefers the intervention when shortage outweighs cost', () => {
    // The configured weights put 0.45 on shortage and 0.2 on cost, so closing
    // two thirds of a shortage is worth ₹50,000. That is a policy choice, which
    // is why the weights are displayed with the answer.
    const scored = scoreObjective(CANDIDATES, OBJECTIVE_WEIGHTS);
    expect(chooseScenario(scored)?.scenarioId).toBe('good');
  });

  it('reverses when the operator says cost dominates', () => {
    // The same two options, the operator's own weighting. The system must be
    // responsive to it, or the weights are decoration.
    const scored = scoreObjective(CANDIDATES, {
      alpha_shortage: 0.05,
      beta_cost: 0.9,
      gamma_recovery: 0.05,
      delta_criticality: 0,
      epsilon_co2: 0,
    });

    expect(chooseScenario(scored)?.scenarioId).toBe('baseline');
  });

  it('stores every term so the ranking can be recomputed from the record', () => {
    const scored = scoreObjective(CANDIDATES, OBJECTIVE_WEIGHTS);
    const good = scored.find((one) => one.scenarioId === 'good');

    expect(good?.breakdown.map((one) => one.term)).toEqual([
      'expected_shortage',
      'total_cost_inr',
      'recovery_days',
      'criticality_weighted_impact',
      'co2_kg',
    ]);
    // The sum of the contributions IS the value — nothing is added elsewhere.
    const total = good?.breakdown.reduce((sum, one) => sum + one.contribution, 0) ?? 0;
    expect(good?.value).toBeCloseTo(total, 10);
  });

  it('contributes nothing from a term every candidate shares', () => {
    // Returning a 0.5 midpoint would add the same constant to every scenario:
    // harmless arithmetically, and misleading in the stored breakdown, because
    // it would look as though cost had been weighed.
    const sameCost = CANDIDATES.map((one) => ({ ...one, totalCostInr: 20_000 }));
    const scored = scoreObjective(sameCost, OBJECTIVE_WEIGHTS);
    const costTerm = scored[0]?.breakdown.find((one) => one.term === 'total_cost_inr');

    expect(costTerm?.normalised).toBe(0);
    expect(costTerm?.contribution).toBe(0);
  });

  it('is lower-is-better, the opposite of the carrier score', () => {
    // Stated in a test because mixing the two conventions up would silently
    // invert a recommendation: `modules/logistics` ranks highest-first.
    const scored = scoreObjective(CANDIDATES, OBJECTIVE_WEIGHTS);
    const chosen = chooseScenario(scored);
    const other = scored.find((one) => one.scenarioId !== chosen?.scenarioId);

    expect(chosen?.value).toBeLessThan(other?.value ?? 0);
  });

  it('returns null for an empty candidate set rather than inventing a baseline', () => {
    // The baseline is itself one of the candidates, so an empty set means
    // enumeration failed. Substituting it would hide a bug.
    expect(chooseScenario([])).toBeNull();
  });

  it('breaks an exact tie deterministically', () => {
    const twins = scoreObjective(
      [
        { ...CANDIDATES[0]!, scenarioId: 'b' },
        { ...CANDIDATES[0]!, scenarioId: 'a' },
      ],
      OBJECTIVE_WEIGHTS,
    );

    expect(chooseScenario(twins)?.scenarioId).toBe('a');
  });

  it('explains itself as an inspectable table', () => {
    const scored = scoreObjective(CANDIDATES, OBJECTIVE_WEIGHTS);
    const lines = explainObjective(scored[0]!, 'Do nothing').join('\n');

    expect(lines).toContain('OBJECTIVE for Do nothing');
    expect(lines).toContain('expected_shortage');
    expect(lines).toContain('TOTAL (lower is better)');
  });
});
