/**
 * The single egress point (spec Rule 3).
 *
 * Every outbound HTTP request in Vitalink goes through `CachedHttpClient.getJson`.
 * It does five things, in this order:
 *
 *   1. builds a deterministic cache key from the source id and the full URL
 *   2. returns a cached response when one is fresh, without touching the network
 *   3. waits its turn under the source's published rate limit
 *   4. fetches, retrying with exponential backoff on 429 and 5xx
 *   5. validates the body against a zod schema and attaches provenance
 *
 * Step 5 is the reason this class exists rather than callers using `fetch`
 * directly. The returned `Fetched<T>` carries the `Provenance` that every stored
 * `Quantity` requires: the source name, the exact URL queried, and the instant it
 * was fetched. A caller physically cannot obtain data from this client without
 * also obtaining the provenance for it — which is how "every number carries its
 * source" stops being a convention and becomes a property of the type system.
 *
 * CI gate 3 fails the build on a `fetch` anywhere outside this package.
 */

import { createHash } from 'node:crypto';

import { fetch as undiciFetch } from 'undici';
import type { ZodType } from 'zod';

import type { Provenance } from '@vitalink/contracts';

import { classifyStatus, classifyThrow, type AttemptOutcome } from './classify';
import { ConnectorError } from './connector-error';
import { decodeBody } from './decode-body';
import {
  realSleeper,
  silentLogger,
  systemClock,
  type Clock,
  type ConnectorLogger,
  type ResponseCache,
  type Sleeper,
} from './ports';
import { createRateLimiter, type RateLimiter } from './rate-limiter';
import { DEFAULT_MAX_ATTEMPTS, waitBeforeRetry } from './retry';
import { slowHandshakeAgent } from './slow-hosts';

/** Twenty seconds. Long enough for a slow government PDF host, short enough that
 *  a hung request cannot occupy an ingestion worker indefinitely. */
const DEFAULT_TIMEOUT_MS = 20_000;

/** Long enough to identify a cache entry, short enough to keep Redis keys tidy. */
const CACHE_KEY_HASH_LENGTH = 32;

export type CachedHttpClientDeps = {
  cache: ResponseCache;
  clock?: Clock;
  sleeper?: Sleeper;
  logger?: ConnectorLogger;
};

/** What a caller must tell the client. Everything else comes from the registry. */
export type SourceRequest = {
  /** Matches a key in the source registry, so limits and TTL are looked up. */
  sourceId: string;
  displayName: string;
  /** Fully-qualified URL, query string included. This exact string is cited. */
  url: string;
  /** The query as a human would describe it, for the Sources drawer. */
  queryDescription: string;
  minIntervalMs: number;
  cacheTtlSeconds: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * Raise the connect timeout for a host with a slow TLS handshake.
   *
   * Only set it where a measurement justifies it — see `http/slow-hosts.ts`.
   * A long connect timeout on a genuinely dead host means a worker waits that
   * long to learn nothing.
   */
  slowHandshake?: boolean;
  /** Overrides the default retry budget; carrier adapters use a smaller one. */
  maxAttempts?: number;
};

/**
 * Data plus the provenance that proves where it came from.
 *
 * The two travel together on purpose. Returning bare data and expecting the
 * caller to construct provenance separately is exactly how a source-less number
 * gets persisted.
 */
export type Fetched<T> = {
  data: T;
  provenance: Provenance;
  fromCache: boolean;
  /** The verbatim response body, kept so a carrier quote can be proved later. */
  rawBody: string;
};

/**
 * A non-OK response, split into retryable and fatal.
 *
 * The distinction matters more than it looks: a 404 retried four times is four
 * requests against someone else's rate limit for an answer that will not change.
 */
export class CachedHttpClient {
  private readonly cache: ResponseCache;
  private readonly clock: Clock;
  private readonly sleeper: Sleeper;
  private readonly logger: ConnectorLogger;
  private readonly limiter: RateLimiter;

  constructor(deps: CachedHttpClientDeps) {
    this.cache = deps.cache;
    this.clock = deps.clock ?? systemClock;
    this.sleeper = deps.sleeper ?? realSleeper;
    this.logger = deps.logger ?? silentLogger;
    this.limiter = createRateLimiter(this.clock, this.sleeper);
  }

