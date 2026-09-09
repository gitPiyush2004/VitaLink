/**
 * URL -> middleware -> controller. No logic.
 */

import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createCascadeController } from './cascade.controller';
import {
  cascadeParamsSchema,
  listCascadesQuerySchema,
  runCascadeBodySchema,
} from './cascade.schema';

import { createCascadeService } from './index';

export function createCascadeRouter(): Router {
  const controller = createCascadeController(createCascadeService());
  const router = Router();

  // Running a cascade is a command with real cost, so it needs `cascade:run`
  // rather than the read scope.
  router.post(
    '/run',
    requireAuth,
    requireScope('cascade:run'),
    validate({ body: runCascadeBodySchema }),
    controller.run,
  );

  router.get(
    '/',
    requireAuth,
    requireScope('cascade:read'),
    validate({ query: listCascadesQuerySchema }),
    controller.list,
  );

  router.get(
    '/:id',
    requireAuth,
    requireScope('cascade:read'),
    validate({ params: cascadeParamsSchema }),
    controller.get,
  );

  return router;
}
