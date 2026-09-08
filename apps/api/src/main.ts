/**
 * The entrypoint: connect dependencies, start listening, shut down cleanly.
 *
 * Graceful shutdown (PART 3A.5 rule 9) is the part worth reading. On SIGTERM we
 * stop accepting new connections, let in-flight requests finish, then close
 * Mongo and Redis. Without it, a deploy drops requests that were mid-flight and
 * leaves half-written documents behind — the classic "it works locally, it
 * corrupts data in production" bug.
 *
 * The forced-exit timer matters too: if a connection refuses to drain, the
 * process must still die, or the orchestrator's rolling deploy stalls.
 */

import type { Server } from 'node:http';

import { SHUTDOWN_GRACE_MS } from '@config/constants';
import { env } from '@config/env';
import {
  connectMongo,
  connectRedis,
  disconnectMongo,
  disconnectRedis,
  syncIndexes,
} from '@shared/db';
import { logger } from '@shared/logger';

import { buildApp } from './app';

let server: Server | null = null;
let isShuttingDown = false;

async function start(): Promise<void> {
  await connectMongo();
  await connectRedis();
  // Models are registered by importing the routers below, so index sync happens
  // after the app is built rather than before it.
  const app = buildApp();
  await syncIndexes();

  server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'vitalink api listening');
  });
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  // Do not let this timer be the reason the event loop stays alive.
  forceExit.unref();

  await new Promise<void>((resolve) => {
    if (server === null) {
      resolve();
      return;
    }
    server.close(() => {
      resolve();
    });
  });

  await disconnectMongo();
  await disconnectRedis();

  clearTimeout(forceExit);
  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

// An unhandled rejection means a promise was dropped somewhere. ESLint's
// no-floating-promises rule makes that hard, but this is the backstop, and it
// logs loudly rather than dying silently as older Node versions did.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  // An uncaught exception leaves the process in an unknown state. Restarting is
  // the only safe response; draining first would be pretending we know better.
  process.exit(1);
});

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
