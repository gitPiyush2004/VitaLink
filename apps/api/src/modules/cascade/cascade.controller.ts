/**
 * Thin controllers: read validated input, call the service, shape the response.
 */

import type { Request, RequestHandler, Response } from 'express';

import { NotFoundError, UnauthenticatedError } from '@shared/errors';
import { sendCreated, sendOk } from '@shared/http';

import type { CascadeParams, ListCascadesQuery, RunCascadeBody } from './cascade.schema';
import type { CascadeService } from './cascade.service';

export type CascadeController = {
  run: RequestHandler;
  get: RequestHandler;
  list: RequestHandler;
};

export function createCascadeController(service: CascadeService): CascadeController {
  return {
    async run(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const body = req.body as RunCascadeBody;

      const cascade = await service.run({
        orgId: req.auth.org,
        shockNodeId: body.shock_node_id,
        alertId: body.alert_id,
        durationDays: body.duration_days,
        ...(body.decay === undefined ? {} : { decay: body.decay }),
        ...(body.max_depth === undefined ? {} : { maxDepth: body.max_depth }),
        assumedCoverDays: body.assumed_cover_days,
      });

      sendCreated(res, cascade);
    },

    async get(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as CascadeParams;

      const cascade = await service.get(req.auth.org, id);
      if (cascade === null) throw new NotFoundError('Cascade', id);

      sendOk(res, cascade);
    },

    async list(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListCascadesQuery;

      sendOk(res, await service.listRecent(req.auth.org, query.limit));
    },
  };
}
