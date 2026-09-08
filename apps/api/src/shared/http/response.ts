/**
 * The response envelope, in one place (PART 3A.6).
 *
 * Every endpoint returns `{ success: true, data, meta? }` or
 * `{ success: false, error }`. Controllers call these helpers rather than
 * `res.json(...)` directly, so the shape cannot drift from route to route and the
 * frontend needs exactly one unwrapping function.
 */

import type { Response } from 'express';

import type { ApiError, PageMeta } from '@vitalink/contracts';

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_ACCEPTED = 202;
const HTTP_NO_CONTENT = 204;

export function sendOk<T>(res: Response, data: T, meta?: unknown): void {
  res.status(HTTP_OK).json({ success: true, data, ...(meta === undefined ? {} : { meta }) });
}

export function sendCreated<T>(res: Response, data: T): void {
  res.status(HTTP_CREATED).json({ success: true, data });
}

/** For work handed to a queue: the caller gets an id to poll or a socket room to join. */
export function sendAccepted<T>(res: Response, data: T): void {
  res.status(HTTP_ACCEPTED).json({ success: true, data });
}

export function sendNoContent(res: Response): void {
  res.status(HTTP_NO_CONTENT).send();
}

export function sendPage<T>(res: Response, items: T[], page: PageMeta): void {
  res.status(HTTP_OK).json({ success: true, data: items, meta: page });
}

export function sendError(res: Response, httpStatus: number, error: ApiError): void {
  res.status(httpStatus).json({ success: false, error });
}
