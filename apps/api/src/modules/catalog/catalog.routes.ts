/**
 * URL -> middleware -> controller. No logic.
 */

import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createCatalogController } from './catalog.controller';
import { drugParamsSchema, listDrugsQuerySchema, refreshDrugBodySchema } from './catalog.schema';

import { createCatalogService } from './index';

export function createCatalogRouter(): Router {
  const controller = createCatalogController(createCatalogService());

  const router = Router();

  router.get(
    '/drugs',
    requireAuth,
    requireScope('catalog:read'),
    validate({ query: listDrugsQuerySchema }),
    controller.listDrugs,
  );

  router.get(
    '/drugs/:id',
    requireAuth,
    requireScope('catalog:read'),
    validate({ params: drugParamsSchema }),
    controller.getDrug,
  );

  // A refresh writes to the catalogue and hits an upstream API, so it needs a
  // write scope rather than `catalog:read`.
  router.post(
    '/drugs/refresh',
    requireAuth,
    requireScope('admin:all'),
    validate({ body: refreshDrugBodySchema }),
    controller.refreshDrug,
  );

  return router;
}
