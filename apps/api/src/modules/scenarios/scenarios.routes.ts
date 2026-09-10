/**
 * URL -> middleware -> controller. No logic.
 */

import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createScenariosController } from './scenarios.controller';
import {
  listScenariosQuerySchema,
  runScenariosBodySchema,
  scenarioParamsSchema,
} from './scenarios.schema';

import { createScenariosService } from './index';

export function createScenariosRouter(): Router {
  const controller = createScenariosController(createScenariosService());
  const router = Router();

  // Running a matrix is a command: it reads a cascade and a recommendation and
  // writes an immutable record of a decision.
  router.post(
    '/',
    requireAuth,
    requireScope('scenarios:run'),
    validate({ body: runScenariosBodySchema }),
    controller.run,
  );

  router.get(
    '/',
    requireAuth,
    requireScope('scenarios:read'),
    validate({ query: listScenariosQuerySchema }),
    controller.list,
  );

  router.get(
    '/:id',
    requireAuth,
    requireScope('scenarios:read'),
    validate({ params: scenarioParamsSchema }),
    controller.get,
  );

  return router;
}
