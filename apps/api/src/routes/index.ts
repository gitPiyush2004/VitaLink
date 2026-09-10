/**
 * Every module's router, mounted under one prefix.
 *
 * This file is the map of the API. A reader looking for "where does
 * /api/v1/logistics/recommend go?" starts here, and gets to the answer in two
 * hops: this file names the module, the module's `*.routes.ts` names the
 * controller method.
 */

import { Router } from 'express';

import { createAuthRouter } from '@modules/auth/auth.routes';
import { createCascadeRouter } from '@modules/cascade/cascade.routes';
import { createCatalogRouter } from '@modules/catalog/catalog.routes';
import { createLogisticsRouter } from '@modules/logistics/logistics.routes';
import { createScenariosRouter } from '@modules/scenarios/scenarios.routes';
import { createSignalsRouter } from '@modules/signals/signals.routes';

export function createApiRouter(): Router {
  const router = Router();

  router.use('/auth', createAuthRouter());
  router.use('/catalog', createCatalogRouter());
  router.use('/cascade', createCascadeRouter());
  router.use('/logistics', createLogisticsRouter());
  router.use('/signals', createSignalsRouter());
  router.use('/scenarios', createScenariosRouter());

  // The graph module has no router of its own on purpose. It is read through
  // the cascade — "which drugs does this shock reach, and by what path" — and a
  // raw graph-dump endpoint would invite a client to re-implement the traversal
  // with different pruning than the cascade uses.

  return router;
}
