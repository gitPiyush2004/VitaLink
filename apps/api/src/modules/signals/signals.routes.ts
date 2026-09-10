/**
 * URL -> middleware -> controller. No logic.
 *
 * Ingestion and verification are commands that reach three external APIs, so
 * they need `alerts:read`'s write counterpart. There is no `signals:write` in
 * the scope list, and rather than invent one they are gated on `cascade:run` —
 * the same scope that authorises the other operation with real external cost.
 * Recorded here rather than silently chosen.
 */

import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createSignalsController } from './signals.controller';
import { listSignalsQuerySchema, signalParamsSchema } from './signals.schema';

import { createSignalsService } from './index';

export function createSignalsRouter(): Router {
  const controller = createSignalsController(createSignalsService());
  const router = Router();

  router.post('/ingest', requireAuth, requireScope('cascade:run'), controller.ingest);
  router.post('/verify', requireAuth, requireScope('cascade:run'), controller.verify);

  router.get(
    '/',
    requireAuth,
    requireScope('signals:read'),
    validate({ query: listSignalsQuerySchema }),
    controller.listSignals,
  );

  router.get(
    '/alerts',
    requireAuth,
    requireScope('alerts:read'),
    validate({ query: listSignalsQuerySchema }),
    controller.listAlerts,
  );

  router.get(
    '/alerts/:id',
    requireAuth,
    requireScope('alerts:read'),
    validate({ params: signalParamsSchema }),
    controller.getAlert,
  );

  // The quarantine view. Not a failure log — it is how the system states how
  // much of what it sees it can actually corroborate.
  router.get(
    '/quarantine',
    requireAuth,
    requireScope('quarantine:read'),
    validate({ query: listSignalsQuerySchema }),
    controller.listQuarantine,
  );

  router.get(
    '/quarantine/summary',
    requireAuth,
    requireScope('quarantine:read'),
    controller.quarantineSummary,
  );

  return router;
}
