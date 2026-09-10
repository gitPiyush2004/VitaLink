/**
 * EXECUTE: turning an exposed drug into a ranked, explained carrier choice.
 *
 * The service does the I/O and none of the judgement. It reads the cascade and
 * the drug, fans out to the carriers, and hands the results to
 * `domain/recommend.ts` — which is a pure function, and therefore the thing the
 * tests actually drive. Nothing in this file decides which carrier wins.
 *
 * Three behaviours are worth reading before the code.
 *
 * **The recommendation is derived, not configured.** `recommendFromCascade` takes
 * a cascade id, a drug id and the consignment size, and produces a shipment whose
 * temperature requirement, deadline, urgency and special handling all come from
 * the drug's label and the cascade's cover band. That is the phase gate: the
 * pharmaceutical constraints are never asked of the operator.
 *
 * **A constraint change supersedes rather than overwrites** (spec 6.12). Re-run a
 * shipment with a budget ceiling and the new recommendation records what changed
 * and points back at the old one, which is flagged rather than deleted. "Why did
 * we pick DSV in March" has to stay answerable after someone re-runs it in April.
 *
 * **Capabilities come from the adapter, not from the quote.** A quote says what
 * one service offers; capabilities say what the carrier documents. The gate needs
 * the second, because a carrier that omits GDP from a quote payload has not
 * thereby told us it is not GDP compliant.
 */

import type { CarrierRegistry } from '@vitalink/connectors';
import type { CarrierCapabilities, CarrierId, CarrierQuote } from '@vitalink/contracts';

import { MAX_PAGE_SIZE } from '@config/constants';
import { WEIGHT_PROFILES } from '@config/weights';
import type { CascadeService } from '@modules/cascade';
import type { CatalogService } from '@modules/catalog';
import { describeCarriers, type CarrierDescription } from '@shared/connectors/carriers';
import { NotFoundError } from '@shared/errors';
import { logger } from '@shared/logger';

import { coverBandOf, toDrugContext, unknownCapabilities } from './domain/carrier-fallbacks';
import { recommend, type QuoteWithCapabilities } from './domain/recommend';
import { deriveShipment, type ConsignmentInput } from './domain/shipment-derivation';
import { deriveUrgency } from './domain/urgency';
import type {
  LogisticsRepository,
  RecommendationRecord,
  ShipmentRecord,
} from './logistics.repository';

/** What the caller supplies. Only the parts no source can state. See 6.5. */
export type RecommendFromCascadeInput = {
  orgId: string;
  cascadeId: string;
  drugId: string;
  consignment: ConsignmentInput;
  /** Carrier id to bonus points. Empty unless an operator configured one. */
  preference?: Record<string, number>;
  /** Overrides the derived urgency. Recorded in the change log when used. */
  urgencyOverride?: ShipmentRecord['request']['urgency'];
};

export type RecommendationWithShipment = {
  shipment: ShipmentRecord;
  recommendation: RecommendationRecord;
};

/**
 * Everything the service needs from outside itself.
 *
 * A single deps object rather than five constructor parameters: the clock is
 * injected so a recommendation's timestamps are reproducible under test, and
 * five positional arguments is where a constructor stops being readable.
 */
export type LogisticsDeps = {
  repository: LogisticsRepository;
  carriers: CarrierRegistry;
  cascades: CascadeService;
  catalog: CatalogService;
  clock?: { now(): Date };
};

export class LogisticsService {
  private readonly repository: LogisticsRepository;
  private readonly carriers: CarrierRegistry;
  private readonly cascades: CascadeService;
  private readonly catalog: CatalogService;
  private readonly clock: { now(): Date };

