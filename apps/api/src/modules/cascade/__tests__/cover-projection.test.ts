/**
 * Cover projection tests.
 *
 * The assertion that matters most is `stockout_band_low_comes_from_low_cover`.
 * Getting that backwards reports the optimistic day as the pessimistic one, which
 * is the wrong direction to be wrong in for a shortage tool — and it is the kind
 * of inversion that looks entirely plausible on screen.
 */

import { describe, expect, it } from 'vitest';

import {
  SAFETY_COVER_DAYS,
  URGENCY_COVER_DAYS,
  URGENCY_ESCALATION_SEVERITY,
} from '@config/constants';

import { coverToUrgency, projectCover } from '../domain/cover-projection';

const BASE = { assumedCoverDays: 30, safetyThresholdDays: SAFETY_COVER_DAYS };

describe('projectCover', () => {
  it('leaves cover untouched when exposure is zero', () => {
    const result = projectCover({ ...BASE, exposure: 0 });

    expect(result.effectiveCoverDays).toBeCloseTo(30, 10);
  });

  it('drains cover in proportion to exposure', () => {
    const result = projectCover({ ...BASE, exposure: 0.5 });

    expect(result.effectiveCoverDays).toBeCloseTo(15, 10);
  });

  it('leaves no cover at all when exposure is total', () => {
    const result = projectCover({ ...BASE, exposure: 1 });

    expect(result.effectiveCoverDays).toBe(0);
    expect(result.stockoutDayBand).toEqual({ low: 0, high: 0 });
  });

  it('produces a curve that declines by one day per day', () => {
    const result = projectCover({ ...BASE, exposure: 0, horizonDays: 5 });

    expect(result.days).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.coverHigh[0]! - result.coverHigh[1]!).toBeCloseTo(1, 10);
  });

  it('never reports negative cover', () => {
    const result = projectCover({ ...BASE, assumedCoverDays: 3, exposure: 0, horizonDays: 10 });

    expect(Math.min(...result.coverLow)).toBe(0);
    expect(Math.min(...result.coverHigh)).toBe(0);
  });

  it('takes the stockout band low from the low cover edge, not the high', () => {
    // The pessimistic cover edge crosses the threshold FIRST, so it gives the
    // earlier day. Inverting this reports the optimistic day as the worst case.
    const result = projectCover({ ...BASE, exposure: 0 });

    const band = result.stockoutDayBand;
    expect(band).not.toBeNull();
    // low cover = 30 * 0.65 = 19.5, minus a 7-day threshold -> day 12
    // high cover = 30 * 1.35 = 40.5, minus a 7-day threshold -> day 33
    expect(band?.low).toBe(12);
    expect(band?.high).toBe(33);
    expect(band!.low).toBeLessThan(band!.high);
  });

  it('reports no stockout when cover outlasts the horizon', () => {
    const result = projectCover({
      ...BASE,
      assumedCoverDays: 400,
      exposure: 0,
      horizonDays: 90,
    });

    expect(result.stockoutDayBand).toBeNull();
  });

  it('reports day zero when cover is already below the threshold', () => {
    // Not a projection — a current shortage. Reporting a future day would be
    // worse than reporting none.
    const result = projectCover({ ...BASE, assumedCoverDays: 2, exposure: 0.5 });

    expect(result.stockoutDayBand).toEqual({ low: 0, high: 0 });
  });

  it('rejects an exposure outside the unit interval', () => {
    expect(() => projectCover({ ...BASE, exposure: 1.2 })).toThrow(RangeError);
    expect(() => projectCover({ ...BASE, exposure: -0.1 })).toThrow(RangeError);
  });

  it('rejects negative cover', () => {
    expect(() => projectCover({ ...BASE, assumedCoverDays: -5, exposure: 0 })).toThrow(RangeError);
  });
});

describe('projectCover, honesty about its inputs', () => {
  it('declares that assumed cover is a SCENARIO input', () => {
    // The whole point of this file. No public source publishes inventory, so the
    // operator's own figure is the input and the record says so.
    const result = projectCover({ ...BASE, exposure: 0.3 });

    expect(result.assumptions.assumed_cover_days_is_a_scenario_input).toBe(true);
    expect(result.assumptions.inventory_incoming_supply_and_demand_are_not_publicly_available).toBe(
      true,
    );
  });

  it('records the operator figure it was given, so the result is reproducible', () => {
    const result = projectCover({ ...BASE, assumedCoverDays: 42, exposure: 0.1 });

    expect(result.assumptions.assumed_cover_days).toBe(42);
  });

  it('says the band is a sensitivity range, not a confidence interval', () => {
    // Calling it a confidence interval would imply a statistical claim the model
    // does not make.
    const result = projectCover({ ...BASE, exposure: 0.3 });

    expect(result.assumptions.band_is_a_sensitivity_range_not_a_confidence_interval).toBe(true);
  });

  it("writes the formula out with this run's numbers", () => {
    const result = projectCover({ ...BASE, assumedCoverDays: 30, exposure: 0.5 });

    expect(result.calculationMethod).toContain('effective cover = assumed cover * (1 - exposure)');
    expect(result.calculationMethod).toContain('30 assumed days');
    expect(result.calculationMethod).toContain('SCENARIO');
  });
});

describe('coverToUrgency', () => {
  const thresholds = URGENCY_COVER_DAYS;
  const escalation = URGENCY_ESCALATION_SEVERITY;

  it('is CRITICAL at or below two days of cover', () => {
    expect(coverToUrgency(2, 1, thresholds, escalation)).toBe('CRITICAL');
    expect(coverToUrgency(0, 1, thresholds, escalation)).toBe('CRITICAL');
  });

  it('is HIGH at or below five days', () => {
    expect(coverToUrgency(5, 1, thresholds, escalation)).toBe('HIGH');
  });

  it('is NORMAL at or below fourteen days', () => {
    expect(coverToUrgency(14, 1, thresholds, escalation)).toBe('NORMAL');
  });

  it('is LOW above fourteen days', () => {
    expect(coverToUrgency(30, 1, thresholds, escalation)).toBe('LOW');
  });

  it('escalates to HIGH on severity alone, even with plenty of cover', () => {
    // A severity-4 alert about a drug with 30 days of cover still deserves a
    // fast lane: the cover figure is an assumption and the severity is evidence.
    expect(coverToUrgency(30, 4, thresholds, escalation)).toBe('HIGH');
  });

  it('does not let severity downgrade a critical cover figure', () => {
    expect(coverToUrgency(1, 5, thresholds, escalation)).toBe('CRITICAL');
  });
});
