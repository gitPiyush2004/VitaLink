/**
 * Thin controllers: read validated input, call the service, shape the response.
 */

import type { Request, RequestHandler, Response } from 'express';

import { NotFoundError, UnauthenticatedError } from '@shared/errors';
import { sendAccepted, sendOk } from '@shared/http';

import type { ListSignalsQuery, SignalParams } from './signals.schema';
import type { SignalsService } from './signals.service';

export type SignalsController = {
  ingest: RequestHandler;
  verify: RequestHandler;
  listSignals: RequestHandler;
  listAlerts: RequestHandler;
  getAlert: RequestHandler;
  listQuarantine: RequestHandler;
  quarantineSummary: RequestHandler;
};

export function createSignalsController(service: SignalsService): SignalsController {
  return {
    async ingest(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      // 202, not 201: the run reaches three external APIs and its result is a
      // report on what happened rather than a created resource.
      sendAccepted(res, await service.ingest(req.auth.org));
    },

    async verify(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      sendAccepted(res, await service.verify(req.auth.org));
    },

    async listSignals(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListSignalsQuery;
      sendOk(res, await service.listSignals(req.auth.org, query.limit));
    },

    async listAlerts(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListSignalsQuery;
      sendOk(res, await service.listAlerts(req.auth.org, query.limit));
    },

    async getAlert(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const { id } = req.params as unknown as SignalParams;

      // Returns the raw signals too: "which two independent sources?" is the
      // first question anyone asks about an alert, and it should not need a
      // second request to answer.
      const found = await service.getAlertWithSignals(req.auth.org, id);
      if (found === null) throw new NotFoundError('Alert', id);

      sendOk(res, found);
    },

    async listQuarantine(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      const query = req.query as unknown as ListSignalsQuery;
      sendOk(res, await service.listQuarantine(req.auth.org, query.limit));
    },

    async quarantineSummary(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) throw new UnauthenticatedError();
      sendOk(res, await service.quarantineSummary(req.auth.org));
    },
  };
}
