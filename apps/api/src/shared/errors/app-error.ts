/**
 * One error type for the whole application.
 *
 * The pattern (PART 3A.5 rule 1): every error a service throws is an `AppError`
 * carrying the machine-readable `code`, the HTTP status it should map to, and
 * whether it is *operational* — meaning "expected, safe to show the client" as
 * opposed to a programming bug.
 *
 * The error handler middleware uses `isOperational` to decide whether to return
 * the message or to swallow it behind a generic 500. That distinction is what
 * stops a stack trace, a query, or a connection string reaching the browser.
 *
 * Note that services throw these; they never return HTTP status codes. Transport
 * concerns stay at the edge, which is what keeps the same service callable from a
 * BullMQ worker where there is no response object at all.
 */

import type { ErrorCode } from '@vitalink/contracts';

const HTTP = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
  internal: 500,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
} as const;

export type AppErrorOptions = {
  code: ErrorCode;
  httpStatus: number;
  message: string;
  details?: Record<string, unknown>;
  /** False means "this is a bug"; the handler will hide the message. */
  isOperational?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;
  readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, new.target);
  }
}

// ---------------------------------------------------------------------------
// The subclasses. One per situation the API actually distinguishes.
// ---------------------------------------------------------------------------

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'VALIDATION_FAILED',
      httpStatus: HTTP.badRequest,
      message,
      ...(details === undefined ? {} : { details }),
    });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required.') {
    super({ code: 'UNAUTHENTICATED', httpStatus: HTTP.unauthorized, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = 'You do not have permission to perform this action.',
    requiredScope?: string,
  ) {
    super({
      code: 'FORBIDDEN',
      httpStatus: HTTP.forbidden,
      message,
      ...(requiredScope === undefined ? {} : { details: { required_scope: requiredScope } }),
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string, code: ErrorCode = 'NOT_FOUND') {
    super({
      code,
      httpStatus: HTTP.notFound,
      message: `${resource} not found.`,
      details: { resource, id },
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'CONFLICT',
      httpStatus: HTTP.conflict,
      message,
      ...(details === undefined ? {} : { details }),
    });
  }
}

/**
 * Raised when a computation cannot honestly be performed because the public data
 * is not there. This is a first-class outcome, not a failure to hide: the UI
 * renders it as an empty state with this reason attached (spec PART 2, Rule 1,
 * "degrade gracefully; never invent").
 */
export class InsufficientDataError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'INSUFFICIENT_DATA',
      httpStatus: HTTP.unprocessable,
      message,
      ...(details === undefined ? {} : { details }),
    });
  }
}

export class RateLimitedError extends AppError {
  constructor(retryAfterSeconds: number) {
    super({
      code: 'RATE_LIMITED',
      httpStatus: HTTP.tooManyRequests,
      message: 'Too many requests.',
      details: { retry_after_seconds: retryAfterSeconds },
    });
  }
}

/** A carrier has no credentials in this environment. Never a reason to invent a price. */
export class CarrierNotConfiguredError extends AppError {
  constructor(carrierId: string, displayName: string) {
    super({
      code: 'CARRIER_NOT_CONFIGURED',
      httpStatus: HTTP.unprocessable,
      message: `No credentials configured for ${displayName}.`,
      details: { carrier: carrierId },
    });
  }
}

export class CarrierTimeoutError extends AppError {
  constructor(carrierId: string, timeoutMs: number) {
    super({
      code: 'CARRIER_TIMEOUT',
      httpStatus: HTTP.gatewayTimeout,
      message: `Carrier ${carrierId} did not respond within ${String(timeoutMs)}ms.`,
      details: { carrier: carrierId, timeout_ms: timeoutMs },
    });
  }
}

export class CarrierAuthFailedError extends AppError {
  constructor(carrierId: string) {
    super({
      code: 'CARRIER_AUTH_FAILED',
      httpStatus: HTTP.badGateway,
      message: `Authentication with carrier ${carrierId} failed.`,
      details: { carrier: carrierId },
    });
  }
}

/**
 * Every carrier failed the eligibility gate.
 *
 * Spec PART 7: this is "a first-class outcome, not an error to hide". The
 * response carries the per-carrier reasons, because that list is itself the
 * finding a supply chain manager needs.
 */
export class NoEligibleCarrierError extends AppError {
  constructor(reasons: Record<string, string>) {
    super({
      code: 'NO_ELIGIBLE_CARRIER',
      httpStatus: HTTP.unprocessable,
      message: 'No carrier satisfies the hard constraints for this shipment.',
      details: { per_carrier_reasons: reasons },
    });
  }
}

export class DeadlineUnsatisfiableError extends AppError {
  constructor(deadline: string, fastestArrival: string) {
    super({
      code: 'DEADLINE_UNSATISFIABLE',
      httpStatus: HTTP.unprocessable,
      message: 'No available service can arrive before the required deadline.',
      details: { deadline, fastest_arrival: fastestArrival },
    });
  }
}

/** An upstream public data source or the Python service is unreachable. */
export class UpstreamUnavailableError extends AppError {
  constructor(upstream: string, cause?: unknown) {
    super({
      code: 'UPSTREAM_UNAVAILABLE',
      httpStatus: HTTP.serviceUnavailable,
      message: `${upstream} is unavailable.`,
      details: { upstream },
      ...(cause === undefined ? {} : { cause }),
    });
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, cause: unknown) {
    super({
      code: 'DB_FAILURE',
      httpStatus: HTTP.internal,
      message: `Database operation failed: ${operation}`,
      // Not operational: the client gets a generic 500 and we keep the detail.
      isOperational: false,
      details: { operation },
      cause,
    });
  }
}

export const HTTP_STATUS = HTTP;
