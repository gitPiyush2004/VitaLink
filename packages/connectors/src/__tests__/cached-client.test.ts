/**
 * Cached client tests.
 *
 * `fetch` is a global, so there is no import to inject. It is replaced for the
 * duration of each test with a scripted stand-in that records what it was asked
 * for. That is the one place in this codebase where a global is stubbed, and it
 * is justified: the alternative is passing a `fetch` function through every
 * client constructor purely so tests can reach it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { CachedHttpClient } from '../http/cached-client';
import { ConnectorError } from '../http/connector-error';
import { createMemoryCache, type Clock, type Sleeper } from '../http/ports';

const bodySchema = z.object({ value: z.number() });

const frozenClock: Clock = { now: () => new Date('2026-09-01T12:00:00.000Z') };
const instantSleeper: Sleeper = { sleep: () => Promise.resolve() };

function request(overrides: Partial<Parameters<CachedHttpClient['getJson']>[0]> = {}) {
  return {
    sourceId: 'openfda_ndc',
    displayName: 'openFDA NDC Directory',
    url: 'https://api.fda.gov/drug/ndc.json?search=test',
    queryDescription: 'search=test',
    minIntervalMs: 0,
    cacheTtlSeconds: 60,
    ...overrides,
  };
}

/** Replays a queue of scripted responses and counts the calls. */
function scriptFetch(
  responses: { status: number; body: string; headers?: Record<string, string> }[],
): {
  calls: string[];
} {
  const calls: string[] = [];
  let index = 0;

  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url);
    const scripted = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (scripted === undefined) throw new Error('no scripted response');

    // Spread rather than assign: `exactOptionalPropertyTypes` makes
    // `headers: undefined` a type error, because "absent" and "present but
    // undefined" are genuinely different things.
    return Promise.resolve(
      new Response(scripted.body, {
        status: scripted.status,
        ...(scripted.headers === undefined ? {} : { headers: scripted.headers }),
      }),
    );
  });

  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CachedHttpClient.getJson', () => {
  it('returns the parsed body with provenance attached', async () => {
    scriptFetch([{ status: 200, body: '{"value":42}' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    const result = await client.getJson(request(), bodySchema);

    expect(result.data.value).toBe(42);
    // This is the property the whole data covenant rests on: data cannot be
    // obtained without the provenance for it.
    expect(result.provenance.source_name).toBe('openFDA NDC Directory');
    expect(result.provenance.source_url).toBe('https://api.fda.gov/drug/ndc.json?search=test');
    expect(result.provenance.query).toBe('search=test');
    expect(result.provenance.fetched_at).toBe('2026-09-01T12:00:00.000Z');
  });

  it('serves the second identical request from cache without a network call', async () => {
    const { calls } = scriptFetch([{ status: 200, body: '{"value":42}' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await client.getJson(request(), bodySchema);
    const second = await client.getJson(request(), bodySchema);

    expect(calls).toHaveLength(1);
    expect(second.fromCache).toBe(true);
  });

  it('reports the original fetch time on a cache hit, not the time of the hit', async () => {
    // A cached value is still a value fetched at that instant. Restamping it
    // would misrepresent how fresh the number is, which is the one thing the
    // Sources drawer exists to tell the reader honestly.
    let nowMs = Date.parse('2026-09-01T12:00:00.000Z');
    const movingClock: Clock = { now: () => new Date(nowMs) };
    scriptFetch([{ status: 200, body: '{"value":42}' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: movingClock,
      sleeper: instantSleeper,
    });

    const first = await client.getJson(request(), bodySchema);
    nowMs += 3_600_000;
    const second = await client.getJson(request(), bodySchema);

    expect(second.provenance.fetched_at).toBe(first.provenance.fetched_at);
  });

  it('treats a different URL as a different cache entry', async () => {
    const { calls } = scriptFetch([
      { status: 200, body: '{"value":1}' },
      { status: 200, body: '{"value":2}' },
    ]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await client.getJson(request(), bodySchema);
    await client.getJson(
      request({ url: 'https://api.fda.gov/drug/ndc.json?search=other' }),
      bodySchema,
    );

    expect(calls).toHaveLength(2);
  });

  it('retries a 503 and succeeds on the second attempt', async () => {
    const { calls } = scriptFetch([
      { status: 503, body: 'upstream is unwell' },
      { status: 200, body: '{"value":7}' },
    ]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    const result = await client.getJson(request(), bodySchema);

    expect(calls).toHaveLength(2);
    expect(result.data.value).toBe(7);
  });

  it('does not retry a 404, and reports it as not_found', async () => {
    const { calls } = scriptFetch([{ status: 404, body: 'no matches' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await expect(client.getJson(request(), bodySchema)).rejects.toMatchObject({
      kind: 'not_found',
    });
    expect(calls).toHaveLength(1);
  });

  it('gives up after the retry budget and reports rate_limited', async () => {
    const { calls } = scriptFetch([{ status: 429, body: 'slow down' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await expect(client.getJson(request({ maxAttempts: 3 }), bodySchema)).rejects.toMatchObject({
      kind: 'rate_limited',
    });
    expect(calls).toHaveLength(3);
  });

  it('reports a body that does not match the schema as malformed_response', async () => {
    // A source that silently changed its shape must fail loudly rather than
    // produce half-parsed records that look fine until someone reads them.
    scriptFetch([{ status: 200, body: '{"vaIue":"forty-two"}' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await expect(client.getJson(request(), bodySchema)).rejects.toMatchObject({
      kind: 'malformed_response',
    });
  });

  it('reports a non-JSON body as malformed_response', async () => {
    scriptFetch([{ status: 200, body: '<html>rate limited</html>' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    await expect(client.getJson(request(), bodySchema)).rejects.toBeInstanceOf(ConnectorError);
  });

  it('does not cache a failed response', async () => {
    const { calls } = scriptFetch([
      { status: 500, body: 'boom' },
      { status: 500, body: 'boom' },
      { status: 500, body: 'boom' },
      { status: 200, body: '{"value":9}' },
    ]);
    const cache = createMemoryCache();
    const client = new CachedHttpClient({ cache, clock: frozenClock, sleeper: instantSleeper });

    await expect(client.getJson(request({ maxAttempts: 2 }), bodySchema)).rejects.toBeInstanceOf(
      ConnectorError,
    );
    const retried = await client.getJson(request({ maxAttempts: 2 }), bodySchema);

    expect(retried.fromCache).toBe(false);
    expect(calls.length).toBeGreaterThan(2);
  });

  it('keeps the raw body, so a carrier quote can be proved later', async () => {
    scriptFetch([{ status: 200, body: '{"value":42}' }]);
    const client = new CachedHttpClient({
      cache: createMemoryCache(),
      clock: frozenClock,
      sleeper: instantSleeper,
    });

    const result = await client.getJson(request(), bodySchema);

    expect(result.rawBody).toBe('{"value":42}');
  });
});
