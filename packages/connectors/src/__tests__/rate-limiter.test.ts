/**
 * Rate-limiter tests.
 *
 * The clock and the sleeper are both injected, so these tests assert the exact
 * sequence of waits without any test actually waiting. A test that used real
 * timers to verify a one-second Nominatim limit would take seconds and would be
 * flaky on a loaded machine.
 */

import { describe, expect, it } from 'vitest';

import type { Clock, Sleeper } from '../http/ports';
import { createRateLimiter } from '../http/rate-limiter';

/** A clock that only moves when a sleep says it moved. */
function fakeClock(startMs = 1_000_000): Clock & { advance(ms: number): void } {
  let nowMs = startMs;
  return {
    now: () => new Date(nowMs),
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function recordingSleeper(clock: ReturnType<typeof fakeClock>): Sleeper & { waits: number[] } {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms: number) => {
      waits.push(ms);
      clock.advance(ms);
      return Promise.resolve();
    },
  };
}

describe('createRateLimiter', () => {
  it('lets the first request through without waiting', async () => {
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    await limiter.acquire('nominatim', 1000);

    expect(sleeper.waits).toEqual([]);
  });

  it('waits the full interval for a second request in the same instant', async () => {
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    await limiter.acquire('nominatim', 1000);
    await limiter.acquire('nominatim', 1000);

    expect(sleeper.waits).toEqual([1000]);
  });

  it('waits only the remainder when some time has already passed', async () => {
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    await limiter.acquire('gdelt_doc', 5000);
    clock.advance(3200);
    await limiter.acquire('gdelt_doc', 5000);

    expect(sleeper.waits).toEqual([1800]);
  });

  it('does not wait at all when the interval has already elapsed', async () => {
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    await limiter.acquire('openfda_ndc', 250);
    clock.advance(500);
    await limiter.acquire('openfda_ndc', 250);

    expect(sleeper.waits).toEqual([]);
  });

  it('does not let one source block another', async () => {
    // This is why the ingestion worker can fan out across a dozen sources at
    // once: Nominatim's one-per-second limit must not slow down openFDA.
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    await limiter.acquire('nominatim', 1000);
    await limiter.acquire('openfda_ndc', 250);

    expect(sleeper.waits).toEqual([]);
  });

  it('serialises concurrent callers to the same source rather than racing them', async () => {
    const clock = fakeClock();
    const sleeper = recordingSleeper(clock);
    const limiter = createRateLimiter(clock, sleeper);

    // Three callers arriving in the same tick. Without the promise chain they
    // would all see "no previous request" and all fire immediately, which is
    // precisely how an IP gets blocked by Nominatim.
    await Promise.all([
      limiter.acquire('nominatim', 1000),
      limiter.acquire('nominatim', 1000),
      limiter.acquire('nominatim', 1000),
    ]);

    expect(sleeper.waits).toEqual([1000, 1000]);
  });
});
