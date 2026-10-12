import type { Investigation, InvestigationDecisionInput } from '@vitalink/contracts';

import { ValidationError } from '@shared/errors';

export function validateDecision(record: Investigation, input: InvestigationDecisionInput): void {
  if (input.action === 'investigate_candidate') {
    const matches =
      record.candidates?.candidates.filter((one) => one.productNdc === input.candidateNdc) ?? [];
    const candidate = matches[0];
    if (matches.length !== 1 || !candidate || candidate.exclusions.length > 0) {
      throw new ValidationError(
        'Choose a non-excluded product from the saved candidate comparison.',
      );
    }
  }
  if (input.action === 'documented_response' && !record.plan?.selectedOptionId) {
    throw new ValidationError('Select a saved response option before recording this action.');
  }
}

export function selectResponse(record: Investigation, id: string): Investigation {
  if (!record.plan?.rows.some((row) => row.id === id)) {
    throw new ValidationError('Select an option from the saved comparison.');
  }
  const invalidate =
    record.plan.selectedOptionId !== id && record.decision?.action === 'documented_response';
  return {
    ...record,
    plan: { ...record.plan, selectedOptionId: id },
    decision: invalidate ? null : record.decision,
    status: invalidate ? 'INVESTIGATING' : record.status,
  };
}
