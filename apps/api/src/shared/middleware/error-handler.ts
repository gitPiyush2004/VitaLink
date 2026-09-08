/**
 * The single error handler (PART 3A.5 rule 1). Registered last, after the routes
 * and after `notFound`, because Express dispatches error middleware in
 * registration order.
 *
 * The rule it enforces: an `AppError` marked operational returns its own message
 * and code; anything else is logged with its stack and returned as a generic 500.
 * A client never sees an internal message, a query, or a connection string.
 *
 * Note there is no `asyncHandler` wrapper anywhere in this codebase. We are on
 * Express 5, which forwards a rejected promise from a handler to this middleware
 * natively. That is recorded in ADR-0004, because "where is your asyncHandler?"
 * is a question worth having an answer to.
 */

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import type { ApiError } from '@vitalink/contracts';

import { AppError, HTTP_STATUS } from '@shared/errors';
import { sendError } from '@shared/http';

/** A zod failure at the boundary is the client's fault, and safe to describe. */
function fromZodError(error: ZodError, requestId: string): { status: number; body: ApiError } {
  return {
    status: HTTP_STATUS.badRequest,
    body: {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      request_id: requestId,
    },
  };
}

function fromAppError(error: AppError, requestId: string): { status: number; body: ApiError } {
  return {
    status: error.httpStatus,
    body: {
      code: error.code,
      // A non-operational AppError is a bug we classified; hide its message too.
      message: error.isOperational ? error.message : 'An internal error occurred.',
      ...(error.isOperational && error.details !== undefined ? { details: error.details } : {}),
      request_id: requestId,
    },
  };
}

/**
 * Express requires the four-parameter signature to recognise this as error
 * middleware, so `_next` is present and unused on purpose.
 */
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    const { status, body } = fromZodError(error, req.requestId);
    req.log.warn({ code: body.code, issues: error.issues.length }, 'request validation failed');
    sendError(res, status, body);
    return;
  }

  if (error instanceof AppError) {
    const { status, body } = fromAppError(error, req.requestId);
    if (error.isOperational) {
      req.log.warn({ code: error.code, details: error.details }, error.message);
    } else {
      req.log.error({ err: error, code: error.code }, 'non-operational application error');
    }
    sendError(res, status, body);
    return;
  }

  // Anything reaching here is unclassified: a genuine bug, a driver error, a
  // library throwing a string. Log everything, disclose nothing.
  req.log.error({ err: error }, 'unhandled error');
  sendError(res, HTTP_STATUS.internal, {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred.',
    request_id: req.requestId,
  });
};
