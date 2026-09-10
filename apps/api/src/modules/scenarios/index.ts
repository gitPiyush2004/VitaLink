/**
 * The scenarios module's public surface. See `modules/auth/index.ts` for why
 * every module has one.
 */

import { createCascadeService } from '@modules/cascade';
import { createCatalogService } from '@modules/catalog';
import { createLogisticsService } from '@modules/logistics';

import { createScenariosRepository } from './scenarios.repository';
import { ScenariosService } from './scenarios.service';

export { ScenariosService } from './scenarios.service';
// The objective breakdown as a table. Exported here rather than reached for
// directly, so the module boundary stays real — the CLI and the UI both need it
// and neither should import `domain/`.
export { explainObjective } from './domain/pareto';
export type { RunScenariosInput } from './scenarios.service';
export type { ScenarioRunRecord } from './scenarios.repository';

/** A fully wired `ScenariosService`. */
export function createScenariosService(): ScenariosService {
  return new ScenariosService({
    repository: createScenariosRepository(),
    cascades: createCascadeService(),
    catalog: createCatalogService(),
    logistics: createLogisticsService(),
  });
}
