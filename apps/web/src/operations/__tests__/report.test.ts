import { describe, expect, it } from 'vitest';

import { investigationReportSchema } from '@vitalink/contracts';

import { renderInvestigationReport } from '../report';
import { sourceChanges } from '../source-history';

function report() {
  const incident = {
    id: 'recall:TEST',
    kind: 'RECALL',
    title: 'Drug',
    product: 'Drug',
    company: 'Company',
    status: 'Ongoing',
    classification: 'Class II',
    reason: 'Lot-limited recall',
    publishedAt: null,
    updatedAt: '2026-10-12T00:00:00.000Z',
    sourceUrl: 'https://api.fda.gov/drug/enforcement.json',
    provenance: {
      source_name: 'FDA',
      source_url: 'https://api.fda.gov/drug/enforcement.json',
      query: 'test',
      fetched_at: '2026-10-12T00:00:00.000Z',
    },
    productNdcs: ['12345-678'],
    genericNames: ['Drug'],
    substances: [],
    lots: 'Lot A only',
    distribution: null,
    presentation: null,
    availability: null,
    location: null,
  };
  return investigationReportSchema.parse({
    generatedAt: '2026-10-13T00:00:00.000Z',
    investigation: {
      id: 'case-test',
      incidentId: incident.id,
      incidentSnapshot: incident,
      title: 'Drug',
      status: 'OPEN',
      createdAt: incident.updatedAt,
      updatedAt: incident.updatedAt,
      analysis: null,
      plan: null,
      notes: [],
      history: [],
    },
    sourceHistory: {
      incidentId: incident.id,
      versions: [],
      latest: null,
      hasMore: false,
      coverage: 'Only retained observations.',
    },
    archive: {
      printedMedicineName: 'Drug',
      observations: [],
      storedCaptures: 0,
      basis:
        'exact normalized printed medicine name; company/presentation identity is not established',
      coverage: 'Irregular coverage.',
    },
    feeds: [],
  });
}
describe('portable investigation report', () => {
  it('preserves recall lot scope and explicitly reports missing analysis, alternatives, decision, history and stock', () => {
    const html = renderInvestigationReport(report());
    for (const text of [
      'Lot A only',
      'Analysis has not been performed',
      'No candidate discovery saved',
      'No public-evidence next action',
      'No tracked fact versions',
      'does not establish resolution',
      'No stock, quote or cost scenario',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('Content-Security-Policy');
    expect(html).not.toContain('<script');
    expect(html).toContain('@media print');
    expect(html).toContain('not prescribing');
  });
  it('escapes hostile analyst/source text and refuses executable source URLs', () => {
    const data = report();
    const attack = '<script>alert("secret")</script><img src=x onerror=alert(1)>';
    data.investigation.incidentSnapshot.reason = attack;
    data.investigation.incidentSnapshot.sourceUrl = 'javascript:alert(1)';
    data.investigation.notes.push({ id: 'n', at: data.generatedAt, author: 'a', text: attack });
    const html = renderInvestigationReport(data);
    expect(html).not.toContain(attack);
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('unsupported URL');
  });
  it('shows the actual recorded public-evidence next action without claiming execution', () => {
    const data = report();
    data.investigation.decision = {
      action: 'escalate',
      rationale: 'Review the reported lots with a qualified professional.',
      candidateNdc: null,
      recordedAt: data.generatedAt,
      author: 'a',
    };
    const html = renderInvestigationReport(data);
    expect(html).toContain('Escalate for review');
    expect(html).toContain('does not place an order');
  });
});
it('separates fact changes from fetch times and identifier ordering, and retains null-to-known differences', () => {
  const original = report().investigation.incidentSnapshot;
  expect(sourceChanges(original, { ...original, updatedAt: '2026-10-13T00:00:00.000Z' })).toEqual(
    [],
  );
  expect(
    sourceChanges(
      { ...original, productNdcs: ['b', 'a'] },
      { ...original, productNdcs: ['a', 'b'] },
    ),
  ).toEqual([]);
  expect(
    sourceChanges(original, { ...original, status: 'Terminated', availability: 'Available' }),
  ).toMatchObject([
    { field: 'status', before: 'Ongoing', after: 'Terminated' },
    { field: 'availability', before: 'Not supplied', after: 'Available' },
  ]);
});
