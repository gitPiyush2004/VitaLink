/**
 * The carrier registry and the quote fan-out.
 *
 * Two guarantees, both from spec 6.10, and both structural rather than
 * conventional.
 *
 * ## The comparison always completes
 *
 * The fan-out uses `Promise.allSettled`, a per-carrier timeout and a circuit
 * breaker. One carrier timing out, throwing, or being unreachable cannot stop the
 * others — a recommendation over a partial set is useful, and a comparison that
 * fails because one of six carriers was slow is not.
 *
 * ## No carrier is ever silently dropped
 *
 * This is the guarantee that matters, and the reason `collectQuotes` is shaped
 * the way it is: it starts from the **full adapter list** and produces exactly one
 * result per adapter. A carrier whose promise rejected still appears, converted
 * to an `UNAVAILABLE` quote with a reason. There is no code path that returns
 * fewer rows than there are carriers, so "we forgot to show DHL" cannot happen —
 * as opposed to being something a reviewer has to notice.
 *
 * The circuit breaker deserves its own note. After a documented number of
 * consecutive failures a carrier is reported `circuit_open` without a call being
 * attempted, for a documented cooldown. That is not only a latency
 * optimisation: repeatedly hammering a carrier's API during an outage is how an
 * integration gets rate-limited or blocked, and the breaker is what stops a
 * failing carrier from degrading the other five.
 */

import type { CarrierId, CarrierQuote, ShipmentRequest } from '@vitalink/contracts';

import { unavailableQuote, type CarrierAdapter } from './carrier-adapter';

const MS_PER_SECOND = 1000;
/** Spec 6.10. Consecutive failures before the breaker opens. */
const FAILURE_THRESHOLD = 5;
/** How long the breaker stays open before one probe is allowed through. */
const OPEN_MS = 60 * MS_PER_SECOND;
/** Hard ceiling per carrier, so one slow adapter cannot stall the fan-out. */
const PER_CARRIER_TIMEOUT_MS = 8 * MS_PER_SECOND;

type BreakerState = { consecutiveFailures: number; openedAtMs: number | null };

/**
 * One breaker per carrier.
 *
 * In-process, like the rate limiter, and for the same reason and with the same
 * limitation: with a single API instance it is exact, and a second instance would
 * get its own breaker. The fix is the same too — move the counter into Redis,
 * which is already a dependency. Not done yet because it would be speculative.
 */
export class CircuitBreaker {
  private readonly states = new Map<CarrierId, BreakerState>();

  constructor(private readonly clock: { now(): Date }) {}

  isOpen(carrierId: CarrierId): boolean {
    const state = this.states.get(carrierId);
    if (state?.openedAtMs === undefined || state.openedAtMs === null) return false;

    const elapsed = this.clock.now().getTime() - state.openedAtMs;
    if (elapsed < OPEN_MS) return true;

    // Cooldown elapsed: half-open. One call is allowed through, and it either
    // closes the breaker or re-opens it.
    state.openedAtMs = null;
    state.consecutiveFailures = FAILURE_THRESHOLD - 1;
    return false;
  }

  recordSuccess(carrierId: CarrierId): void {
    this.states.set(carrierId, { consecutiveFailures: 0, openedAtMs: null });
  }

  recordFailure(carrierId: CarrierId): void {
    const state = this.states.get(carrierId) ?? { consecutiveFailures: 0, openedAtMs: null };
    state.consecutiveFailures += 1;

    if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
      state.openedAtMs = this.clock.now().getTime();
    }

    this.states.set(carrierId, state);
  }

  /** Exposed so the recommendation can say a carrier was skipped, not just failed. */
  secondsUntilRetry(carrierId: CarrierId): number | null {
    const state = this.states.get(carrierId);
    if (state?.openedAtMs === undefined || state.openedAtMs === null) return null;

    const remaining = OPEN_MS - (this.clock.now().getTime() - state.openedAtMs);
    return remaining <= 0 ? null : Math.ceil(remaining / MS_PER_SECOND);
  }
}

export type CarrierRegistry = {
  /** Every registered adapter, whether configured or not. */
  all(): CarrierAdapter[];
  byId(carrierId: CarrierId): CarrierAdapter | undefined;
  /**
   * Quotes from every carrier, one result per carrier, always.
   *
   * @returns quotes plus the coverage counts the recommendation must disclose.
   */
  collectQuotes(request: ShipmentRequest): Promise<CollectedQuotes>;
};

export type CollectedQuotes = {
  quotes: CarrierQuote[];
  carriersAttempted: number;
  /** Carriers that returned at least one priced quote. */
  carriersQuoted: number;
  /** Per-carrier reason, for the ones that did not. Rendered in the table. */
  unavailableReasons: { carrierId: CarrierId; displayName: string; reason: string }[];
};

/** What `quoteOne` and the fold below both need. */
type FanOutDeps = { breaker: CircuitBreaker; clock: { now(): Date } };

/**
 * One carrier's quotes, with the timeout and the breaker applied.
 *
 * Returns `UNAVAILABLE` rather than rejecting, so the caller never has to decide
 * what to do about a missing row.
 */
