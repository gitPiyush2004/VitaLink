/**
 * The cascade module's public surface.
 */

import { createCatalogService } from '@modules/catalog';
import { createGraphService } from '@modules/graph';

import { createCascadeRepository } from './cascade.repository';
import { CascadeService } from './cascade.service';

export { CascadeService } from './cascade.service';
export type { CascadeRecord, ExposedDrugRecord } from './cascade.repository';

/** A fully wired `CascadeService`. */
export function createCascadeService(): CascadeService {
  return new CascadeService(
    createCascadeRepository(),
    createGraphService(),
    createCatalogService(),
  );
}
