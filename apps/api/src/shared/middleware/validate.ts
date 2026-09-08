/**
 * Validate at the boundary, trust inside (PART 3A.5 rule 3).
 *
 * Every request body, query and param passes through a zod schema here. Below
 * this line nothing re-checks the same thing, because it has already been proven.
 * The alternative — defensive checks scattered through services — is how the same
 * rule ends up implemented three times, slightly differently.
 *
 * The parsed result *replaces* `req.body` / `req.query` / `req.params`, so
 * coercions and defaults declared in the schema are what the controller sees.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

export type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Returns middleware that validates the declared parts of the request.
 *
 * Failures are thrown as `ZodError` and translated by the error handler, so the
 * response shape for a validation failure is defined in exactly one place.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params !== undefined) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.query !== undefined) {
      // Express 5 makes req.query a getter, so it is replaced rather than assigned.
      const parsed = schemas.query.parse(req.query);
      Object.defineProperty(req, 'query', { value: parsed, configurable: true, writable: true });
    }
    if (schemas.body !== undefined) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}
