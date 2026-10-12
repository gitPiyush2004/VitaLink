import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';

import { UnauthenticatedError } from '@shared/errors';
import { sendCreated, sendOk } from '@shared/http';

import type {
  analyseBody,
  createBody,
  idParams,
  linkBody,
  planBody,
  traceBody,
  updateBody,
  watchBody,
} from './operations.schema';
import type { OperationsService } from './operations.service';

import { createOperationsService, queueRefresh, workerStatus } from './index';

function identity(req: Request) {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}
function id(req: Request): string {
  return (req.params as unknown as z.infer<typeof idParams>).id;
}
function commands(
  service: OperationsService,
): Record<'create' | 'analyse' | 'plan', RequestHandler> {
  return {
    create: async (req, res) => {
      const auth = identity(req);
      sendCreated(
        res,
        await service.create(
          auth.org,
          auth.sub,
          (req.body as z.infer<typeof createBody>).incidentId,
        ),
      );
    },
    analyse: async (req, res) => {
      const auth = identity(req);
      sendOk(
        res,
        await service.analyse(
          auth.org,
          auth.sub,
          id(req),
          (req.body as z.infer<typeof analyseBody>).generic,
        ),
      );
    },
    plan: async (req, res) => {
      const auth = identity(req);
      sendOk(
        res,
        await service.plan(auth.org, auth.sub, id(req), req.body as z.infer<typeof planBody>),
      );
    },
  };
}
function traceCommands(
  service: OperationsService,
): Record<'trace' | 'link' | 'update', RequestHandler> {
  return {
    trace: async (req, res) => {
      const auth = identity(req);
      sendOk(
        res,
        await service.trace(auth.org, auth.sub, id(req), req.body as z.infer<typeof traceBody>),
      );
    },
    link: async (req, res) => {
      const auth = identity(req);
      sendOk(
        res,
        await service.linkRecommendation(
          auth.org,
          auth.sub,
          id(req),
          (req.body as z.infer<typeof linkBody>).recommendationId,
        ),
      );
    },
    update: async (req, res) => {
      const auth = identity(req);
      sendOk(
        res,
        await service.update(auth.org, auth.sub, id(req), req.body as z.infer<typeof updateBody>),
      );
    },
  };
}
export function createOperationsController() {
  const service = createOperationsService();
  const queries: Record<'dashboard' | 'refresh' | 'get' | 'watch' | 'removeWatch', RequestHandler> =
    {
      dashboard: async (req, res) => {
        sendOk(res, {
          ...(await service.dashboard(identity(req).org)),
          worker: await workerStatus(),
        });
      },
      refresh: async (_req, res) => {
        sendOk(res, await queueRefresh());
      },
      get: async (req, res) => {
        sendOk(res, await service.get(identity(req).org, id(req)));
      },
      watch: async (req, res) => {
        sendCreated(
          res,
          await service.watch(identity(req).org, req.body as z.infer<typeof watchBody>),
        );
      },
      removeWatch: async (req, res) => {
        await service.removeWatch(identity(req).org, id(req));
        sendOk(res, { removed: true });
      },
    };
  return { ...queries, ...commands(service), ...traceCommands(service) };
}
