import { scenario, type ResponsePlan, type ResponsePlanInput } from '@vitalink/contracts';

/** Constant consumption, no normal replenishment until the interruption ends.
 * Additional stock cannot retroactively fill an earlier gap. This is a conditional
 * inventory balance, not a probability fitted from the reliability model.
 */
export function uncoveredDays(
  cover: number,
  duration: number,
  arrival: number,
  extra: number,
): number {
  const beforeArrival = Math.max(0, Math.min(duration, arrival) - cover);
  const remainingAtArrival = Math.max(0, cover - arrival) + extra;
  const afterArrival = Math.max(0, duration - arrival - remainingAtArrival);
  return beforeArrival + afterArrival;
}
export function compareResponses(input: ResponsePlanInput, at: string): ResponsePlan {
  const baseline = {
    id: 'baseline',
    label: 'Continue without intervention',
    leadDays: 0,
    additionalCoverDays: 0,
    cost: 0,
    evidenceNote: 'No additional supply is assumed.',
  };
  const values = [baseline, ...input.options].map((option) => ({
    option,
    gap: uncoveredDays(
      input.currentCoverDays,
      input.disruptionDays,
      option.leadDays,
      option.additionalCoverDays,
    ),
  }));
  return {
    createdAt: at,
    input,
    selectedOptionId: null,
    rows: values.map(({ option, gap }) => ({
      id: option.id,
      label: option.label,
      uncoveredDays: scenario({
        value: gap,
        unit: 'days',
        at,
        setBy: `${input.inputBasis}. Constant consumption; no normal replenishment for ${String(input.disruptionDays)} days. Cover=${String(input.currentCoverDays)}d; arrival=${String(option.leadDays)}d; added cover=${String(option.additionalCoverDays)}d. Gaps before and after arrival are summed; late stock cannot repair a past gap.`,
      }),
      cost: scenario({
        value: option.cost,
        unit: input.currency,
        at,
        setBy: `Operator-entered total landed cost. ${option.evidenceNote}`,
      }),
      dominated: values.some(
        (other) =>
          other.gap <= gap &&
          other.option.cost <= option.cost &&
          (other.gap < gap || other.option.cost < option.cost),
      ),
      arrivesBeforeStockout:
        option.id === 'baseline' ? null : option.leadDays <= input.currentCoverDays,
    })),
  };
}
