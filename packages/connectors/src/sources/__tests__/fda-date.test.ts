import { describe, expect, it } from 'vitest';

import { parseFdaDate } from '../fda-date';

describe('FDA calendar dates', () => {
  it('accepts compact FDA dates and ISO calendar dates', () => {
    expect(parseFdaDate('20271231')).toBe('2027-12-31');
    expect(parseFdaDate('2027-12-31')).toBe('2027-12-31');
    expect(parseFdaDate('20240229')).toBe('2024-02-29');
    expect(parseFdaDate('09/11/2026')).toBe('2026-09-11');
  });

  it('rejects invalid dates without rolling into the following month', () => {
    for (const value of [
      null,
      undefined,
      '',
      '20250229',
      '20260230',
      '20261301',
      '20260012',
      '20260100',
      '31/12/2027',
    ]) {
      expect(parseFdaDate(value)).toBeNull();
    }
  });
});
