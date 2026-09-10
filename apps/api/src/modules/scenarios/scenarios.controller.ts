/**
 * Thin controllers: read validated input, call the service, shape the response.
 */

import type { Request, RequestHandler, Response } from 'express';

import { NotFoundError, UnauthenticatedError } from '@shared/errors';
import { sendCreated, sendOk } from '@shared/http';

import type { SourcingOption } from './domain/enumerate';
import type { ListScenariosQuery, RunScenariosBody, ScenarioParams } from './scenarios.schema';
import type { ScenariosService } from './scenarios.service';

export type ScenariosController = {
  run: RequestHandler;
  get: RequestHandler;
  list: RequestHandler;
};

/** A straight rename. No defaults applied — the schema requires every field. */
function toSourcing(body: RunScenariosBody['sourcing']): SourcingOption[] {
  return body.map((one) => ({
    kind: one.kind,
    label: one.label,
    targetNodeId: one.target_node_id,
    leadTimeDays: one.lead_time_days,
    interventionCostInr: one.intervention_cost_inr,
    shortageReductionFraction: one.shortage_reduction_fraction,
  }));
}

export function createScenariosController(service: ScenariosService): ScenariosController {
  return {
    async run(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const body = req.body as RunScenariosBody;

      sendCreated(
        res,
        await service.run({
          orgId: req.auth.org,
          cascadeId: body.cascade_id,
          drugId: body.drug_id,
          recommendationId: body.recommendation_id,
          sourcing: toSourcing(body.sourcing),
          distanceKm: body.distance_km,
          ...(body.weights === undefined ? {} : { weights: body.weights }),
        }),
      );
    },

    async get(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as ScenarioParams;

      const run = await service.get(req.auth.org, id);
      if (run === null) throw new NotFoundError('Scenario run', id);

      sendOk(res, run);
    },

    async list(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListScenariosQuery;

      sendOk(res, await service.listRecent(req.auth.org, query.limit));
    },
  };
}
