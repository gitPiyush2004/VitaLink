/**
 * Registered after all routes and before the error handler, so an unmatched path
 * produces the same envelope as every other failure rather than Express's
 * default HTML error page.
 */

import type { NextFunction, Request, Response } from 'express';

import { AppError, HTTP_STATUS } from '@shared/errors';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError({
      code: 'NOT_FOUND',
      httpStatus: HTTP_STATUS.notFound,
      message: `No route matches ${req.method} ${req.path}.`,
      details: { method: req.method, path: req.path },
    }),
  );
}