  constructor(deps: LogisticsDeps) {
    this.repository = deps.repository;
    this.carriers = deps.carriers;
    this.cascades = deps.cascades;
    this.catalog = deps.catalog;
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  /**
   * The whole loop, from a cascade to a ranked carrier list.
   *
   * @throws NotFoundError when the cascade or the drug does not exist, or when
   *   the cascade did not find that drug exposed — which is a real distinction:
   *   asking for a shipment of a drug this shock never touched is a mistake worth
   *   reporting rather than silently answering.
   * @throws InsufficientDataError when the drug's label yielded no temperature
   *   requirement. See `domain/shipment-derivation.ts` for why that is a hard stop.
   */
  async recommendFromCascade(
    input: RecommendFromCascadeInput,
  ): Promise<RecommendationWithShipment> {
    const { cascade, exposed, drug } = await this.loadContext(
      input.orgId,
      input.cascadeId,
      input.drugId,
    );
    const derivedShipment = deriveShipment({
      shipmentId: `ship-${cascade.id}-${input.drugId}`,
      cascade: {
        cascadeId: cascade.id,
        alertId: cascade.request.alertId,
        drugId: exposed.drugId,
        coverDaysBand: coverBandOf(exposed),
        // No alert severity yet: SENSE is a later phase, so a cascade run
        // manually carries no severity and urgency comes from cover alone.
        alertSeverity: null,
      },
      drug: toDrugContext(drug),
      consignment: input.consignment,
      now: this.clock.now(),
    });

    const request =
      input.urgencyOverride === undefined
        ? derivedShipment.request
        : { ...derivedShipment.request, urgency: input.urgencyOverride };

    const shipment = await this.repository.saveShipment(input.orgId, {
      request,
      prohibitedRanges: derivedShipment.prohibitedRanges,
      derivation: [
        ...derivedShipment.derivation,
        ...(input.urgencyOverride === undefined
          ? []
          : [
              `The operator overrode the derived urgency ${derivedShipment.urgency.urgency} ` +
                `with ${input.urgencyOverride}. The derivation above is what the data said.`,
            ]),
      ],
    });

    const recommendation = await this.quoteAndScore({
      orgId: input.orgId,
      shipment,
      preference: input.preference ?? {},
      // Why this *profile* is in force — the urgency derivation only. The rest of
      // the shipment derivation explains the constraints, which is a different
      // question and is stored on the shipment.
      selectedBecause: derivedShipment.urgency.derivation.join(' '),
    });

    return { shipment, recommendation };
  }

  /**
   * The cascade, the exposed drug within it, and the drug record.
   *
   * @throws NotFoundError when any of the three is missing. "This cascade never
   *   found that drug exposed" is a distinct mistake from "that drug does not
   *   exist", and both are worth reporting rather than silently answering.
   */
  private async loadContext(
    orgId: string,
    cascadeId: string,
    drugId: string,
  ): Promise<{
    cascade: NonNullable<Awaited<ReturnType<CascadeService['get']>>>;
    exposed: NonNullable<Awaited<ReturnType<CascadeService['get']>>>['exposedDrugs'][number];
    drug: NonNullable<Awaited<ReturnType<CatalogService['getDrug']>>>;
  }> {
    const cascade = await this.cascades.get(orgId, cascadeId);
    if (cascade === null) throw new NotFoundError('Cascade', cascadeId);

    const exposed = cascade.exposedDrugs.find((one) => one.drugId === drugId);
    if (exposed === undefined) {
      throw new NotFoundError(
        'Exposed drug in cascade',
        `${drugId} was not among the ${String(cascade.exposedDrugs.length)} drugs this cascade ` +
          'found exposed',
      );
    }

    const drug = await this.catalog.getDrug(drugId);
    if (drug === null) throw new NotFoundError('Drug', drugId);

    return { cascade, exposed, drug };
  }

  /**
   * Re-runs an existing shipment, superseding the previous recommendation.
   *
   * Spec 6.12's flow: the operator sets a budget ceiling, re-runs, and the new
   * recommendation carries a change log saying what moved and why the answer
   * differs. The old one is flagged, never deleted.
   */
  async rerun(input: {
    orgId: string;
    shipmentId: string;
    budgetCeilingInr?: number | null;
    urgencyOverride?: ShipmentRecord['request']['urgency'];
    preference?: Record<string, number>;
  }): Promise<RecommendationWithShipment> {
    const existing = await this.repository.findShipment(input.orgId, input.shipmentId);
    if (existing === null) throw new NotFoundError('Shipment request', input.shipmentId);

    const previous = await this.repository.findLatestForShipment(input.orgId, input.shipmentId);
    const changeLog = this.buildChangeLog(existing, input);

    const request = { ...existing.request };
    if (input.budgetCeilingInr !== undefined) {
      request.budget_ceiling_inr =
        input.budgetCeilingInr === null
          ? null
          : {
              value: input.budgetCeilingInr,
              unit: 'INR',
              tag: 'SCENARIO',
              provenance: {
                source_name: 'Scenario input (operator budget ceiling)',
                source_url: existing.request.provenance.source_url,
                query: null,
                fetched_at: this.clock.now().toISOString(),
              },
            };
    }
    if (input.urgencyOverride !== undefined) request.urgency = input.urgencyOverride;

    const shipment = await this.repository.saveShipment(input.orgId, {
      ...existing,
      request,
    });

    const recommendation = await this.quoteAndScore({
      orgId: input.orgId,
      shipment,
      preference: input.preference ?? {},
      // On a re-run the cover band is not re-read, so the honest statement is
      // that the profile follows from the shipment's stored urgency — plus the
      // change log, when an override is what moved it.
      selectedBecause:
        `Profile ${shipment.request.urgency} is in force from the shipment's stored urgency. ` +
        `${WEIGHT_PROFILES[shipment.request.urgency].rationale}` +
        (changeLog.length === 0 ? '' : ` ${changeLog.join(' ')}`),
      supersedes: previous?.id ?? null,
      changeLog,
    });

    // After the new record exists, so a crash between the two writes leaves a
    // current recommendation with a stale flag rather than none at all.
    if (previous !== null) {
      await this.repository.markSuperseded(input.orgId, previous.id, recommendation.id);
    }

    return { shipment, recommendation };
  }

  /**
   * Fans out to every carrier, gates, scores and stores the result.
   *
   * The one place the carrier registry is touched. Capabilities are fetched per
   * carrier alongside the quotes, and a carrier whose capability lookup fails is
   * still scored against `unknownCapabilities` — which fails any constraint that
   * requires a capability, so the failure is conservative rather than silent.
   */
  private async quoteAndScore(input: {
    orgId: string;
    shipment: ShipmentRecord;
    preference: Record<string, number>;
    selectedBecause: string;
    supersedes?: string | null;
    changeLog?: string[];
  }): Promise<RecommendationRecord> {
    const collected = await this.carriers.collectQuotes(input.shipment.request);
    const capabilities = await this.loadCapabilities(collected.quotes);

    const candidates: QuoteWithCapabilities[] = collected.quotes.map((quote) => ({
      quote,
      capabilities: capabilities.get(quote.provider) ?? unknownCapabilities(quote),
      // Both null in the MVP, and both sub-scores say so on their row rather
      // than in a footnote. Tracking history is Phase 13; lane exposure needs
      // the physical layer, which is not ingested.
      observedReliability: null,
      laneExposure: null,
    }));

    const result = recommend({
      request: input.shipment.request,
      candidates,
      prohibitedRanges: input.shipment.prohibitedRanges,
      profile: WEIGHT_PROFILES[input.shipment.request.urgency],
      preference: input.preference,
      carriersAttempted: collected.carriersAttempted,
      now: this.clock.now(),
    });

    if (result.recommendedQuoteId === null) {
      // Not an error to the caller: NO_ELIGIBLE_CARRIER is a finding, and it is
      // stored so the reasons can be read. Logged because it is worth noticing.
      logger.info(
        {
          shipmentId: input.shipment.request.id,
          attempted: collected.carriersAttempted,
          reasons: result.eligibility.flatMap((one) =>
            one.result.failures.map((failure) => failure.reason),
          ),
        },
        'no carrier was eligible for this shipment',
      );
    }

    return this.repository.saveRecommendation({
      orgId: input.orgId,
      shipmentRequestId: input.shipment.request.id,
      recommendation: result,
      quotes: collected.quotes,
      selectedBecause: input.selectedBecause,
      supersedes: input.supersedes ?? null,
      changeLog: input.changeLog ?? [],
      at: this.clock.now().toISOString(),
    });
  }

  /**
   * Documented capabilities, one lookup per carrier that returned a quote.
   *
   * `Promise.allSettled`, for the same reason the quote fan-out uses it: a
   * carrier whose documentation endpoint is down must not take the comparison
   * with it.
   */
  private async loadCapabilities(
    quotes: CarrierQuote[],
  ): Promise<Map<CarrierId, CarrierCapabilities>> {
    const ids = [...new Set(quotes.map((quote) => quote.provider))];
    const settled = await Promise.allSettled(
      ids.map(async (id) => {
        const adapter = this.carriers.byId(id);
        if (adapter === undefined) return null;
        return { id, capabilities: await adapter.getCapabilities() };
      }),
    );

    const byId = new Map<CarrierId, CarrierCapabilities>();
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled' && outcome.value !== null) {
        byId.set(outcome.value.id, outcome.value.capabilities);
        return;
      }
      logger.warn(
        { carrierId: ids[index] },
        'could not read documented capabilities; the carrier will be gated as fully unknown',
      );
    });

    return byId;
  }

  /** What changed since the previous run, in the operator's own terms. */
  private buildChangeLog(
    existing: ShipmentRecord,
    input: { budgetCeilingInr?: number | null; urgencyOverride?: string },
  ): string[] {
    const changes: string[] = [];
    const before = existing.request.budget_ceiling_inr;

    if (input.budgetCeilingInr !== undefined) {
      changes.push(
        input.budgetCeilingInr === null
          ? `The budget ceiling of INR ${(before?.value ?? 0).toLocaleString('en-IN')} was removed.`
          : `The budget ceiling changed from ` +
              `${before === null ? 'none' : `INR ${before.value.toLocaleString('en-IN')}`} to ` +
              `INR ${input.budgetCeilingInr.toLocaleString('en-IN')}. A quote above it is now ` +
              'reported NOT ELIGIBLE with the reason, not merely scored lower.',
      );
    }
    if (input.urgencyOverride !== undefined && input.urgencyOverride !== existing.request.urgency) {
      changes.push(
        `Urgency was changed from ${existing.request.urgency} to ${input.urgencyOverride}, ` +
          'which changes the weight profile and therefore the ranking.',
      );
    }

    return changes;
  }

  async getShipment(orgId: string, shipmentId: string): Promise<ShipmentRecord | null> {
    return this.repository.findShipment(orgId, shipmentId);
  }

  async listShipments(orgId: string, limit: number): Promise<ShipmentRecord[]> {
    return this.repository.listShipments(orgId, Math.min(limit, MAX_PAGE_SIZE));
  }

  async getRecommendation(orgId: string, id: string): Promise<RecommendationRecord | null> {
    return this.repository.findRecommendation(orgId, id);
  }

  async listRecommendations(orgId: string, limit: number): Promise<RecommendationRecord[]> {
    return this.repository.listRecommendations(orgId, Math.min(limit, MAX_PAGE_SIZE));
  }

  /**
   * Every registered carrier and its documented capabilities.
   *
   * Includes the five that cannot quote, with the verified reason on each. The
   * UI renders this as the carrier-coverage panel, which is the honest answer to
   * "why is there only one price in this table".
   */
  async listCarriers(): Promise<CarrierDescription[]> {
    return describeCarriers(this.carriers);
  }

  /**
   * The urgency this cascade implies for this drug, without planning a shipment.
   *
   * Exposed because the control tower shows the urgency badge before the
   * operator has entered a consignment size, and re-deriving it in the UI would
   * put the thresholds in two places.
   */
  async previewUrgency(
    orgId: string,
    cascadeId: string,
    drugId: string,
  ): Promise<ReturnType<typeof deriveUrgency>> {
    const { exposed, drug } = await this.loadContext(orgId, cascadeId, drugId);

    return deriveUrgency({
      coverDaysBand: coverBandOf(exposed),
      alertSeverity: null,
      affectedPopulation: null,
      isNlemCritical: drug.nlemCritical,
    });
  }
}
