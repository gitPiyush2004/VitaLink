/**
 * Liveness and readiness (PART 3A.5 rule 9).
 *
 * The distinction matters operationally and is worth being able to explain:
 *
 *   /health  — "is this process alive?" Answers without touching anything else.
 *              An orchestrator that gets a failure here restarts the container.
 *   /ready   — "can this process serve traffic?" Checks Mongo and Redis. A
 *              failure here removes the instance from the load balancer but does
 *              not restart it, because the fault is probably downstream.
 *
 * Getting these the wrong way round causes a restart loop during a database
 * blip: every instance fails liveness, every instance restarts, and none of them
 * is ever available to serve the requests that would have succeeded.
 */

import { Router } from 'express';

import { isMongoReady, isRedisReady } from '@shared/db';
import { HTTP_STATUS } from '@shared/errors';
import { sendOk } from '@shared/http';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    sendOk(res, { status: 'ok', uptime_seconds: Math.floor(process.uptime()) });
  });

  router.get('/ready', async (_req, res) => {
    const [mongo, redis] = await Promise.all([Promise.resolve(isMongoReady()), isRedisReady()]);

    const isReady = mongo && redis;

    // Not using `sendOk` here: readiness has to be able to answer with a 503,
    // and the body deliberately reports which dependency is the problem.
    res
      .status(isReady ? HTTP_STATUS.ok : HTTP_STATUS.serviceUnavailable)
      .json({ success: isReady, data: { mongo, redis } });
  });

  return router;
}
