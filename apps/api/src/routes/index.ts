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

export function createApiRouter(): Router {
  const router = Router();

  router.use('/auth', createAuthRouter());
  router.use('/catalog', createCatalogRouter());
  router.use('/cascade', createCascadeRouter());

  return router;
}
