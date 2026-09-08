/**
 * Redis, doing five separate jobs (ADR-0001).
 *
 *   1. the provenance HTTP cache in packages/connectors
 *   2. BullMQ's backing store
 *   3. the Socket.IO adapter, so multiple API instances share rooms
 *   4. rate-limit counters
 *   5. the JWT `jti` denylist, which is how a token is revoked before it expires
 *
 * That list is the whole argument for choosing Redis + BullMQ over RabbitMQ: four
 * of those five need Redis regardless, so the queue rides on infrastructure that
 * already has to exist.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its connections, so it gets its
 * own client rather than sharing the general-purpose one.
 */

import Redis, { type Redis as RedisClient } from 'ioredis';

import { env } from '@config/env';
import { logger } from '@shared/logger';

let client: RedisClient | null = null;
let bullClient: RedisClient | null = null;

function createClient(name: string, overrides: Record<string, unknown> = {}): RedisClient {
  const instance = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    // Fail a command rather than queueing it forever when Redis is down. A
    // request that cannot reach the cache should degrade, not hang.
    enableOfflineQueue: false,
    ...overrides,
  });

  instance.on('error', (error: Error) => {
    logger.error({ err: error, client: name }, 'redis error');
  });

  return instance;
}

export async function connectRedis(): Promise<void> {
  client = createClient('general');
  bullClient = createClient('bullmq', { maxRetriesPerRequest: null, enableOfflineQueue: true });

  await Promise.all([client.connect(), bullClient.connect()]);
  logger.info('redis connected');
}

/** The general-purpose client: cache, denylist, rate limits, ad-hoc keys. */
export function getRedis(): RedisClient {
  if (client === null) {
    throw new Error('Redis has not been connected. Call connectRedis() during startup.');
  }
  return client;
}

/** The BullMQ-configured client. Queues and workers use this one only. */
export function getBullRedis(): RedisClient {
  if (bullClient === null) {
    throw new Error('Redis has not been connected. Call connectRedis() during startup.');
  }
  return bullClient;
}

export async function isRedisReady(): Promise<boolean> {
  if (client === null) return false;
  try {
    const reply = await client.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([client?.quit(), bullClient?.quit()]);
  client = null;
  bullClient = null;
  logger.info('redis disconnected cleanly');
}
