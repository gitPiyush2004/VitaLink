/**
 * The composition root for carriers.
 *
 * Separate from `index.ts` because carriers have a concern the open-data sources
 * do not: **credentials**, and the rule that they never leave this process. Every
 * secret read here comes from `env` and is handed to an adapter constructor. No
 * carrier key, token or client secret is ever returned from a service, put in a
 * response body, or logged. Spec 6.15.
 *
 * ## Which carriers exist, and why five of six cannot quote
 *
 * DSV is the one Tier A integration: a documented OAuth flow and a demo
 * environment anyone can register for. FedEx, UPS, DHL, Kuehne+Nagel and CEVA are
 * registered as `UnavailableCarrierAdapter`s carrying the *verified* reason they
 * cannot be called — no public developer programme, or approval required — with
 * the documentation URL where that was checked.
 *
 * Registering them at all is the point. Spec 6.9 requires that an unavailable
 * carrier appear in the comparison table with its reason rather than being
 * omitted, because a table showing one carrier reads as "there is one option"
 * when the truth is "there is one option we can see".
 *
 * ## Mock mode
 *
 * `MockCarrierAdapter` is registered only when `CARRIER_MOCK_MODE` is on, and its
 * own constructor throws if it is not — and `env.ts` refuses to parse a
 * production config with the flag set. Three independent barriers, because a mock
 * price presented as a real carrier quote is the single most damaging thing this
 * system could do.
 */

import { createHash } from 'node:crypto';

import {
  DsvAdapter,
  MockCarrierAdapter,
  UnavailableCarrierAdapter,
  createCarrierRegistry,
  type CarrierAdapter,
  type CarrierAdapterDeps,
  type CarrierRegistry,
} from '@vitalink/connectors';
import type { CarrierCapabilities, CarrierId } from '@vitalink/contracts';

import { CARRIER_RAW_ARCHIVE_TTL_SECONDS, HASH_PREFIX_LENGTH } from '@config/constants';
import { env } from '@config/env';
import { getRedis } from '@shared/db/redis';
import { logger } from '@shared/logger';

import { getHttpClient } from './index';

/**
 * The five carriers with no callable quote API, and the verified reason for each.
 *
 * The notes are what was actually found when each developer portal was checked,
 * not a guess at why. `docs/CARRIER_STATUS.md` records the date of each check.
 */
const TIER_C_CARRIERS = [
  {
    id: 'fedex' as const,
    displayName: 'FedEx',
    integrationNote:
      'FedEx publishes a developer portal, but rate quotes require an approved production ' +
      'account with a shipping agreement. No account has been arranged for this project, so ' +
      'no quote can be requested.',
    documentationUrl: 'https://developer.fedex.com/api/en-us/catalog/rate.html',
  },
  {
    id: 'ups' as const,
    displayName: 'UPS',
    integrationNote:
      'UPS Rating API access requires a UPS account number and an approved application. No ' +
      'account has been arranged for this project.',
    documentationUrl: 'https://developer.ups.com/api/reference',
  },
  {
    id: 'dhl' as const,
    displayName: 'DHL',
    integrationNote:
      'DHL Express MyDHL API requires an existing DHL Express account with rating enabled. ' +
      'The free developer tier does not include pharmaceutical or cold-chain services.',
    documentationUrl: 'https://developer.dhl.com/api-reference/dhl-express-mydhl-api',
  },
  {
    id: 'kuehne_nagel' as const,
    displayName: 'Kuehne+Nagel',
    integrationNote:
      'Kuehne+Nagel offers no public developer programme. Quotations are arranged through an ' +
      'account manager, so there is no endpoint to call.',
    documentationUrl: 'https://home.kuehne-nagel.com/',
  },
  {
    id: 'ceva' as const,
    displayName: 'CEVA Logistics',
    integrationNote:
      'CEVA offers no public quote API. Rates are contracted commercially, so there is no ' +
      'endpoint to call.',
    documentationUrl: 'https://www.cevalogistics.com/',
  },
];

let registry: CarrierRegistry | null = null;

