/**
 * Builds the Express app. Does not listen.
 *
 * That separation (PART 3A.6) is what lets an API test do
 * `supertest(buildApp())` and exercise the whole middleware chain without
 * opening a port or racing another test for one.
 *
 * The middleware order below is fixed and commented, because order is behaviour:
 *
 *   helmet        security headers before anything can respond
 *   cors          reject cross-origin requests before doing work for them
 *   compression   wraps res.write, so it must be installed before routes
 *   body parsers  with explicit size limits; webhook routes get raw bodies
 *   cookieParser  needed by the auth controller for the refresh cookie
 *   requestId     assigns the correlation id BEFORE the logger, so lines carry it
 *   httpLogger    one line per request, with that id
 *   rateLimit     cheap rejection before route handlers do expensive work
 *   routes
 *   notFound      unmatched paths become a typed 404
 *   errorHandler  registered last; Express dispatches error middleware in order
 */

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { API_PREFIX, JSON_BODY_LIMIT } from '@config/constants';
import { env, isTest } from '@config/env';
import { createHealthRouter } from '@modules/health/health.routes';
import { logger } from '@shared/logger';
import { errorHandler } from '@shared/middleware/error-handler';
import { notFound } from '@shared/middleware/not-found';
import { createOrgRateLimiter, createUserRateLimiter } from '@shared/middleware/rate-limit';
import { requestId } from '@shared/middleware/request-id';

import { createApiRouter } from './routes';

export type BuildAppOptions = {
  /**
   * Rate limiting needs Redis. Integration tests that only exercise pure routes
   * can turn it off rather than standing up a Redis container.
   */
  enableRateLimiting?: boolean;
};

export function buildApp(options: BuildAppOptions = {}): Express {
  const enableRateLimiting = options.enableRateLimiting ?? !isTest;
  const app = express();

  // Behind a reverse proxy, `req.ip` is otherwise the proxy's address, which
  // would make every user share one rate-limit bucket.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(compression());

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      // The correlation id is already on `req.log`; reuse it rather than letting
      // pino-http generate a second, different id for the same request.
      genReqId: (req) => (req as { requestId?: string }).requestId ?? 'unknown',
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
    }),
  );

  // Health and readiness sit outside the versioned prefix and outside rate
  // limiting: an orchestrator's probes must not be throttled.
  app.use(createHealthRouter());

  if (enableRateLimiting) {
    app.use(API_PREFIX, createUserRateLimiter(), createOrgRateLimiter());
  }

  app.use(API_PREFIX, createApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