  /**
   * Fetches JSON, validates it, and returns it with its provenance.
   *
   * @throws ConnectorError with `kind: 'malformed_response'` when the body does
   *   not match `schema`. That is deliberate: a source that changed its shape
   *   must fail loudly rather than silently produce partially-parsed records.
   */
  async getJson<T>(request: SourceRequest, schema: ZodType<T>): Promise<Fetched<T>> {
    const cacheKey = buildCacheKey(request);
    const cached = await this.cache.get(cacheKey);

    const hit = this.cachedJson(cached, schema, request);
    if (hit) return hit;

    const rawBody = await this.fetchWithRetries(request);
    const provenance = this.buildProvenance(request);
    const data = validate(schema, rawBody, request);

    await this.cache.set(
      cacheKey,
      JSON.stringify({ body: rawBody, provenance }),
      request.cacheTtlSeconds,
    );

    return { data, provenance, fromCache: false, rawBody };
  }

  private cachedJson<T>(
    cached: string | null,
    schema: ZodType<T>,
    request: SourceRequest,
  ): Fetched<T> | null {
    if (cached === null) return null;
    const entry = parseCacheEntry(cached);
    if (!entry) return null;
    try {
      const data = validate(schema, entry.body, request);
      this.logger.debug({ source: request.sourceId, url: request.url }, 'cache hit');
      return { data, provenance: entry.provenance, fromCache: true, rawBody: entry.body };
    } catch (error) {
      this.logger.warn(
        { source: request.sourceId, err: error },
        'Invalid cache entry; refetching upstream',
      );
      return null;
    }
  }

  /**
   * Fetches text without schema validation, for sources that do not return JSON
   * (CDSCO's PDFs, OSRM's polylines inside a text field).
   */
  async getText(request: SourceRequest): Promise<Fetched<string>> {
    const cacheKey = buildCacheKey(request);
    const cached = await this.cache.get(cacheKey);

    if (cached !== null) {
      const entry = parseCacheEntry(cached);
      if (entry !== null) {
        return {
          data: entry.body,
          provenance: entry.provenance,
          fromCache: true,
          rawBody: entry.body,
        };
      }
    }

    const rawBody = await this.fetchWithRetries(request);
    const provenance = this.buildProvenance(request);
    await this.cache.set(
      cacheKey,
      JSON.stringify({ body: rawBody, provenance }),
      request.cacheTtlSeconds,
    );

    return { data: rawBody, provenance, fromCache: false, rawBody };
  }

  /**
   * POSTs a form body and validates the JSON response.
   *
   * **Never cached, regardless of the request's TTL.** This exists for OAuth
   * token exchanges, and caching a bearer token would put a live credential into
   * a shared Redis instance for no benefit — the adapters already cache tokens in
   * process memory, where they belong.
   *
   * It still goes through the rate limiter and the retry policy, because a token
   * endpoint is as rate-limited as any other and a 503 there should back off
   * rather than fail the whole quote fan-out.
   */
  async postForm<T>(
    request: SourceRequest,
    body: URLSearchParams,
    schema: ZodType<T>,
  ): Promise<Fetched<T>> {
    const maxAttempts = request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const retryContext = {
      sleeper: this.sleeper,
      logger: this.logger,
      maxAttempts,
      // The source's own published limit floors the backoff: retrying sooner
      // than the server said is a request already known to fail.
      minIntervalMs: request.minIntervalMs,
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.limiter.acquire(request.sourceId, request.minIntervalMs);

      const outcome = await this.attemptOnce(request, {
        method: 'POST',
        body,
        contentType: 'application/x-www-form-urlencoded',
      });

      if (outcome.kind === 'ok') {
        const provenance = this.buildProvenance(request);
        return {
          data: validate(schema, outcome.body, request),
          provenance,
          fromCache: false,
          rawBody: outcome.body,
        };
      }

      if (outcome.kind === 'fatal') throw outcome.error;

      const shouldRetry = await waitBeforeRetry(retryContext, attempt, {
        sourceId: request.sourceId,
        detail: outcome.detail,
        retryAfter: outcome.retryAfter,
      });

      if (!shouldRetry) throw outcome.error;
    }

    throw new ConnectorError({
      kind: 'upstream_error',
      sourceId: request.sourceId,
      message: 'retry loop exhausted without a verdict',
      url: request.url,
    });
  }

  private buildProvenance(request: SourceRequest): Provenance {
    return {
      source_name: request.displayName,
      source_url: request.url,
      query: request.queryDescription,
      fetched_at: this.clock.now().toISOString(),
    };
  }

