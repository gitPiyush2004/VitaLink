import { describe, expect, it } from 'vitest';

import { shortageEvidenceByNdc } from '../domain/shortage-evidence';

const date = '2026-10-13T00:00:00.000Z';
const current = {
  status: 'Current',
  availability: 'Available',
  update_date: '20261001',
  openfda: { product_ndc: ['12345-001'] },
};
describe('candidate shortage evidence', () => {
  it('does not let source row order hide mixed presentation status or availability', () => {
    const resolved = {
      ...current,
      status: 'Resolved',
      availability: 'Unavailable',
      update_date: '20261002',
    };
    const forward = shortageEvidenceByNdc([current, resolved], date);
    expect(forward).toEqual(shortageEvidenceByNdc([resolved, current], date));
    expect(forward.get('12345-001')).toEqual({
      status: 'Mixed FDA presentation statuses',
      availability: null,
      updatedAt: '2026-10-02',
    });
  });
  it('retains a consistent national status while preserving missing presentation availability', () => {
    const value = shortageEvidenceByNdc([current, { ...current, availability: undefined }], date);
    expect(value.get('12345-001')).toMatchObject({ status: 'Current', availability: null });
  });
  it('rejects unreadable and historically impossible source dates rather than fabricating timestamps', () => {
    const value = shortageEvidenceByNdc(
      [
        { ...current, update_date: '20260230' },
        { ...current, update_date: '21080101' },
      ],
      date,
    );
    expect(value.size).toBe(0);
    expect(shortageEvidenceByNdc([current], date).get('12345-001')?.availability).toBe('Available');
  });
});