/**
 * Archives a raw carrier payload and returns a reference.
 *
 * A `LIVE_QUOTE` cannot be constructed without one, by contract, because without
 * the archived payload a real quote is indistinguishable from a fabricated one.
 *
 * The reference is a content hash and the payload goes to Redis under a
 * documented TTL. The honest limitation, stated here rather than left for a
 * reader to discover when an old quote's payload has gone: this archive
 * **expires**. A quote older than the TTL keeps its `raw_response_ref` and the
 * payload behind it is no longer retrievable. Object storage would be the fix,
 * and it is not in the MVP.
 */
function createArchiver(): CarrierAdapterDeps['archiveRawPayload'] {
  return async (carrierId, body) => {
    const digest = createHash('sha256').update(body).digest('hex').slice(0, HASH_PREFIX_LENGTH);
    const ref = `carrier-raw:${carrierId}:${digest}`;

    try {
      // Deliberately not logged: a raw carrier payload can carry account
      // identifiers, and a bearer token if a carrier ever echoes one back.
      await getRedis().set(ref, body, 'EX', CARRIER_RAW_ARCHIVE_TTL_SECONDS);
    } catch (error) {
      // The reference is still returned. A failed archive write must not turn a
      // successful carrier call into a lost quote — but it is logged as a
      // warning, because a LIVE_QUOTE whose payload was never stored is a quote
      // nobody can later verify.
      logger.warn({ err: error, ref }, 'could not archive the raw carrier payload');
    }

    return ref;
  };
}

function buildAdapters(deps: CarrierAdapterDeps): CarrierAdapter[] {
  const adapters: CarrierAdapter[] = [
    new DsvAdapter(deps, {
      environment: env.DSV_ENVIRONMENT,
      clientId: env.DSV_CLIENT_ID,
      clientSecret: env.DSV_CLIENT_SECRET,
      subscriptionKey: env.DSV_SUBSCRIPTION_KEY,
    }),
    ...TIER_C_CARRIERS.map(
      (carrier) => new UnavailableCarrierAdapter(deps, { ...carrier, apiKey: '' }),
    ),
  ];

  if (env.CARRIER_MOCK_MODE) {
    // Loud, because a demo where a mock quote was mistaken for a real one would
    // be worse than a demo with one fewer carrier.
    logger.warn(
      'CARRIER_MOCK_MODE is on: a synthetic carrier is registered. Its quotes are labelled ' +
        'SANDBOX_QUOTE with a SCENARIO price, its display name says "development only", and ' +
        'it must never be described as a carrier quote.',
    );
    adapters.push(new MockCarrierAdapter(deps, true));
  }

  return adapters;
}

/** The one carrier registry. Lazily built, because the HTTP client needs Redis. */
export function getCarrierRegistry(): CarrierRegistry {
  if (registry !== null) return registry;

  const deps: CarrierAdapterDeps = {
    http: getHttpClient(),
    clock: { now: () => new Date() },
    archiveRawPayload: createArchiver(),
  };

  registry = createCarrierRegistry(buildAdapters(deps), deps.clock);
  return registry;
}

/** One carrier as the coverage panel renders it. */
export type CarrierDescription = {
  id: CarrierId;
  displayName: string;
  tier: string;
  isConfigured: boolean;
  integrationNote: string;
  capabilities: CarrierCapabilities | null;
  /** Non-null when the documented capabilities could not be read, and why. */
  capabilityError: string | null;
};

/**
 * Every registered carrier, including the five that cannot quote.
 *
 * Lives here rather than in the logistics service because it describes the
 * registry, not a decision. A capability lookup that throws produces a row with
 * `capabilityError` set — the carrier still appears, because a missing row would
 * read as "this carrier does not exist" rather than "we could not read its docs".
 */
export async function describeCarriers(registry: CarrierRegistry): Promise<CarrierDescription[]> {
  const notes = new Map(TIER_C_CARRIERS.map((carrier) => [carrier.id, carrier.integrationNote]));

  return Promise.all(
    registry.all().map(async (adapter) => {
      const base = {
        id: adapter.id,
        displayName: adapter.displayName,
        tier: adapter.tier,
        isConfigured: adapter.isConfigured(),
        integrationNote: notes.get(adapter.id as (typeof TIER_C_CARRIERS)[number]['id']) ?? '',
      };

      try {
        return { ...base, capabilities: await adapter.getCapabilities(), capabilityError: null };
      } catch (error) {
        return {
          ...base,
          capabilities: null,
          capabilityError: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}
