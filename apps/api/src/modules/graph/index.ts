/**
 * The graph module's public surface. See `modules/auth/index.ts` for why every
 * module has one.
 */

import { createCatalogService } from '@modules/catalog';

import { createGraphRepository } from './graph.repository';
import { GraphService } from './graph.service';

export { GraphService } from './graph.service';
export type { RebuildOutcome } from './graph.service';

/** A fully wired `GraphService`. */
export function createGraphService(): GraphService {
  return new GraphService(createGraphRepository(), createCatalogService());
}
