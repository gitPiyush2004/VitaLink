import { ReliabilityClient } from '@vitalink/connectors';

import { env } from '@config/env';
import { createCatalogService } from '@modules/catalog';
import { createGraphService } from '@modules/graph';
import { getSourceClients } from '@shared/connectors';

import { InvestigationAnalyser } from './operations.analysis';
import { CandidateDiscovery } from './operations.candidates';
import { OperationsIngestion } from './operations.ingestion';
import { createOperationsRepository } from './operations.repository';
import { OperationsService } from './operations.service';

export function createOperationsService(): OperationsService {
  const fda = getSourceClients().openFda;
  return new OperationsService(
    createOperationsRepository(),
    new InvestigationAnalyser({
      catalog: createCatalogService(),
      graph: createGraphService(),
      fda,
      brain: new ReliabilityClient(env.BRAIN_BASE_URL, env.BRAIN_SHARED_SECRET),
    }),
    new CandidateDiscovery(fda),
  );
}
export function createOperationsIngestion(): OperationsIngestion {
  const sources = getSourceClients();
  return new OperationsIngestion(createOperationsRepository(), sources.openFda, sources.nominatim);
}
export { startOperationsWorker, queueRefresh, workerStatus } from './operations.queue';
