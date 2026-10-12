import { describe, expect, it, vi } from 'vitest';

import {
  incidentSchema,
  investigationSchema,
  investigationDecisionInputSchema,
} from '@vitalink/contracts';

vi.mock('@modules/cascade', () => ({ createCascadeService: vi.fn() }));
vi.mock('@modules/graph', () => ({ createGraphService: vi.fn() }));
vi.mock('@modules/logistics', () => ({ createLogisticsService: vi.fn() }));

import { selectResponse } from '../domain/decision';
import { incidentDigest, incidentVersion } from '../domain/incident-history';
import type { InvestigationAnalyser } from '../operations.analysis';
import type { CandidateDiscovery } from '../operations.candidates';
import type { OperationsRepository } from '../operations.repository';
import { OperationsService } from '../operations.service';

function record() {
  const incident = incidentSchema.parse({
    id: 'recall:TEST',
    kind: 'RECALL',
    title: 'Drug',
    product: 'Drug',
    company: 'Company',
    status: 'Ongoing',
    classification: 'Class II',
    reason: 'Reported reason',
    publishedAt: '2026-10-01T00:00:00.000Z',
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
    distribution: 'US',
    presentation: null,
    availability: null,
    location: null,
  });
  return investigationSchema.parse({
    id: 'case-test',
    incidentId: incident.id,
    incidentSnapshot: incident,
    title: 'Drug',
    status: 'OPEN',
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
    analysis: null,
    plan: null,
    notes: [],
    history: [],
  });
}
function setup() {
  const value = record();
  const repo = {
    case: vi.fn().mockResolvedValue(value),
    saveCase: vi.fn().mockResolvedValue(true),
    incidentHistory: vi.fn().mockResolvedValue({ versions: [], hasMore: false }),
    incident: vi.fn().mockResolvedValue(null),
    feeds: vi.fn().mockResolvedValue([]),
    archiveMedicine: vi.fn().mockResolvedValue({ observations: [] }),
  };
  const analyser = { analyse: vi.fn() };
  return {
    value,
    repo,
    analyser,
    service: new OperationsService(
      repo as unknown as OperationsRepository,
      analyser as unknown as InvestigationAnalyser,
      {} as CandidateDiscovery,
    ),
  };
}
describe('fact fingerprints', () => {
  it('does not turn a refresh timestamp or geocoding update into a regulatory change', () => {
    const original = record().incidentSnapshot;
    const refresh = {
      ...original,
      updatedAt: '2026-10-13T00:00:00.000Z',
      provenance: { ...original.provenance, fetched_at: '2026-10-13T00:00:00.000Z' },
    };
    expect(incidentDigest(refresh)).toBe(incidentDigest(original));
    expect(incidentDigest({ ...refresh, status: 'Terminated' })).not.toBe(incidentDigest(original));
    expect(incidentDigest({ ...refresh, lots: 'Lot B only' })).not.toBe(incidentDigest(original));
    const located = {
      ...original,
      location: {
        label: 'Boston, US',
        city: 'Boston',
        country: 'US',
        coordinates: null,
        precision: 'recalling-firm city' as const,
        provenance: null,
      },
    };
    expect(
      incidentDigest({ ...located, location: { ...located.location, coordinates: [-71, 42] } }),
    ).toBe(incidentDigest(located));
  });
  it('retains capture and later retention times separately, with deterministic identities for repeated imports', () => {
    const original = record().incidentSnapshot;
    const first = incidentVersion(original, 'retained_before_tracking', '2026-10-13T00:00:00.000Z');
    expect(first.observedAt).toBe(original.provenance.fetched_at);
    expect(first.recordedAt).not.toBe(first.observedAt);
    expect(incidentVersion(original, 'live_refresh', '2026-10-14T00:00:00.000Z').id).toBe(first.id);
    expect(
      incidentVersion({ ...original, status: 'Terminated' }, 'live_refresh', first.recordedAt).id,
    ).not.toBe(first.id);
  });
});
describe('public-evidence decisions and case safety', () => {
  it('invalidates a decision tied to a different selected response without altering the old record', () => {
    const value = record();
    value.plan = {
      rows: [{ id: 'old' }, { id: 'new' }],
      selectedOptionId: 'old',
    } as unknown as NonNullable<typeof value.plan>;
    value.decision = {
      action: 'documented_response',
      candidateNdc: null,
      rationale: 'Follow the earlier response.',
      author: 'a',
      recordedAt: value.updatedAt,
    };
    value.status = 'ACTIONED';
    const next = selectResponse(value, 'new');
    expect(next.decision).toBeNull();
    expect(next.status).toBe('INVESTIGATING');
    expect(value.plan.selectedOptionId).toBe('old');
    expect(value.decision).not.toBeNull();
  });
  it('can record a real-evidence next action without stock, quotes or a scenario plan', async () => {
    const { service, repo, value } = setup();
    const saved = await service.decide('org-a', 'analyst-a', value.id, {
      action: 'monitor',
      candidateNdc: null,
      rationale: 'Monitor the source for changes; affected lots need professional review.',
    });
    expect(saved.status).toBe('ACTIONED');
    expect(saved.plan).toBeNull();
    expect(saved.decision?.action).toBe('monitor');
    expect(repo.case).toHaveBeenCalledWith('org-a', value.id);
    expect(repo.saveCase).toHaveBeenCalledWith('org-a', expect.any(Object), value.updatedAt);
    expect(saved.incidentSnapshot).toEqual(value.incidentSnapshot);
  });
  it('rejects fabricated candidate selections and an unselected response scenario', async () => {
    const { service, repo, value } = setup();
    await expect(
      service.decide('org-a', 'a', value.id, {
        action: 'investigate_candidate',
        candidateNdc: 'unknown',
        rationale: 'Investigate this product.',
      }),
    ).rejects.toThrow('saved candidate');
    await expect(
      service.decide('org-a', 'a', value.id, {
        action: 'documented_response',
        candidateNdc: null,
        rationale: 'Follow the response plan.',
      }),
    ).rejects.toThrow('Select a saved response');
    expect(repo.saveCase).not.toHaveBeenCalled();
    expect(
      investigationDecisionInputSchema.safeParse({
        action: 'monitor',
        candidateNdc: '123',
        rationale: 'An invalid selection.',
      }).success,
    ).toBe(false);
  });
  it('rejects a stale decision write and does not expose a different organisation’s report', async () => {
    const { service, repo, value } = setup();
    repo.saveCase.mockResolvedValue(false);
    await expect(
      service.decide('org-a', 'a', value.id, {
        action: 'escalate',
        candidateNdc: null,
        rationale: 'Request professional scope review.',
      }),
    ).rejects.toThrow('changed while');
    repo.case.mockResolvedValue(null);
    await expect(service.report('org-b', value.id)).rejects.toThrow('not found');
    expect(repo.incidentHistory).not.toHaveBeenCalled();
    expect(repo.archiveMedicine).not.toHaveBeenCalled();
  });
  it('invalidates an old decision when the medicine analysis changes', async () => {
    const { service, analyser, value } = setup();
    value.decision = {
      action: 'monitor',
      candidateNdc: null,
      rationale: 'Review the previous medicine.',
      recordedAt: value.updatedAt,
      author: 'a',
    };
    analyser.analyse.mockResolvedValue({ drugName: 'New medicine' });
    const saved = await service.analyse('org-a', 'a', value.id, 'New medicine');
    expect(saved.decision).toBeNull();
    expect(saved.candidates).toBeNull();
    expect(saved.status).toBe('INVESTIGATING');
  });
});
