/**
 * The signals module's public surface. See `modules/auth/index.ts` for why
 * every module has one.
 */

import { createCatalogService } from '@modules/catalog';
import { createGraphService } from '@modules/graph';
import { getSourceClients } from '@shared/connectors';

import { createSignalsRepository } from './signals.repository';
import { SignalsService } from './signals.service';

export { SignalsService } from './signals.service';
export type { IngestOutcome, VerifyOutcome } from './signals.service';
export type { AlertRecord, QuarantineRecordEntity, SignalRecord } from './signals.repository';

/** A fully wired `SignalsService`, sharing the process-wide HTTP client. */
export function createSignalsService(): SignalsService {
  const sources = getSourceClients();

  return new SignalsService({
    repository: createSignalsRepository(),
    openFda: sources.openFda,
    gdelt: sources.gdelt,
    graph: createGraphService(),
    catalog: createCatalogService(),
  });
}
