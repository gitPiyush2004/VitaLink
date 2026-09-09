/**
 * The catalogue module's public surface. See `modules/auth/index.ts` for why
 * every module has one.
 */

import { getSourceClients } from '@shared/connectors';

import { createCatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

export { CatalogService } from './catalog.service';
export type { DrugEntity, RefreshOutcome } from './catalog.types';

/** A fully wired `CatalogService`, sharing the process-wide HTTP client. */
export function createCatalogService(): CatalogService {
  return new CatalogService(createCatalogRepository(), getSourceClients().openFda);
}
