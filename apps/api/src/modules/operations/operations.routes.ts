import { Router } from 'express';

import { requireAuth, requireScope } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createOperationsController } from './operations.controller';
import {
  analyseBody,
  createBody,
  idParams,
  planBody,
  updateBody,
  watchBody,
  traceBody,
  linkBody,
} from './operations.schema';

export function createOperationsRouter(): Router {
  const router = Router();
  const c = createOperationsController();
  router.use(requireAuth);
  router.get('/', requireScope('cases:read'), c.dashboard);
  router.post('/refresh', requireScope('cases:write'), c.refresh);
  router.post(
    '/investigations',
    requireScope('cases:write'),
    validate({ body: createBody }),
    c.create,
  );
  router.get(
    '/investigations/:id',
    requireScope('cases:read'),
    validate({ params: idParams }),
    c.get,
  );
  router.post(
    '/investigations/:id/analyse',
    requireScope('cases:write'),
    validate({ params: idParams, body: analyseBody }),
    c.analyse,
  );
  router.post(
    '/investigations/:id/candidates',
    requireScope('cases:write'),
    validate({ params: idParams }),
    c.candidates,
  );
  router.post(
    '/investigations/:id/plan',
    requireScope('cases:write'),
    validate({ params: idParams, body: planBody }),
    c.plan,
  );
  mountChanges(router, c);
  return router;
}

function mountChanges(router: Router, c: ReturnType<typeof createOperationsController>): void {
  router.post(
    '/investigations/:id/trace',
    requireScope('cascade:run'),
    validate({ params: idParams, body: traceBody }),
    c.trace,
  );
  router.post(
    '/investigations/:id/link',
    requireScope('cases:write'),
    validate({ params: idParams, body: linkBody }),
    c.link,
  );
  router.patch(
    '/investigations/:id',
    requireScope('cases:write'),
    validate({ params: idParams, body: updateBody }),
    c.update,
  );
  router.post('/watches', requireScope('cases:write'), validate({ body: watchBody }), c.watch);
  router.delete(
    '/watches/:id',
    requireScope('cases:write'),
    validate({ params: idParams }),
    c.removeWatch,
  );
}
