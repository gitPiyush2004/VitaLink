/**
 * Rate limiting, per user and per organisation (PART 8).
 *
 * Counters live in Redis, not in process memory. That is the whole point: with
 * in-memory counters, running two API containers doubles everyone's effective
 * limit, and the limit stops meaning anything.
 *
 * Two limiters rather than one because they answer different questions. The
 * per-user limit stops one person's runaway script; the per-org limit stops a
 * whole tenant from consuming the shared upstream API budgets we depend on.
 */

import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import {
  RATE_LIMIT_MAX_PER_ORG,
  RATE_LIMIT_MAX_PER_USER,
  RATE_LIMIT_WINDOW_MS,
} from '@config/constants';
import { getRedis } from '@shared/db';

/** Unauthenticated requests are keyed by IP; that is all we know about them. */
function userKey(req: Request): string {
  return req.auth === undefined ? `ip:${req.ip ?? 'unknown'}` : `user:${req.auth.sub}`;
}

function orgKey(req: Request): string {
  return req.auth === undefined ? `ip:${req.ip ?? 'unknown'}` : `org:${req.auth.org}`;
}

function buildStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    // rate-limit-redis speaks in raw commands so it can run one atomic Lua
    // script per request; this adapter hands them to the shared ioredis client.
    // ioredis' `call` wants (command, ...args), so the array is destructured
    // rather than spread — a spread of `string[]` is not a valid tuple.
    sendCommand: async (...args: string[]): Promise<never> => {
      const [command, ...rest] = args;
      if (command === undefined) {
        throw new Error('rate-limit-redis sent an empty command');
      }
      return (await getRedis().call(command, ...rest)) as never;
    },
  });
}

export function createUserRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_MAX_PER_USER,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: userKey,
    store: buildStore('rl:user:'),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
  });
}

export function createOrgRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_MAX_PER_ORG,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: orgKey,
    store: buildStore('rl:org:'),
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Organisation request quota exceeded.' },
    },
  });
}
