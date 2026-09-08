/**
 * The BullMQ worker process.
 *
 * Deliberately a separate process from the API, not a separate service. It
 * shares the API's modules — `@modules/*` resolves into `apps/api/src/modules`
 * — because the API is the single owner of all state, and a worker that
 * reimplemented its own persistence would be a second source of truth.
 *
 * What it does own: schedules, retries, backoff, and the concurrency of
 * long-running work. Ingestion, verification, cascades and quote fan-out all
 * belong here so that a slow upstream API cannot occupy an HTTP request.
 *
 * Queues and consumers are registered in the phases that introduce them.
 */

import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';
import { logger } from '@shared/logger';

let isShuttingDown = false;

async function start(): Promise<void> {
  await connectMongo();
  await connectRedis();
  logger.info('vitalink workers started (no queues registered yet)');
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'workers shutting down');

  // Workers are closed before the datastores so an in-flight job can finish its
  // write. Closing Mongo first would fail that write and leave a half-done job.
  await disconnectMongo();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'workers failed to start');
  process.exit(1);
});
