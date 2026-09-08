/**
 * Structured logging with correlation ids (PART 3A.5 rule 8).
 *
 * JSON in production because that is what log aggregators parse; pretty-printed
 * in development because that is what humans read. One `requestId` travels from
 * the HTTP edge, through queue jobs, and into the Python service via a header, so
 * a single id traces one workflow across three processes.
 *
 * `redact` is not optional politeness — it is the reason a bearer token or a
 * carrier client secret cannot end up in a log file.
 */

import pino, { type Logger } from 'pino';

import { env, isProduction, isTest } from '@config/env';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["dsv-subscription-key"]',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'client_secret',
  '*.client_secret',
  'access_token',
  '*.access_token',
  'refresh_token',
  '*.refresh_token',
  'api_key',
  '*.api_key',
];

export const logger: Logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  base: { service: 'api' },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }),
});

/**
 * A child logger bound to one request or job.
 *
 * Every log line from that unit of work then carries the same `requestId`, which
 * is what makes "show me everything that happened to this alert" a single grep.
 */
export function childLogger(bindings: { requestId: string; [key: string]: unknown }): Logger {
  return logger.child(bindings);
}
