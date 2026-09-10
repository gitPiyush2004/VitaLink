/**
 * SIMULATE and DECIDE: the joint matrix, the Pareto front, and the choice.
 *
 * ```
 * cascade + drug + the operator's sourcing options
 *   -> carrier quotes from the logistics recommendation
 *   -> the (sourcing x logistics) cross product, capped and reported
 *   -> outcome vectors, each field tagged DERIVED / MODELLED / unavailable
 *   -> Pareto front            (objective: no weights, no opinion)
 *   -> weighted objective      (subjective: weights displayed with the answer)
 * ```
 *
 * ## The solver is exhaustive enumeration, and that is not a shortcut
 *
 * `MAX_SCENARIOS_PER_MATRIX` caps the matrix at fifty rows. Enumerating fifty
 * rows and taking the minimum is exact, is faster than constructing a CP-SAT
 * model, and produces a ranking that can be read off the stored record. CP-SAT
 * earns its place when the matrix grows a dimension the cap cannot hold — which
 * it will, once the physical layer adds routing choices. `solver` records which
 * one ran, so the eventual switch is visible rather than silent.
 *
 * ## Two answers, and only one of them is an opinion
 *
 * The Pareto front is a fact about the options: a dominated scenario is worse on
 * every axis, and no preferences make it worth choosing. The objective's chosen
 * point requires saying how many rupees a day of shortage is worth, which nobody
 * can derive. So both are computed, both are stored, and the weights travel with
 * the answer. An operator who disagrees can pick a different point off the front
 * rather than being shown one option and told it is optimal.
 */

import { MAX_PAGE_SIZE } from '@config/constants';
import { OBJECTIVE_WEIGHTS, WEIGHT_PROFILES } from '@config/weights';
import type { CascadeService } from '@modules/cascade';
import type { CatalogService } from '@modules/catalog';
import type { LogisticsService } from '@modules/logistics';
import { InsufficientDataError, NotFoundError } from '@shared/errors';

import {
  deltaVsBaseline,
  enumerateScenarios,
  type CarrierOption,
  type CascadeFacts,
  type Scenario,
  type SourcingOption,
} from './domain/enumerate';
import { chooseScenario, paretoFront, scoreObjective } from './domain/pareto';
import type { ScenarioRunRecord, ScenariosRepository } from './scenarios.repository';

/**
 * The shipment's weight and deadline, or the defaults for having none.
 *
 * A zero weight makes the CO2 term zero, which is honest: with no shipment
 * there is nothing to weigh. A deadline of now means every carrier misses it,
 * which is also honest — a matrix built without a shipment has no arrival to
 * compare against, and treating that as "everything arrives in time" would be
 * the flattering error rather than the safe one.
 */
function consignmentFacts(
  shipment: Awaited<ReturnType<LogisticsService['getShipment']>>,
  clock: { now(): Date },
): { weightKg: number; deadlineIso: string } {
  if (shipment === null) return { weightKg: 0, deadlineIso: clock.now().toISOString() };

  return {
    weightKg: shipment.request.weight_kg.value,
    deadlineIso: shipment.request.required_delivery_deadline,
  };
}

/** What the caller asks for. The sourcing options are the operator's own. */
export type RunScenariosInput = {
  orgId: string;
  cascadeId: string;
  drugId: string;
  /** Must include exactly one DO_NOTHING option. Enforced by the schema. */
  sourcing: SourcingOption[];
  /**
   * A prior logistics recommendation to take carrier quotes from.
   *
   * Required rather than optional, and that is the design: the scenario matrix
   * pairs sourcing against *real quotes*, and inventing a freight cost would
   * make every row's total cost fictional. If there is no recommendation yet,
   * run one first.
   */
  recommendationId: string;
  /** Distance for the CO2 term, when the operator knows it. Null otherwise. */
  distanceKm: number | null;
  weights?: Record<string, number>;
};

export type ScenariosDeps = {
  repository: ScenariosRepository;
  cascades: CascadeService;
  catalog: CatalogService;
  logistics: LogisticsService;
  clock?: { now(): Date };
};

export class ScenariosService {
  private readonly repository: ScenariosRepository;
  private readonly cascades: CascadeService;
  private readonly catalog: CatalogService;
  private readonly logistics: LogisticsService;
  private readonly clock: { now(): Date };

