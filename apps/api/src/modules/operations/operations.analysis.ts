import type { OpenFdaClient, ReliabilityClient } from '@vitalink/connectors';
import type { Incident, InvestigationAnalysis } from '@vitalink/contracts';

import type { CatalogService } from '@modules/catalog';
import type { GraphService } from '@modules/graph';
import { InsufficientDataError } from '@shared/errors';

import { matchIncident } from './domain/matching';

const HISTORY_LIMIT = 1000;
const HISTORY_YEARS = 3;
const DATE_LENGTH = 10;
export class InvestigationAnalyser {
  constructor(
    private readonly deps: {
      catalog: CatalogService;
      graph: GraphService;
      fda: OpenFdaClient;
      brain: ReliabilityClient;
    },
  ) {}

  async analyse(incident: Incident, generic: string): Promise<InvestigationAnalysis> {
    const result = await this.deps.catalog.refreshDrug(generic);
    const drug = await this.deps.catalog.getDrug(result.drugId);
    if (drug === null) {
      throw new InsufficientDataError('The requested medicine could not be loaded.');
    }
    const manufacturers = await this.deps.catalog.getManufacturers(drug.manufacturerIds);
    const match = matchIncident(incident, drug, manufacturers);
    if (match === null) {
      throw new InsufficientDataError(
        'No identifier, exact generic name, ingredient or company relationship connects this medicine to the incident.',
      );
    }
    const graph = await this.deps.graph.forDrug(drug.id);
    const analysis: InvestigationAnalysis = {
      drugId: drug.id,
      drugName: drug.genericName,
      analysedAt: new Date().toISOString(),
      match,
      concentration: drug.hhiManufacturers,
      labelerCount: drug.rawLabelerCount,
      storage: drug.temperatureRequirement,
      storageText: drug.storageTextRaw,
      nodes: graph.nodes,
      edges: graph.edges,
      reliability: null,
      reliabilityError: null,
      historyProvenance: null,
      assumptions: [
        'Network edges describe ingredient and labeler relationships, not measured shipment flows.',
        'Concentration measures product-listing shares, not production volume or market share.',
        'The API-supplier tier is unobserved: z_api=1 is a scenario assumption. Plant redundancy is a labeler-concentration proxy; production lines are assumed to be 1.',
        'Recall events are a product-level proxy for failures. Shortage recovery rates use the paper baseline because resolved-duration history is unavailable here.',
        'Long-run model availability is not the probability that this incident causes a shortage. Sensitivity bands are not confidence intervals.',
        ...result.warnings,
      ],
    };
    return { ...analysis, ...(await this.fit(analysis, drug.zPlant?.value ?? 1)) };
  }

  private async fit(
    analysis: InvestigationAnalysis,
    plants: number,
  ): Promise<
    Pick<InvestigationAnalysis, 'reliability' | 'reliabilityError' | 'historyProvenance'>
  > {
    let historyProvenance: InvestigationAnalysis['historyProvenance'] = null;
    try {
      const since = new Date();
      since.setUTCFullYear(since.getUTCFullYear() - HISTORY_YEARS);
      const date = since.toISOString().slice(0, DATE_LENGTH).replace(/-/g, '');
      const generic = analysis.drugName.replace(/["\\]/g, ' ');
      const history = await this.deps.fda.searchEnforcement({
        search: `openfda.generic_name:"${generic}" AND report_date:[${date} TO NOW]`,
        limit: HISTORY_LIMIT,
      });
      historyProvenance = history.provenance;
      if (history.data.length >= HISTORY_LIMIT) {
        throw new Error(
          'Recall history hit the fetch limit; the model was not fitted to an incomplete count.',
        );
      }
      const count = new Set(history.data.map((row) => row.event_id ?? row.recall_number)).size;
      const reliability = await this.deps.brain.fit(
        {
          drug_id: analysis.drugId,
          recall_count: count,
          observation_window_years: HISTORY_YEARS,
          resolved_shortage_durations_days: [],
          z_api: 1,
          z_plant: plants,
          z_line: 1,
        },
        history.provenance.fetched_at,
      );
      return { reliability, historyProvenance, reliabilityError: null };
    } catch (error) {
      return {
        reliability: null,
        historyProvenance,
        reliabilityError:
          error instanceof Error ? error.message : 'Reliability service unavailable',
      };
    }
  }
}
