/**
 * The Mongo connection, its index sync, and its shutdown.
 *
 * Two choices worth defending:
 *
 *  1. `strict: 'throw'` globally. An unexpected field on a write is a loud error
 *     rather than silently-discarded data. Silent discarding is how a document
 *     ends up missing the `provenance` we thought we saved.
 *  2. `syncIndexes()` on boot in non-production. Indexes are declared in the
 *     schemas (PART 3A.7), never created ad hoc, so the declaration is the source
 *     of truth. In production the sync is deliberately not automatic, because
 *     building an index on a live collection is an operational decision.
 */

import mongoose from 'mongoose';

import { MONGO_SERVER_SELECTION_TIMEOUT_MS } from '@config/constants';
import { env, isProduction } from '@config/env';
import { logger } from '@shared/logger';

let isConnected = false;

export async function connectMongo(): Promise<void> {
  // Applies to every schema defined after this point, which is why it is set
  // before any model file is imported.
  mongoose.set('strict', 'throw');
  mongoose.set('strictQuery', true);
  // Mongoose would otherwise create indexes implicitly at model-compile time,
  // which races with the app and hides where indexes come from.
  mongoose.set('autoIndex', false);

  mongoose.connection.on('error', (error: Error) => {
    logger.error({ err: error }, 'mongo connection error');
  });
  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('mongo disconnected');
  });

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    // A single retryable-writes-capable connection pool for the whole process.
    retryWrites: true,
  });

  isConnected = true;
  logger.info({ db: mongoose.connection.name }, 'mongo connected');
}

/**
 * Brings the database's indexes in line with what the schemas declare.
 *
 * Called explicitly from `main.ts` in development and test. Production runs it
 * as a separate one-off task, because `syncIndexes` drops indexes that are no
 * longer declared and that is not something to do implicitly at boot.
 */
export async function syncIndexes(): Promise<void> {
  if (isProduction) {
    logger.info('skipping automatic index sync in production; run it as a migration');
    return;
  }

  const names = Object.keys(mongoose.models);
  for (const name of names) {
    const model = mongoose.models[name];
    if (model === undefined) continue;
    await model.syncIndexes();
  }
  logger.info({ models: names.length }, 'indexes synced');
}

export function isMongoReady(): boolean {
  return isConnected && mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  isConnected = false;
  logger.info('mongo disconnected cleanly');
}

/** Exposed only so repositories can open a session for a multi-document write. */
export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}
