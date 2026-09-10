/**
 * The logistics module's public surface. See `modules/auth/index.ts` for why
 * every module has one.
 */

import { createCascadeService } from '@modules/cascade';
import { createCatalogService } from '@modules/catalog';
import { getCarrierRegistry } from '@shared/connectors/carriers';

import { createLogisticsRepository } from './logistics.repository';
import { LogisticsService } from './logistics.service';

export { LogisticsService } from './logistics.service';
export type { RecommendFromCascadeInput, RecommendationWithShipment } from './logistics.service';
export type { RecommendationRecord, ShipmentRecord } from './logistics.repository';

/** A fully wired `LogisticsService`, sharing the process-wide carrier registry. */
export function createLogisticsService(): LogisticsService {
  return new LogisticsService({
    repository: createLogisticsRepository(),
    carriers: getCarrierRegistry(),
    cascades: createCascadeService(),
    catalog: createCatalogService(),
  });
}
