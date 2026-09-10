/**
 * Turning a failed HTTP attempt into a typed outcome.
 *
 * Pure functions over a response or a thrown error, split out of the client
 * because the distinctions they draw are the interesting part, and both were got
 * wrong once.
 *
 * **Retryable versus fatal.** A 404 retried four times is four requests against
 * someone else's rate limit for an answer that will not change. The first probe
 * run did exactly that.
 *
 * **Timeout versus unreachable.** An aborted fetch and a refused connection are
 * different problems, and a carrier adapter maps them to different
 * `unavailable_reason` values — so reporting a connect timeout as a network
 * failure put "the host is unreachable" on a host that was answering `curl`.
 */

import type { SourceRequest } from './cached-client';
import { ConnectorError, kindForStatus } from './connector-error';
import { isRetryableStatus } from './retry';
import { isConnectTimeout } from './slow-hosts';

/** What one HTTP attempt produced: a body, something to retry, or a dead end. */
export type AttemptOutcome =
  | { kind: 'ok'; body: string }
  | { kind: 'retryable_status'; error: ConnectorError; detail: string; retryAfter: string | null }
  | { kind: 'fatal'; error: ConnectorError; detail: string };

/**
 * The three things a status classification reads off a response.
 *
 * Narrowed to this rather than typed as `Response`, because the two fetch
 * implementations in play return structurally identical but nominally different
 * `Response` types — `@types/node` bundles its own copy of undici's types. A
 * structural subset satisfies both without a cast, and it also states plainly
 * what this function depends on.
 */
type StatusBearingResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
};

export function classifyStatus(
  request: SourceRequest,
  response: StatusBearingResponse,
): AttemptOutcome {
  const error = new ConnectorError({
    kind: kindForStatus(response.status),
    sourceId: request.sourceId,
    message: `${request.displayName} returned ${String(response.status)}`,
    httpStatus: response.status,
    url: request.url,
  });

  return isRetryableStatus(response.status)
    ? {
        kind: 'retryable_status',
        error,
        detail: `HTTP ${String(response.status)}`,
        retryAfter: response.headers.get('retry-after'),
      }
    : { kind: 'fatal', error, detail: `HTTP ${String(response.status)}` };
}

/**
 * A thrown fetch, split into timeout and network failure.
 *
 * An aborted fetch and a DNS failure are different problems — the first is "too
 * slow", the second is "unreachable" — and a carrier adapter reports them with
 * different `unavailable_reason` values.
 */
export function classifyThrow(request: SourceRequest, cause: unknown): AttemptOutcome {
  // Two ways a request can time out, and they arrive looking nothing alike. The
  // AbortController fires an AbortError; undici's own connect ceiling throws a
  // TypeError whose *cause* carries UND_ERR_CONNECT_TIMEOUT. Reporting the
  // second as a network failure said "the host is unreachable" about a host that
  // was answering `curl` — see `http/slow-hosts.ts`.
  const isAbort =
    (cause instanceof Error && cause.name === 'AbortError') || isConnectTimeout(cause);

  return {
    kind: 'retryable_status',
    error: new ConnectorError({
      kind: isAbort ? 'timeout' : 'network',
      sourceId: request.sourceId,
      message: isAbort
        ? `${request.displayName} timed out`
        : `${request.displayName} was unreachable`,
      url: request.url,
      cause,
    }),
    detail: isAbort ? 'timeout' : 'network error',
    retryAfter: null,
  };
}
