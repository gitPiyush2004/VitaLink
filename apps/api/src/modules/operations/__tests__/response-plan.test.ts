import { describe, expect, it } from 'vitest';

import { responsePlanInputSchema } from '@vitalink/contracts';

import { compareResponses, uncoveredDays } from '../domain/response-plan';

describe('conditional inventory balance', () => {
  it('counts the gap before a late shipment even when the shipment covers all later demand', () => {
    expect(uncoveredDays(5, 20, 8, 20)).toBe(3);
  });
  it('counts gaps before and after a partial late shipment', () => {
    expect(uncoveredDays(5, 20, 8, 4)).toBe(11);
  });
  it('does not count stock arriving after the interruption horizon', () => {
    expect(uncoveredDays(5, 20, 30, 100)).toBe(15);
  });
  it('preserves unused original cover when stock arrives early', () => {
    expect(uncoveredDays(5, 20, 2, 10)).toBe(5);
  });
  it('does not manufacture stockout when original cover exceeds the interruption', () => {
    expect(uncoveredDays(30, 20, 8, 0)).toBe(0);
  });
  it('marks a higher-cost option with the same gap as dominated and preserves the do-nothing baseline', () => {
    const input = responsePlanInputSchema.parse({
      currentCoverDays: 5,
      disruptionDays: 20,
      inputBasis: 'Operator scenario for inventory sensitivity',
      currency: 'USD',
      options: [
        {
          id: 'early',
          label: 'Earlier replenishment',
          leadDays: 3,
          additionalCoverDays: 15,
          cost: 200,
          basis: 'operator_estimate',
          evidenceUrl: null,
          evidenceNote: 'Explicit test estimate',
        },
        {
          id: 'costlier',
          label: 'Costlier replenishment',
          leadDays: 3,
          additionalCoverDays: 15,
          cost: 300,
          basis: 'operator_estimate',
          evidenceUrl: null,
          evidenceNote: 'Explicit test estimate',
        },
      ],
    });
    const result = compareResponses(input, '2026-10-12T06:00:00.000Z');
    expect(result.rows[0]?.uncoveredDays.value).toBe(15);
    expect(result.rows[1]?.dominated).toBe(false);
    expect(result.rows[2]?.dominated).toBe(true);
    expect(result.rows[1]?.uncoveredDays.tag).toBe('SCENARIO');
    expect(result.selectedOptionId).toBeNull();
  });
  it('requires evidence for a documented quote', () => {
    const result = responsePlanInputSchema.safeParse({
      currentCoverDays: 1,
      disruptionDays: 3,
      inputBasis: 'Inventory source',
      currency: 'USD',
      options: [
        {
          id: 'one',
          label: 'Quote',
          leadDays: 1,
          additionalCoverDays: 2,
          cost: 100,
          basis: 'documented_quote',
          evidenceUrl: null,
          evidenceNote: 'No evidence attached',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
