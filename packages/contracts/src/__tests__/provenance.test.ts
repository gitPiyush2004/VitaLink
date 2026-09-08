/**
 * These tests exist to prove the data covenant is enforced by the schema rather
 * than by discipline. If any of them starts failing, a source-less or
 * point-valued modelled number has become possible somewhere in the system.
 */

import { describe, expect, it } from 'vitest';

import { derived, modelled, quantitySchema, real, scenario, type Quantity } from '../provenance';

const FETCHED_AT = '2026-09-01T00:00:00.000Z';

const source = {
  name: 'openFDA',
  url: 'https://api.fda.gov/drug/ndc.json',
  query: 'search=generic_name:"heparin"&limit=1',
  fetchedAt: FETCHED_AT,
};

describe('quantitySchema', () => {
  it('accepts a REAL value with only a source and a fetch time', () => {
    const quantity = real({ value: 12, unit: 'count', source });

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(true);
  });

  it('rejects a bare number, so a source-less figure cannot be persisted', () => {
    const result = quantitySchema.safeParse(42);

    expect(result.success).toBe(false);
  });

  it('rejects a value whose provenance has no source_url', () => {
    const quantity = {
      value: 12,
      unit: 'count',
      tag: 'REAL',
      provenance: { source_name: 'openFDA', query: null, fetched_at: FETCHED_AT },
    };

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
  });

  it('rejects a DERIVED value that does not say how it was calculated', () => {
    const quantity: Quantity = {
      ...derived({ value: 3, unit: 'count', source, method: 'placeholder' }),
    };
    delete quantity.provenance.calculation_method;

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['provenance', 'calculation_method']);
  });

  it('accepts a DERIVED value that carries its formula', () => {
    const quantity = derived({
      value: 0.42,
      unit: null,
      source,
      method: 'HHI = sum over makers of (NDC product share)^2',
    });

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(true);
  });

  it('rejects a MODELLED value rendered as a point rather than a band', () => {
    const quantity: Quantity = modelled({
      value: 0.041,
      unit: null,
      source,
      method: 's = 1 - r_api * r_pl (Tucker & Daskin eq. 4)',
      band: { low: 0.03, high: 0.06 },
      assumptions: { z_line: 1 },
      confidence: 0.6,
    });
    delete quantity.band;

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('band');
  });

  it('rejects a MODELLED value with no declared assumptions', () => {
    const quantity = modelled({
      value: 0.041,
      unit: null,
      source,
      method: 's = 1 - r',
      band: { low: 0.03, high: 0.06 },
      assumptions: {},
      confidence: 0.6,
    });
    delete quantity.provenance.assumptions;

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
  });

  it('rejects a MODELLED value with no confidence', () => {
    const quantity = modelled({
      value: 0.041,
      unit: null,
      source,
      method: 's = 1 - r',
      band: { low: 0.03, high: 0.06 },
      assumptions: { z_line: 1 },
      confidence: 0.6,
    });
    delete quantity.provenance.confidence;

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
  });

  it('rejects an inverted band', () => {
    const quantity = modelled({
      value: 0.041,
      unit: null,
      source,
      method: 's = 1 - r',
      band: { low: 0.09, high: 0.01 },
      assumptions: { z_line: 1 },
      confidence: 0.6,
    });

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(false);
  });

  it('accepts a fully-formed MODELLED value', () => {
    const quantity = modelled({
      value: 0.041,
      unit: null,
      source,
      method: 's = 1 - r_api * r_pl (Tucker & Daskin eq. 4)',
      band: { low: 0.03, high: 0.06 },
      assumptions: { z_line: 1, rate_origin: 'PAPER_BASELINE_FALLBACK' },
      confidence: 0.6,
    });

    const result = quantitySchema.safeParse(quantity);

    expect(result.success).toBe(true);
  });

  it('tags a user what-if as SCENARIO so it can never be shown as fact', () => {
    const quantity = scenario({
      value: 30,
      unit: 'days',
      setBy: 'user:scenario-form',
      at: FETCHED_AT,
    });

    expect(quantity.tag).toBe('SCENARIO');
    expect(quantitySchema.safeParse(quantity).success).toBe(true);
  });

  it('has exactly four tags, and none of them is SYNTHETIC', () => {
    const withSynthetic = { ...real({ value: 1, unit: null, source }), tag: 'SYNTHETIC' };

    expect(quantitySchema.safeParse(withSynthetic).success).toBe(false);
  });
});