  /** The retry loop. Separated so `getJson` reads as five steps rather than fifty lines. */
  private async fetchWithRetries(request: SourceRequest): Promise<string> {
    const maxAttempts = request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const retryContext = {
      sleeper: this.sleeper,
      logger: this.logger,
      maxAttempts,
      // The source's own published limit floors the backoff: retrying sooner
      // than the server said is a request already known to fail.
      minIntervalMs: request.minIntervalMs,
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.limiter.acquire(request.sourceId, request.minIntervalMs);

      const outcome = await this.attemptOnce(request);

      if (outcome.kind === 'ok') return outcome.body;

      // A 400 or a 404 will fail identically next time. Retrying it turns one
      // wasted request into four and delays the caller by seven seconds for
      // nothing — which is exactly what the first probe run showed happening.
      if (outcome.kind === 'fatal') throw outcome.error;

      const shouldRetry = await waitBeforeRetry(retryContext, attempt, {
        sourceId: request.sourceId,
        detail: outcome.detail,
        ...(outcome.kind === 'retryable_status' ? { retryAfter: outcome.retryAfter } : {}),
      });

      if (!shouldRetry) throw outcome.error;
    }

    // Unreachable: the loop either returns or throws. Present so the function has
    // a total return type rather than relying on the compiler's inference.
    throw new ConnectorError({
      kind: 'upstream_error',
      sourceId: request.sourceId,
      message: 'retry loop exhausted without a verdict',
      url: request.url,
    });
  }

  /** One HTTP attempt. `body` is present only for the form POST path. */
  private async attemptOnce(
    request: SourceRequest,
    post?: { method: 'POST'; body: URLSearchParams; contentType: string },
  ): Promise<AttemptOutcome> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const init = {
        method: post === undefined ? 'GET' : post.method,
        headers: {
          accept: 'application/json',
          ...(post === undefined ? {} : { 'content-type': post.contentType }),
          ...request.headers,
        },
        ...(post === undefined ? {} : { body: post.body.toString() }),
        signal: controller.signal,
      };

      // Two fetch implementations, and the branch is not gratuitous. Node's
      // global `fetch` validates that a `dispatcher` is one of *its own*
      // internal undici classes and rejects the npm package's Agent with
      // UND_ERR_INVALID_ARG — so raising the connect timeout means calling the
      // npm undici's own `fetch`, which accepts its own Agent. Everything else
      // keeps using the global, so the ordinary path has no new dependency in it.
      const response =
        request.slowHandshake === true
          ? await undiciFetch(request.url, { ...init, dispatcher: slowHandshakeAgent() })
          : await fetch(request.url, init);

      const body = decodeBody(await response.arrayBuffer());

      if (response.ok) return { kind: 'ok', body };
      return classifyStatus(request, response);
    } catch (cause) {
      return classifyThrow(request, cause);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * The cache key is a hash of the source and the full URL.
 *
 * Hashed rather than using the URL directly because query strings can be long
 * enough to be awkward as Redis keys, and because a key that is not
 * human-readable cannot be constructed by hand somewhere else and accidentally
 * collide with a different request shape.
 */
function buildCacheKey(request: SourceRequest): string {
  const digest = createHash('sha256')
    .update(`${request.sourceId} ${request.url}`)
    .digest('hex')
    .slice(0, CACHE_KEY_HASH_LENGTH);
  return `http:${request.sourceId}:${digest}`;
}

type CacheEntry = { body: string; provenance: Provenance };

/** Returns null for a corrupt entry, so a bad cache degrades to a fetch. */
function parseCacheEntry(raw: string): CacheEntry | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'body' in parsed &&
      'provenance' in parsed &&
      typeof parsed.body === 'string'
    ) {
      return parsed as CacheEntry;
    }
    return null;
  } catch {
    return null;
  }
}

function validate<T>(schema: ZodType<T>, rawBody: string, request: SourceRequest): T {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch (cause) {
    throw new ConnectorError({
      kind: 'malformed_response',
      sourceId: request.sourceId,
      message: `${request.displayName} did not return valid JSON`,
      url: request.url,
      cause,
    });
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new ConnectorError({
      kind: 'malformed_response',
      sourceId: request.sourceId,
      message:
        `${request.displayName} returned a body that does not match the expected shape. ` +
        `First issue: ${result.error.issues[0]?.message ?? 'unknown'} at ` +
        `${result.error.issues[0]?.path.join('.') ?? '(root)'}`,
      url: request.url,
      cause: result.error,
    });
  }

  return result.data;
}
