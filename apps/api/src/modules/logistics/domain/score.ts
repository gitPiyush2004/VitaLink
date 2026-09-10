/**
 * The final score, and the carrier preference.
 *
 * `final_score = sum(weight_i * subscore_i) + declared_preference_bonus`
 *
 * ## The preference is disclosed or it does not exist
 *
 * Spec 6.2 asks for DSV to be preferred where possible, and there are two ways to
 * do that. One is legitimate: the cost sub-score is weighted by quote confidence,
 * so a carrier that can return a real quote against real credentials wins on
 * merit and the explanation can point at the term that made it win.
 *
 * The other is a hidden thumb on the scale, and it would make every explanation
 * the system produces a lie.
 *
 * So the compromise is implemented here as a **declared and displayed** tie-break
 * bonus, defaulting to empty. When it is non-empty, `preferenceNote` is non-null
 * and the recommendation is *required* to render it:
 *
 *     Operator preference applied: DSV +2.0 points (configured, disclosed)
 *
 * A preference you can see is a business rule. A preference you cannot see is a
 * bug. `applyPreference` returns the note alongside the bonus precisely so that a
 * caller cannot take the number without the disclosure.
 *
 * Pure functions. Nothing here reads a clock, a database or an environment
 * variable — the preference map is passed in.
 */

import type { CarrierId } from '@vitalink/contracts';

import type { WeightProfile } from '@config/weights';

import type { SubScore } from './sub-scores';

export type ScoredSubScore = SubScore & {
  weight: number;
  /** `weight * value`, stored so the UI shows the arithmetic, not the result. */
  contribution: number;
};

export type ScoredCandidate = {
  quoteId: string;
  carrierId: CarrierId;
  carrierDisplay: string;
  service: string;
  subScores: ScoredSubScore[];
  /** Sum of the contributions, before any preference. */
  weightedScore: number;
  preferenceBonus: number;
  /** Non-null whenever a bonus applied. The UI must render it. */
  preferenceNote: string | null;
  finalScore: number;
};

/**
 * Weights each sub-score and sums the contributions.
 *
 * A sub-score with no weight in the active profile still appears, with a
 * contribution of zero. That is deliberate: the breakdown should show that
 * `service` was computed and given no weight under this profile, rather than
 * omitting the row and leaving a reader to wonder whether it was considered.
 */
export function weightSubScores(
  subScores: SubScore[],
  profile: WeightProfile,
): { scored: ScoredSubScore[]; weightedScore: number } {
  const scored = subScores.map((subScore) => {
    const weight = profile.weights[subScore.key] ?? 0;
    return { ...subScore, weight, contribution: weight * subScore.value };
  });

  return {
    scored,
    weightedScore: scored.reduce((sum, subScore) => sum + subScore.contribution, 0),
  };
}

/**
 * The declared preference bonus for one carrier.
 *
 * @param preference carrier id to bonus points, from org config. Empty by default.
 * @returns the bonus and the disclosure text. The note is null only when the
 *   bonus is zero, so a non-zero bonus can never be applied silently.
 */
export function applyPreference(
  carrierId: CarrierId,
  preference: Record<string, number>,
): { bonus: number; note: string | null } {
  const bonus = preference[carrierId] ?? 0;

  if (bonus === 0) return { bonus: 0, note: null };

  return {
    bonus,
    note:
      `Operator preference applied: ${carrierId.toUpperCase()} ` +
      `${bonus > 0 ? '+' : ''}${bonus.toFixed(1)} points (configured, disclosed).`,
  };
}

export type ScoreInput = {
  quoteId: string;
  carrierId: CarrierId;
  carrierDisplay: string;
  service: string;
  subScores: SubScore[];
  profile: WeightProfile;
  preference: Record<string, number>;
};

export function scoreCandidate(input: ScoreInput): ScoredCandidate {
  const { scored, weightedScore } = weightSubScores(input.subScores, input.profile);
  const { bonus, note } = applyPreference(input.carrierId, input.preference);

  return {
    quoteId: input.quoteId,
    carrierId: input.carrierId,
    carrierDisplay: input.carrierDisplay,
    service: input.service,
    subScores: scored,
    weightedScore,
    preferenceBonus: bonus,
    preferenceNote: note,
    finalScore: weightedScore + bonus,
  };
}

/**
 * How close two scores have to be before they count as a tie.
 *
 * A weighted sum of six terms accumulates float error: `58 * 0.4 + 58 * 0.2 * 3`
 * plus a bonus of 2 is 60.00000000000001, not 60. Comparing exactly meant the
 * tie-break below could never fire, and a preference bonus that was meant to
 * break a tie silently *reversed* one instead — on a difference of 1e-14. Scores
 * are reported to one decimal place, so anything below a thousandth of a point is
 * noise by definition.
 */
const SCORE_TIE_EPSILON = 1e-3;

/**
 * Ranks candidates, best first.
 *
 * Ties break on the un-bonused weighted score, then on carrier id. The first
 * tie-break matters: when a preference bonus makes two carriers equal, the one
 * that earned more on merit should come first, so the preference breaks ties
 * rather than reversing them.
 */
export function rankCandidates(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((left, right) => {
    const byFinal = right.finalScore - left.finalScore;
    if (Math.abs(byFinal) > SCORE_TIE_EPSILON) return byFinal;

    const byMerit = right.weightedScore - left.weightedScore;
    if (Math.abs(byMerit) > SCORE_TIE_EPSILON) return byMerit;

    return left.carrierId.localeCompare(right.carrierId);
  });
}

const PERCENT = 100;

/** Column widths for the breakdown table, so it lines up in a terminal. */
const COLUMN = { key: 20, subScore: 3, weight: 3, contribution: 6 } as const;

/** One row of the breakdown: the arithmetic, not just the result. */
function explainSubScore(subScore: ScoredSubScore): string {
  return (
    `  ${subScore.key.padEnd(COLUMN.key)}` +
    `${subScore.value.toFixed(0).padStart(COLUMN.subScore)}  ` +
    `x ${(subScore.weight * PERCENT).toFixed(0).padStart(COLUMN.weight)}%  = ` +
    `${subScore.contribution.toFixed(1).padStart(COLUMN.contribution)}` +
    // Printed on the row, not in a footnote: a reader comparing two carriers
    // needs to see which of these numbers is a real measurement.
    (subScore.neutralFallbackReason === null ? '' : '   (neutral fallback)')
  );
}

/** The score breakdown as an inspectable table, mirroring spec 6.13. */
export function explainScore(candidate: ScoredCandidate, profile: WeightProfile): string[] {
  const lines = [
    'SCORE BREAKDOWN        sub    weight   contribution',
    ...candidate.subScores.map(explainSubScore),
    `  Profile: ${profile.name} — ${profile.rationale}`,
  ];

  if (candidate.preferenceNote !== null) {
    lines.push(`  ${candidate.preferenceNote}`);
  }

  lines.push(`  FINAL   ${candidate.finalScore.toFixed(1)}`);
  return lines;
}
