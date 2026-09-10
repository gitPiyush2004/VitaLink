/**
 * URL -> middleware -> controller. No logic.
 *
 * The scope split is the interesting part. Reading a recommendation is
 * `logistics:read`; producing one is `logistics:recommend`, because it calls out
 * to real carrier APIs and consumes real rate-limit allowance. A single
 * `logistics:*` scope would let a read-only viewer generate carrier traffic.
 */

import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createLogisticsController, type LogisticsController } from './logistics.controller';
import {
  listLogisticsQuerySchema,
  recommendFromCascadeBodySchema,
  rerunBodySchema,
  shipmentParamsSchema,
  urgencyPreviewQuerySchema,
} from './logistics.schema';

import { createLogisticsService } from './index';

/**
 * The two commands. Both call out to real carrier APIs, so both need
 * `logistics:recommend` rather than the read scope.
 */
function mountCommands(router: Router, controller: LogisticsController): void {
  router.post(
    '/recommendations',
    requireAuth,
    requireScope('logistics:recommend'),
    validate({ body: recommendFromCascadeBodySchema }),
    controller.recommendFromCascade,
  );

  router.post(
    '/shipments/:id/rerun',
    requireAuth,
    requireScope('logistics:recommend'),
    validate({ params: shipmentParamsSchema, body: rerunBodySchema }),
    controller.rerun,
  );
}

/** The reads. Everything here is a stored record; nothing calls a carrier. */
function mountQueries(router: Router, controller: LogisticsController): void {
  router.get(
    '/shipments',
    requireAuth,
    requireScope('logistics:read'),
    validate({ query: listLogisticsQuerySchema }),
    controller.listShipments,
  );

  router.get(
    '/shipments/:id',
    requireAuth,
    requireScope('logistics:read'),
    validate({ params: shipmentParamsSchema }),
    controller.getShipment,
  );

  router.get(
    '/recommendations',
    requireAuth,
    requireScope('logistics:read'),
    validate({ query: listLogisticsQuerySchema }),
    controller.listRecommendations,
  );

  router.get(
    '/recommendations/:id',
    requireAuth,
    requireScope('logistics:read'),
    validate({ params: shipmentParamsSchema }),
    controller.getRecommendation,
  );

  // The carrier-coverage panel, and the honest answer to "why is there only one
  // price in this table".
  router.get('/carriers', requireAuth, requireScope('logistics:read'), controller.listCarriers);

  router.get(
    '/urgency-preview',
    requireAuth,
    requireScope('logistics:read'),
    validate({ query: urgencyPreviewQuerySchema }),
    controller.previewUrgency,
  );
}

export function createLogisticsRouter(): Router {
  const controller = createLogisticsController(createLogisticsService());
  const router = Router();

  mountCommands(router, controller);
  mountQueries(router, controller);

  return router;
}
