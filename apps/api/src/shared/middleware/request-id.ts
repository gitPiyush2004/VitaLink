/**
 * Correlation ids (PART 3A.5 rule 8).
 *
 * Generates an id per request, or trusts an inbound `x-request-id` so a trace
 * that started in the browser or in another service stays joined up. The id is
 * echoed back in the response header, attached to a child logger, and later
 * propagated into BullMQ job data and into the Python service as a header — so
 * one id follows a workflow across all three processes.
 */

import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { childLogger } from '@shared/logger';

const REQUEST_ID_HEADER = 'x-request-id';
/** Bound so a hostile client cannot use the header to write unbounded log lines. */
const MAX_INBOUND_ID_LENGTH = 200;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header(REQUEST_ID_HEADER);
  const id =
    inbound !== undefined && inbound.length > 0 && inbound.length <= MAX_INBOUND_ID_LENGTH
      ? inbound
      : randomUUID();

  req.requestId = id;
  req.log = childLogger({ requestId: id, method: req.method, path: req.path });
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}