  constructor(deps: ScenariosDeps) {
    this.repository = deps.repository;
    this.cascades = deps.cascades;
    this.catalog = deps.catalog;
    this.logistics = deps.logistics;
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  /**
   * Builds the matrix, ranks it, stores the run.
   *
   * @throws NotFoundError when the cascade, the drug or the recommendation is
   *   missing, or when the cascade did not find that drug exposed.
   * @throws InsufficientDataError when the recommendation produced no eligible
   *   carrier. A matrix of sourcing options paired with nothing has no logistics
   *   axis, and reporting a total cost of "intervention only" would present a
   *   shipment-free plan as if it were shippable.
   */
  async run(input: RunScenariosInput): Promise<ScenarioRunRecord> {
    const facts = await this.gatherFacts(input);
    const carriers = await this.gatherCarriers(input);
    const now = this.clock.now();

    const { scenarios, truncation } = enumerateScenarios({
      facts,
      sourcing: input.sourcing,
      carriers,
      deadlineIso: facts.deadlineIso,
      now,
      provenanceUrl: `/api/v1/scenarios/${facts.cascadeId}`,
    });

    return this.rank({ input, facts, scenarios, truncation, now });
  }

  /**
   * The cascade's numbers for this drug, plus the drug's own facts.
   *
   * Everything here is DERIVED upstream: the exposure came from openFDA
   * listings, the cover band from the cascade's projection. This method does no
   * arithmetic — it only assembles.
   */
  private async gatherFacts(
    input: RunScenariosInput,
  ): Promise<CascadeFacts & { deadlineIso: string }> {
    const { cascade, exposed } = await this.requireExposedDrug(input);
    const drug = await this.catalog.getDrug(input.drugId);
    if (drug === null) throw new NotFoundError('Drug', input.drugId);

    const shipment = await this.logistics.getShipment(input.orgId, this.shipmentIdFor(input));

    return {
      drugId: drug.id,
      drugLabel: drug.genericName,
      cascadeId: cascade.id,
      exposure: exposed.exposureQuantity.value,
      exposureMethod: exposed.exposureQuantity.provenance.calculation_method ?? '',
      coverDaysLow: exposed.coverProjection.coverLow[0] ?? 0,
      coverDaysHigh: exposed.coverProjection.coverHigh[0] ?? 0,
      // Null until the cascade calls the Python reliability service. The
      // recovery term falls back to the intervention's own lead time and says so
      // on the Quantity, rather than substituting one for the other silently.
      meanUptimeDays: null,
      isNlemCritical: drug.nlemCritical,
      distanceKm: input.distanceKm,
      shockDurationDays: cascade.request.durationDays,
      ...consignmentFacts(shipment, this.clock),
    };
  }

  /**
   * The cascade, and this drug's row in it.
   *
   * @throws NotFoundError when either is missing. The two are distinct
   *   mistakes: "no such cascade" and "that cascade never found this drug
   *   exposed", and answering the second silently would produce a matrix about
   *   a drug the shock does not reach.
   */
  private async requireExposedDrug(input: RunScenariosInput): Promise<{
    cascade: NonNullable<Awaited<ReturnType<CascadeService['get']>>>;
    exposed: NonNullable<Awaited<ReturnType<CascadeService['get']>>>['exposedDrugs'][number];
  }> {
    const cascade = await this.cascades.get(input.orgId, input.cascadeId);
    if (cascade === null) throw new NotFoundError('Cascade', input.cascadeId);

    const exposed = cascade.exposedDrugs.find((one) => one.drugId === input.drugId);
    if (exposed === undefined) {
      throw new NotFoundError(
        'Exposed drug in cascade',
        `${input.drugId} was not among the ${String(cascade.exposedDrugs.length)} drugs this ` +
          'cascade found exposed',
      );
    }

    return { cascade, exposed };
  }

  /** The shipment a cascade-derived recommendation would have created. */
  private shipmentIdFor(input: RunScenariosInput): string {
    return `ship-${input.cascadeId}-${input.drugId}`;
  }

  /**
   * The eligible carrier quotes from a prior recommendation.
   *
   * Only the eligible ones. An ineligible carrier is not an option, so pairing a
   * sourcing intervention with it would put a row in the matrix that could never
   * be executed — and it would compete on cost against rows that could.
   */
  private async gatherCarriers(input: RunScenariosInput): Promise<CarrierOption[]> {
    const recommendation = await this.logistics.getRecommendation(
      input.orgId,
      input.recommendationId,
    );
    if (recommendation === null) {
      throw new NotFoundError('Logistics recommendation', input.recommendationId);
    }

    const eligible = new Set(
      recommendation.recommendation.eligibility
        .filter((one) => one.result.isEligible)
        .map((one) => one.quoteId),
    );

    const carriers = recommendation.quotes
      .filter((quote) => eligible.has(quote.id) && quote.price !== null)
      .map((quote): CarrierOption => ({
        quoteId: quote.id,
        carrierId: quote.provider,
        carrierDisplay: quote.provider_display,
        service: quote.service,
        quoteStatus: quote.quote_status,
        priceInr: quote.price?.value ?? 0,
        transitHours: quote.transit_hours?.value ?? 0,
        arrivalIso: quote.delivery_estimate,
        mode: quote.service_normalised,
      }));

    if (carriers.length === 0) {
      throw new InsufficientDataError(
        `Recommendation ${input.recommendationId} produced no eligible carrier, so there is no ` +
          'logistics axis to build a matrix against. A matrix of sourcing options paired with ' +
          'nothing would report a total cost of intervention-only, presenting a plan that ' +
          'cannot be shipped as if it could. See that recommendation for the per-carrier ' +
          'reasons.',
        { recommendation_id: input.recommendationId },
      );
    }

    return carriers;
  }

  /** Pareto front, weighted objective, and the stored run. */
  private async rank(args: {
    input: RunScenariosInput;
    facts: CascadeFacts;
    scenarios: Scenario[];
    truncation: string | null;
    now: Date;
  }): Promise<ScenarioRunRecord> {
    const { facts, input, scenarios } = args;
    const weights = { ...OBJECTIVE_WEIGHTS, ...args.input.weights };

    const front = paretoFront(
      scenarios.map((one) => ({
        scenarioId: one.id,
        label: one.label,
        expectedShortage: one.outcome.expectedShortage.value,
        totalCostInr: one.outcome.totalCostInr,
      })),
    );

    const scored = scoreObjective(
      scenarios.map((one) => ({
        scenarioId: one.id,
        expectedShortage: one.outcome.expectedShortage.value,
        totalCostInr: one.outcome.totalCostInr,
        recoveryDays: one.outcome.recoveryDays.value,
        criticalityWeightedImpact: one.outcome.criticalityWeightedImpact.value,
        // Zero when the lane's distance is unknown, which is honest here: the
        // term contributes nothing rather than a guess, and the scenario's own
        // `unavailable` list names the field and says why.
        co2Kg: one.outcome.co2Kg?.value ?? 0,
      })),
      weights,
    );

    const chosen = chooseScenario(scored);
    const baseline = scenarios.find((one) => one.isBaseline);
    if (chosen === null || baseline === undefined) {
      throw new InsufficientDataError(
        'The scenario matrix produced no ranking, which means enumeration failed rather than ' +
          'that every option was equally good. The baseline is always one of the candidates, ' +
          'so its absence is a bug and not an empty result.',
        { cascade_id: facts.cascadeId },
      );
    }

    const chosenScenario = scenarios.find((one) => one.id === chosen.scenarioId) ?? baseline;

    return this.repository.save(input.orgId, {
      ...this.runMetadata(args, scenarios.length),
      scenarios,
      baselineScenarioId: baseline.id,
      chosenScenarioId: chosen.scenarioId,
      weights,
      objectiveValues: scored,
      paretoFront: front,
      deltaVsBaseline: deltaVsBaseline(chosenScenario, baseline),
    });
  }

  /**
   * The run's identity, solver record and provenance.
   *
   * `solver` is EXHAUSTIVE_ENUMERATION and `solverStatus` says why that is
   * exact rather than approximate — so a future switch to CP-SAT is visible in
   * the record instead of being a silent change of method.
   */
  private runMetadata(
    args: { input: RunScenariosInput; facts: CascadeFacts; truncation: string | null; now: Date },
    scenarioCount: number,
  ) {
    const { facts, input } = args;

    return {
      cascadeId: facts.cascadeId,
      drugId: facts.drugId,
      drugLabel: facts.drugLabel,
      solver: 'EXHAUSTIVE_ENUMERATION' as const,
      solverStatus:
        `Enumerated all ${String(scenarioCount)} scenarios and took the minimum objective ` +
        'value. Exact for a matrix of this size — the cap is 50 rows — so there is no ' +
        'optimality gap to report.',
      truncation: args.truncation,
      narrative: null,
      narrativeLlmModel: null,
      provenance: {
        source_name: 'Vitalink scenario engine',
        source_url: `/api/v1/scenarios/${facts.cascadeId}`,
        query: null,
        fetched_at: args.now.toISOString(),
        calculation_method:
          `Joint (sourcing x logistics) matrix over ${String(input.sourcing.length)} sourcing ` +
          'option(s) and the eligible carrier quotes from recommendation ' +
          `${input.recommendationId}. Ranked by the weighted objective; the Pareto front is ` +
          'reported separately because it needs no weights and involves no opinion.',
      },
    };
  }

  async get(orgId: string, id: string): Promise<ScenarioRunRecord | null> {
    return this.repository.findById(orgId, id);
  }

  async listRecent(orgId: string, limit: number): Promise<ScenarioRunRecord[]> {
    return this.repository.listRecent(orgId, Math.min(limit, MAX_PAGE_SIZE));
  }

  /**
   * The urgency profile in force, so the scenario view can show which weighting
   * the logistics half of every row was scored under.
   */
  profileFor(
    urgency: keyof typeof WEIGHT_PROFILES,
  ): (typeof WEIGHT_PROFILES)[keyof typeof WEIGHT_PROFILES] {
    return WEIGHT_PROFILES[urgency];
  }
}
