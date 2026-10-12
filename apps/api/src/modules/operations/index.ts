import { ReliabilityClient } from '@vitalink/connectors';

import { env } from '@config/env';
import { createCatalogService } from '@modules/catalog';
import { createGraphService } from '@modules/graph';
import { getSourceClients } from '@shared/connectors';

import { InvestigationAnalyser } from './operations.analysis';
import { OperationsIngestion } from './operations.ingestion';
import { createOperationsRepository } from './operations.repository';
import { OperationsService } from './operations.service';

export function createOperationsService(): OperationsService {
  return new OperationsService(
    createOperationsRepository(),
    new InvestigationAnalyser({
      catalog: createCatalogService(),
      graph: createGraphService(),
      fda: getSourceClients().openFda,
      brain: new ReliabilityClient(env.BRAIN_BASE_URL, env.BRAIN_SHARED_SECRET),
    }),
  );
}
export function createOperationsIngestion(): OperationsIngestion {
  const sources = getSourceClients();
  return new OperationsIngestion(createOperationsRepository(), sources.openFda, sources.nominatim);
}
export { startOperationsWorker, queueRefresh, workerStatus } from './operations.queue';
