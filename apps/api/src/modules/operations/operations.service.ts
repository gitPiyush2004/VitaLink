import { randomUUID } from 'node:crypto';

import type { Investigation, ResponsePlanInput, Watch } from '@vitalink/contracts';

import { createCascadeService } from '@modules/cascade';
import { createGraphService } from '@modules/graph';
import { createLogisticsService } from '@modules/logistics';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';

import { compareResponses } from './domain/response-plan';
import type { InvestigationAnalyser } from './operations.analysis';
import type { CandidateDiscovery } from './operations.candidates';
import type { OperationsRepository } from './operations.repository';

function updateDescription(input: {
  note?: string | undefined;
  status?: string | undefined;
  selectedOptionId?: string | undefined;
}): string {
  return [
    input.note ? 'Analyst note added.' : '',
    input.status ? `Status: ${input.status}.` : '',
    input.selectedOptionId ? `Response selected: ${input.selectedOptionId}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
export class OperationsService {
  constructor(
    private readonly repo: OperationsRepository,
    private readonly analyser: InvestigationAnalyser,
    private readonly discovery: CandidateDiscovery,
  ) {}

  async dashboard(org: string) {
    const [incidents, feeds, investigations, watches] = await Promise.all([
      this.repo.incidents(),
      this.repo.feeds(),
      this.repo.cases(org),
      this.repo.watches(org),
    ]);
    return { incidents, feeds, investigations, watches };
  }

  async get(org: string, id: string): Promise<Investigation> {
    const record = await this.repo.case(org, id);
    if (!record) throw new NotFoundError('Investigation', id);
    return record;
  }

  async create(org: string, author: string, incidentId: string): Promise<Investigation> {
    const incident = await this.repo.incident(incidentId);
    if (!incident) throw new NotFoundError('Incident', incidentId);
    const at = new Date().toISOString();
    const record: Investigation = {
      id: randomUUID(),
      incidentId,
      incidentSnapshot: incident,
      title: incident.title,
      status: 'OPEN',
      createdAt: at,
      updatedAt: at,
      cascadeId: null,
      recommendationId: null,
      analysis: null,
      candidates: null,
      plan: null,
      notes: [],
      history: [{ at, action: 'Investigation opened; source evidence preserved.', author }],
    };
    await this.repo.saveCase(org, record);
    return record;
  }

  private async save(
    org: string,
    author: string,
    record: Investigation,
    action: string,
  ): Promise<Investigation> {
    const previous = record.updatedAt;
    const at = new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
    const next = { ...record, updatedAt: at, history: [...record.history, { at, author, action }] };
    if (!(await this.repo.saveCase(org, next, previous))) {
      throw new ConflictError(
        'This investigation changed while you were working. Reload and try again.',
      );
    }
    return next;
  }

  async analyse(org: string, author: string, id: string, generic: string): Promise<Investigation> {
    const record = await this.get(org, id);
    const analysis = await this.analyser.analyse(record.incidentSnapshot, generic);
    return this.save(
      org,
      author,
      {
        ...record,
        analysis,
        candidates: null,
        plan: null,
        cascadeId: null,
        recommendationId: null,
        status: 'INVESTIGATING',
      },
      `Analysed ${analysis.drugName}; any earlier candidate comparison and response comparison were cleared.`,
    );
  }

  /**
   * Discovers products sharing the investigated medicine's active ingredient.
   *
   * A candidate set is evidence for investigation, never a substitution
   * recommendation, so the history entry says what was found rather than what
   * should be done.
   */
  async discoverCandidates(org: string, author: string, id: string): Promise<Investigation> {
    const record = await this.get(org, id);
    if (!record.analysis) {
      throw new ValidationError('Identify a related medicine before discovering candidates.');
    }
    const { reference, provenance } = await this.discovery.reference({
      productNdcs: record.incidentSnapshot.productNdcs,
      genericName: record.analysis.drugName,
    });
    const candidates = await this.discovery.discover(reference, provenance);
    const usable = candidates.candidates.filter((one) => one.exclusions.length === 0).length;
    return this.save(
      org,
      author,
      { ...record, candidates },
      `Candidate discovery on ${reference.ingredient}: ${String(candidates.candidates.length)} FDA listings retrieved, ${String(usable)} without a disqualifying exclusion. Listings are not offers or stock.`,
    );
  }

  async trace(
    org: string,
    author: string,
    id: string,
    input: { shockNodeId: string; coverDays: number; durationDays: number },
  ): Promise<Investigation> {
    const record = await this.get(org, id);
    if (
      !record.analysis?.nodes.some((node) => node.id === input.shockNodeId && node.type !== 'drug')
    ) {
      throw new ValidationError(
        'Choose a related ingredient or labeler from the evidence network.',
      );
    }
    // Rebuild the network around the selected upstream entity across the ingested catalogue.
    const snapshot = await createGraphService().forShock(input.shockNodeId);
    const cascade = await createCascadeService().run({
      orgId: org,
      shockNodeId: input.shockNodeId,
      alertId: null,
      assumedCoverDays: input.coverDays,
      durationDays: input.durationDays,
      snapshot,
    });
    return this.save(
      org,
      author,
      { ...record, cascadeId: cascade.id, recommendationId: null },
      `Conditional impact trace saved: ${cascade.id}. This is an analyst-selected shock, not an independently verified alert.`,
    );
  }

  async linkRecommendation(
    org: string,
    author: string,
    id: string,
    recommendationId: string,
  ): Promise<Investigation> {
    const record = await this.get(org, id);
    const logistics = createLogisticsService();
    const recommendation = await logistics.getRecommendation(org, recommendationId);
    if (!recommendation) throw new NotFoundError('Recommendation', recommendationId);
    const shipment = await logistics.getShipment(org, recommendation.shipmentRequestId);
    if (
      shipment?.request.context?.cascade_id !== record.cascadeId ||
      shipment.request.context.drug_id !== record.analysis?.drugId
    ) {
      throw new ValidationError(
        'This recommendation belongs to a different investigation context.',
      );
    }
    return this.save(
      org,
      author,
      { ...record, recommendationId },
      `Carrier comparison preserved: ${recommendationId}.`,
    );
  }

  async plan(
    org: string,
    author: string,
    id: string,
    input: ResponsePlanInput,
  ): Promise<Investigation> {
    const record = await this.get(org, id);
    if (!record.analysis) {
      throw new ValidationError('Identify a related medicine before comparing responses.');
    }
    return this.save(
      org,
      author,
      {
        ...record,
        status: 'INVESTIGATING',
        plan: compareResponses(input, new Date().toISOString()),
      },
      'Response options compared using recorded operator inputs.',
    );
  }

  async update(
    org: string,
    author: string,
    id: string,
    input: {
      note?: string | undefined;
      status?: Investigation['status'] | undefined;
      selectedOptionId?: string | undefined;
    },
  ): Promise<Investigation> {
    const record = await this.get(org, id);
    if (input.selectedOptionId !== undefined) {
      if (!record.plan?.rows.some((row) => row.id === input.selectedOptionId)) {
        throw new ValidationError('Select an option from the saved comparison.');
      }
      record.plan.selectedOptionId = input.selectedOptionId;
    }
    if (input.note) {
      record.notes.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        author,
        text: input.note,
      });
    }
    if (input.status === 'ACTIONED' && !record.plan?.selectedOptionId) {
      throw new ValidationError('Record a response decision before marking this actioned.');
    }
    record.status = input.status ?? record.status;
    return this.save(org, author, record, updateDescription(input));
  }

  async watch(org: string, input: Pick<Watch, 'term' | 'kind'>): Promise<Watch> {
    const watch = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.repo.saveWatch(org, watch);
    return watch;
  }

  async removeWatch(org: string, id: string): Promise<void> {
    await this.repo.removeWatch(org, id);
  }
}
