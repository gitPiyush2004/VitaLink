import { describe, expect, it } from 'vitest';

import { latestIncidents, recallIncident, shortageIncident } from '../domain/incidents';
import { matchesWatch } from '../domain/matching';

const provenance = {
  source_name: 'FDA test record',
  source_url: 'https://api.fda.gov/drug/enforcement.json',
  query: null,
  fetched_at: '2026-10-12T06:00:00.000Z',
};
describe('regulatory evidence mapping', () => {
  it('preserves lot scope and marks a recalling-firm city without inventing coordinates', () => {
    const incident = recallIncident(
      {
        recall_number: 'D-001',
        code_info: 'Lot ABC only',
        city: 'Boston',
        country: 'United States',
        report_date: '20261001',
        openfda: { generic_name: ['HEPARIN SODIUM'], product_ndc: ['0000-0001'] },
      },
      provenance,
    );
    expect(incident.lots).toBe('Lot ABC only');
    expect(incident.publishedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(incident.location?.precision).toBe('recalling-firm city');
    expect(incident.location?.coordinates).toBeNull();
    expect(incident.provenance).toEqual(provenance);
  });
  it('keeps available presentations distinct from a national current shortage status', () => {
    const incident = shortageIncident(
      {
        generic_name: 'Dopamine',
        package_ndc: '0409-1858-12',
        company_name: 'Hospira',
        status: 'Current',
        availability: 'Available',
        presentation: 'Vial',
      },
      provenance,
    );
    expect(incident.status).toBe('Current');
    expect(incident.availability).toBe('Available');
    expect(incident.location).toBeNull();
    expect(incident.sourceUrl).toContain('package_ndc');
  });
  it('uses stable presentation identities across source status updates', () => {
    const original = {
      generic_name: 'Dopamine',
      package_ndc: '0409-1858-12',
      company_name: 'Hospira',
    };
    expect(shortageIncident({ ...original, status: 'Current' }, provenance).id).toBe(
      shortageIncident({ ...original, status: 'Resolved' }, provenance).id,
    );
  });
  it('keeps the newest update when a presentation appears more than once, regardless of order', () => {
    const common = {
      generic_name: 'Test medicine',
      package_ndc: '0000-0001-01',
      company_name: 'Test company',
    };
    const older = shortageIncident(
      { ...common, update_date: '20260301', availability: 'Available' },
      provenance,
    );
    const newer = shortageIncident(
      { ...common, update_date: '20260401', availability: 'Unavailable' },
      provenance,
    );
    expect(latestIncidents([newer, older])).toEqual([newer]);
    expect(latestIncidents([older, newer])).toEqual([newer]);
  });
  it('matches whole normalised watch phrases rather than unrelated substrings', () => {
    const incident = shortageIncident({ generic_name: 'Heparin sodium' }, provenance);
    const watch = {
      id: 'w',
      kind: 'medicine' as const,
      createdAt: provenance.fetched_at,
      term: 'heparin',
    };
    expect(matchesWatch(incident, watch)).toBe(true);
    expect(matchesWatch(incident, { ...watch, term: 'parin' })).toBe(false);
  });
});