async function quoteOne(
  adapter: CarrierAdapter,
  request: ShipmentRequest,
  deps: FanOutDeps,
): Promise<CarrierQuote[]> {
  const retrievedAt = deps.clock.now().toISOString();

  if (deps.breaker.isOpen(adapter.id)) {
    const seconds = deps.breaker.secondsUntilRetry(adapter.id);
    return [
      unavailableQuote({
        shipmentRequestId: request.id,
        carrierId: adapter.id,
        displayName: adapter.displayName,
        reason: 'circuit_open',
        detail:
          `Skipped without calling: ${String(FAILURE_THRESHOLD)} consecutive failures opened ` +
          `the circuit breaker${seconds === null ? '' : `, retrying in ${String(seconds)}s`}. ` +
          'Hammering a failing carrier is how an integration gets blocked.',
        retrievedAt,
      }),
    ];
  }

  try {
    const quotes = await withTimeout(adapter.getQuote(request), PER_CARRIER_TIMEOUT_MS);

    // Only a priced quote counts as success. An adapter that dutifully returns
    // UNAVAILABLE every time is failing, and the breaker should notice.
    if (quotes.some((quote) => quote.price !== null)) {
      deps.breaker.recordSuccess(adapter.id);
    } else {
      deps.breaker.recordFailure(adapter.id);
    }

    return quotes;
  } catch (error) {
    deps.breaker.recordFailure(adapter.id);

    // An adapter is contractually not supposed to throw for a business reason,
    // so reaching here means a genuine fault or a timeout. Either way the row
    // still appears.
    return [
      unavailableQuote({
        shipmentRequestId: request.id,
        carrierId: adapter.id,
        displayName: adapter.displayName,
        reason: error instanceof TimeoutError ? 'api_timeout' : 'upstream_error',
        detail: error instanceof Error ? error.message : String(error),
        retrievedAt,
      }),
    ];
  }
}

/**
 * A rejected settle, converted to a row.
 *
 * Belt and braces: `quoteOne` already catches everything. This path is what
 * guarantees one row per carrier even if that stops being true.
 */
function rowForRejection(
  adapter: CarrierAdapter,
  request: ShipmentRequest,
  reason: unknown,
  clock: { now(): Date },
): CarrierQuote {
  return unavailableQuote({
    shipmentRequestId: request.id,
    carrierId: adapter.id,
    displayName: adapter.displayName,
    reason: 'upstream_error',
    detail: String(reason),
    retrievedAt: clock.now().toISOString(),
  });
}

/**
 * Folds the settled results into exactly one row per adapter.
 *
 * Iterates the **adapter list**, not the results, which is the structural
 * guarantee: there is no code path that returns fewer rows than there are
 * carriers, so "we forgot to show DHL" cannot happen.
 */
function foldQuotes(
  adapters: CarrierAdapter[],
  settled: PromiseSettledResult<{ adapter: CarrierAdapter; quotes: CarrierQuote[] }>[],
  request: ShipmentRequest,
  clock: { now(): Date },
): CollectedQuotes {
  const quotes: CarrierQuote[] = [];
  const unavailableReasons: CollectedQuotes['unavailableReasons'] = [];
  let carriersQuoted = 0;

  adapters.forEach((adapter, index) => {
    const result = settled[index];
    const carrierQuotes =
      result === undefined || result.status === 'rejected'
        ? [
            rowForRejection(
              adapter,
              request,
              result?.status === 'rejected' ? result.reason : 'no result',
              clock,
            ),
          ]
        : result.value.quotes;

    quotes.push(...carrierQuotes);

    if (carrierQuotes.some((quote) => quote.price !== null)) {
      carriersQuoted += 1;
      return;
    }

    unavailableReasons.push({
      carrierId: adapter.id,
      displayName: adapter.displayName,
      reason:
        carrierQuotes[0]?.provenance.calculation_method ??
        carrierQuotes[0]?.unavailable_reason ??
        'no quote was obtained',
    });
  });

  return {
    quotes,
    carriersAttempted: adapters.length,
    carriersQuoted,
    unavailableReasons,
  };
}

export function createCarrierRegistry(
  adapters: CarrierAdapter[],
  clock: { now(): Date },
): CarrierRegistry {
  const deps: FanOutDeps = { breaker: new CircuitBreaker(clock), clock };
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));

  return {
    all: () => [...adapters],
    byId: (carrierId) => byId.get(carrierId),

    async collectQuotes(request: ShipmentRequest): Promise<CollectedQuotes> {
      // allSettled, not all: one rejection must not take the comparison with it.
      const settled = await Promise.allSettled(
        adapters.map(async (adapter) => ({
          adapter,
          quotes: await quoteOne(adapter, request, deps),
        })),
      );

      return foldQuotes(adapters, settled, request, clock);
    },
  };
}

/** Raised when a carrier does not answer inside the per-carrier budget. */
class TimeoutError extends Error {
  constructor(ms: number) {
    super(`carrier did not respond within ${String(ms)}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Races a promise against a timer.
 *
 * The timer is cleared in `finally` so a fast carrier does not leave a pending
 * timeout holding the event loop open — which is what makes a CLI script hang for
 * eight seconds after it has finished.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutError(ms));
        }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
