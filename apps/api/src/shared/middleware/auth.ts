/**
 * Authentication and authorisation middleware.
 *
 * `requireAuth` proves who the caller is. `requireScope` proves they are allowed
 * to do this particular thing. Keeping them as two middlewares rather than one
 * means a route declares its permission next to its path, which is how the
 * permission matrix stays readable (see shared/auth/permissions.ts).
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { Scope } from '@vitalink/contracts';

import { hasScope } from '@shared/auth/permissions';
import { verifyAccessToken } from '@shared/auth/tokens';
import { ForbiddenError, UnauthenticatedError } from '@shared/errors';

const BEARER_PREFIX = 'Bearer ';

function extractBearerToken(req: Request): string {
  const header = req.header('authorization');
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthenticatedError('Expected an Authorization: Bearer <token> header.');
  }
  return header.slice(BEARER_PREFIX.length).trim();
}

/**
 * Async middleware with no try/catch: on Express 5 a rejected promise is
 * forwarded to the error handler natively, so `UnauthenticatedError` becomes a
 * 401 without any wrapper. ADR-0004.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = extractBearerToken(req);
  req.auth = await verifyAccessToken(token);
  req.log = req.log.child({ userId: req.auth.sub, orgId: req.auth.org });
  next();
};

/**
 * Declares the scope a route needs.
 *
 * Usage reads as documentation:
 *   router.post('/run', requireAuth, requireScope('cascade:run'), controller.run)
 */
export function requireScope(required: Scope): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth === undefined) {
      throw new UnauthenticatedError('This route requires authentication.');
    }
    if (!hasScope(req.auth.scopes, required)) {
      throw new ForbiddenError(
        `Your role (${req.auth.role}) cannot perform this action.`,
        required,
      );
    }
    next();
  };
}
