/**
 * Deriving a shipment request from a cascade (spec 6.5).
 *
 * The gate for this phase is "a cascade produces a shipment with **zero manual
 * input**", and this file is where that claim is either true or not. So it is
 * worth being exact about what "zero manual input" means here, because a claim
 * that overstated itself would be worse than a documented limitation.
 *
 * ## What is genuinely derived, and from what
 *
 *  - `temperature_requirement` — parsed from the drug's own openFDA label. REAL.
 *    This is the field the spec cares most about, because it is the one an
 *    operator would otherwise guess, and guessing it wrong eliminates the right
 *    carrier or selects the wrong one.
 *  - `prohibited ranges` — also from the label. Cisplatin's "Do not refrigerate".
 *  - `special_handling` — `cold_chain` when the label says 2-8 °C, `gdp` always,
 *    because this is a pharmaceutical shipment and GDP is not optional.
 *  - `required_delivery_deadline` — from the cascade's cover band, minus a
 *    receiving-and-QC margin. DERIVED.
 *  - `urgency` — from the same cover band plus alert severity. DERIVED.
 *  - `customs_required` — origin country against destination country.
 *  - `context` — the cascade and disruption ids, so the shipment always knows
 *    which disruption it exists to answer.
 *
 * ## What cannot be derived, and is therefore required of the caller
 *
 * **Geography.** The physical layer — hubs, geocoded facilities, lanes — is not
 * ingested in the MVP, so there is no way to look up "the nearest alternative
 * supplier's plant" or "the coordinates of the Mumbai hub". Origin and
 * destination are required inputs.
 *
 * **Mass and volume.** No public source states how much of a drug a facility
 * needs. The quantities are therefore SCENARIO values with the operator's own
 * consignment size on them, and the derivation refuses to invent a default —
 * because a weight is what a carrier prices, and a made-up weight would produce
 * a made-up price that looked exactly like a real one.
 *
 * So: every *pharmaceutical* constraint is derived and none of them is asked of
 * the user, which is the part that matters and the part the spec's example
 * highlights. The geography and the consignment size are inputs, and this
 * comment says so rather than letting a demo imply otherwise.
 */

import {
  derived,
  scenario,
  type Place,
  type Provenance,
  type ShipmentRequest,
  type SpecialHandling,
  type TemperatureRange,
  type Urgency,
} from '@vitalink/contracts';

import { AIR_VOLUMETRIC_DIVISOR_KG_PER_M3 } from '@config/constants';
import { InsufficientDataError } from '@shared/errors';

import { deriveDeadline, deriveUrgency, type UrgencyDecision } from './urgency';

const CM_PER_M = 100;
const DIMENSIONS = 3;
const CUBIC_CM_PER_CUBIC_M = CM_PER_M ** DIMENSIONS;
/** Volume is quoted in cubic metres, where three decimals is a litre. */
const VOLUME_DECIMALS = 3;

/** What the cascade contributes. Read from the stored cascade record. */
export type CascadeContext = {
  cascadeId: string;
  alertId: string | null;
  drugId: string;
  /** The cover band the cascade projected for this drug at this shock. */
  coverDaysBand: { low: number; high: number } | null;
  /** Severity of the alert that triggered the cascade, when there was one. */
  alertSeverity: number | null;
};

/** What the drug catalogue contributes. All of it from the openFDA label. */
export type DrugContext = {
  drugId: string;
  genericName: string;
  category: string;
  nlemCritical: boolean;
  temperatureRequirement: TemperatureRange | null;
  storageParseReason: string | null;
  coldChain: boolean;
  prohibitedTemperatureRanges: TemperatureRange[];
};

/**
 * What the operator must supply, because no source states it.
 *
 * Deliberately has no defaults. See the note at the top of the file.
 */
export type ConsignmentInput = {
  origin: Place;
  destination: Place;
  hubIdDestination: string;
  /** The consignment's gross weight. SCENARIO: the operator knows it. */
  weightKg: number;
  dimensionsCm: { l: number; w: number; h: number }[];
  numberOfPackages: number;
  /** People served by the affected facilities, when the operator knows it. */
  affectedPopulation: number | null;
  budgetCeilingInr: number | null;
};

export type DeriveShipmentInput = {
  shipmentId: string;
  cascade: CascadeContext;
  drug: DrugContext;
  consignment: ConsignmentInput;
  now: Date;
};

export type DerivedShipment = {
  request: ShipmentRequest;
  /** Ranges the label forbids. Passed straight to the eligibility gate. */
  prohibitedRanges: TemperatureRange[];
  urgency: UrgencyDecision;
  /** Every derivation step, in order, for the "why these constraints" panel. */
  derivation: string[];
};

/**
 * Volume from the stated package dimensions.
 *
 * DERIVED, not SCENARIO, because it is arithmetic on numbers the operator gave:
 * the *dimensions* are their assumption, the multiplication is ours.
 */
function volumeM3(dimensions: ConsignmentInput['dimensionsCm']): number {
  return dimensions.reduce((sum, box) => sum + (box.l * box.w * box.h) / CUBIC_CM_PER_CUBIC_M, 0);
}

/**
 * What the operator's consignment figures mean for the price.
 *
 * Air freight prices on the greater of gross and volumetric weight, so an
 * operator who states a light but bulky consignment should see *why* the quote
 * came back higher than the kilos suggest.
 */
function explainConsignment(weightKg: number, volume: number): string {
  const chargeableKg = volume * AIR_VOLUMETRIC_DIVISOR_KG_PER_M3;
  return (
    `Gross weight ${weightKg.toFixed(1)} kg and volume ` +
    `${volume.toFixed(VOLUME_DECIMALS)} m3 are the operator's consignment figures — no public ` +
    'source states how much of a drug a facility needs. At the ' +
    `1:${String(AIR_VOLUMETRIC_DIVISOR_KG_PER_M3)} air volumetric divisor the volumetric ` +
    `weight is ${chargeableKg.toFixed(1)} kg, so the carrier will price on ` +
    `${Math.max(weightKg, chargeableKg).toFixed(1)} kg.`
  );
}

/**
 * The special handling this drug requires, from its label.
 *
 * `gdp` is unconditional. Every shipment this system plans is a pharmaceutical
 * shipment, and Good Distribution Practice is the baseline for one — which has a
 * real consequence at the gate, since a carrier that does not document GDP
 * compliance is eliminated rather than merely scored lower. That is the intended
 * behaviour: it is better to report "no carrier documents GDP on this lane" than
 * to quietly ship pharmaceuticals on unverified handling.
 */
function specialHandlingFor(drug: DrugContext): SpecialHandling[] {
  const handling: SpecialHandling[] = ['gdp'];
  if (drug.coldChain) handling.push('cold_chain', 'temperature_monitoring');
  return handling;
}

/** What the label decided, in the operator's terms. */
function explainLabelConstraints(drug: DrugContext, handling: SpecialHandling[]): string[] {
  const lines = [
    `Temperature requirement ${String(drug.temperatureRequirement)} was parsed from the drug's ` +
      `own openFDA label, not asked of the operator. Special handling ${handling.join(', ')} ` +
      'follows from it, and GDP is unconditional for a pharmaceutical shipment.',
  ];

  if (drug.prohibitedTemperatureRanges.length > 0) {
    lines.push(
      `The label FORBIDS ${drug.prohibitedTemperatureRanges.join(', ')}, which eliminates any ` +
        'carrier whose only service is one of those.',
    );
  }

  return lines;
}

/** Whether the lane crosses a customs border, and what that costs the operator. */
function explainLane(consignment: ConsignmentInput, customsRequired: boolean): string {
  const lane = `${consignment.origin.country}-${consignment.destination.country}`;
  return customsRequired
    ? `Lane ${lane} crosses a customs border, so customs brokerage becomes a hard constraint.`
    : `Lane ${lane} is domestic, so customs brokerage is not required.`;
}

/** The provenance every derived field on the request inherits. */
type DerivationSource = { name: string; url: string; query: null; fetchedAt: string };

/**
 * The three quantity envelopes on a shipment.
 *
 * Grouped here because the tagging decision is the interesting part and it reads
 * better in one place than scattered through a 70-line object literal.
 */
function buildQuantities(
  consignment: ConsignmentInput,
  volume: number,
  source: DerivationSource,
): Pick<ShipmentRequest, 'weight_kg' | 'volume_m3' | 'budget_ceiling_inr'> {
  return {
    // SCENARIO, not DERIVED: no public source states how much of a drug a
    // facility needs, so this is an operator assumption and not a measurement.
    weight_kg: scenario({
      value: consignment.weightKg,
      unit: 'kg',
      setBy: 'operator consignment gross weight',
      at: source.fetchedAt,
    }),
    volume_m3: derived({
      value: volume,
      unit: 'm3',
      source,
      method:
        'Sum of l*w*h over the stated package dimensions, converted from cubic centimetres. ' +
        "DERIVED rather than SCENARIO because the dimensions are the operator's assumption " +
        'and only the arithmetic is ours.',
    }),
    budget_ceiling_inr:
      consignment.budgetCeilingInr === null
        ? null
        : // A quote above it is reported NOT ELIGIBLE with the reason, never
          // merely scored lower. See the gate's rule 8.
          scenario({
            value: consignment.budgetCeilingInr,
            unit: 'INR',
            setBy: 'operator budget ceiling',
            at: source.fetchedAt,
          }),
  };
}

/** What `buildRequest` needs that is not already on `DeriveShipmentInput`. */
type ResolvedConstraints = {
  handling: SpecialHandling[];
  customsRequired: boolean;
  volume: number;
  temperatureRequirement: TemperatureRange;
  deadlineIso: string;
  urgency: Urgency;
  source: DerivationSource;
  provenance: Provenance;
};

/** Assembles the request from the constraints already derived. */
function buildRequest(input: DeriveShipmentInput, resolved: ResolvedConstraints): ShipmentRequest {
  const { cascade, consignment, drug } = input;

  return {
    id: input.shipmentId,
    // Never null on a cascade-derived shipment: it always knows which disruption
    // it exists to answer. That is what makes this a supply-chain tool rather
    // than a courier comparison page.
    context: {
      disruption_id: cascade.alertId,
      cascade_id: cascade.cascadeId,
      drug_id: drug.drugId,
      hub_id_destination: consignment.hubIdDestination,
      triggered_by: 'cascade',
    },
    origin: consignment.origin,
    destination: consignment.destination,
    product: {
      drug_id: drug.drugId,
      name: drug.genericName,
      category: drug.category,
      nlem_critical: drug.nlemCritical,
    },
    ...buildQuantities(consignment, resolved.volume, resolved.source),
    dimensions_cm: consignment.dimensionsCm,
    number_of_packages: consignment.numberOfPackages,
    temperature_requirement: resolved.temperatureRequirement,
    required_delivery_deadline: resolved.deadlineIso,
    // 'any' rather than a guess. Narrowing the modes would silently eliminate
    // carriers on a preference the operator never expressed.
    shipping_mode_preference: 'any',
    special_handling: resolved.handling,
    // No public source states whether a given drug ships as dangerous goods, and
    // declaring it true would eliminate every carrier that does not document DG
    // handling. False with the gap recorded is the honest default.
    hazardous_material: false,
    customs_required: resolved.customsRequired,
    urgency: resolved.urgency,
    created_at: input.now.toISOString(),
    provenance: resolved.provenance,
  };
}

/**
 * The temperature requirement, or a hard stop.
 *
 * A shipment with a guessed temperature would run the eligibility gate against a
 * fiction, and the gate is the part of this system that is meant to be
 * trustworthy. The error names the parse reason so an operator can see what the
 * label actually said.
 */
function requireTemperature(drug: DrugContext): TemperatureRange {
  if (drug.temperatureRequirement !== null) return drug.temperatureRequirement;

  throw new InsufficientDataError(
    `No temperature requirement could be read from ${drug.genericName}'s label, so a shipment ` +
      'cannot be planned for it. Supply one as a SCENARIO value first. Label parse result: ' +
      `${drug.storageParseReason ?? 'no storage section was found'}`,
    { drug_id: drug.drugId },
  );
}

/** The deadline implied by the cover band, or a hard stop. */
function requireDeadline(
  cascade: CascadeContext,
  drug: DrugContext,
  now: Date,
): { deadlineIso: string; derivation: string } {
  const deadline = deriveDeadline(cascade.coverDaysBand, now);
  if (deadline !== null) return deadline;

  throw new InsufficientDataError(
    `The cascade projected no cover band for ${drug.genericName}, so no delivery deadline can ` +
      'be derived from it. A deadline must be supplied explicitly, because every hard ' +
      'constraint in the eligibility gate is measured against it.',
    { drug_id: drug.drugId, cascade_id: cascade.cascadeId },
  );
}

/**
 * Turns a cascade plus a drug into a shipment request.
 *
 * @throws InsufficientDataError when the drug's label yielded no temperature
 *   requirement, or the cascade projected no cover band. Both are hard stops
 *   rather than defaults — see `requireTemperature` and `requireDeadline`.
 */
export function deriveShipment(input: DeriveShipmentInput): DerivedShipment {
  const { cascade, consignment, drug } = input;

  const temperatureRequirement = requireTemperature(drug);
  const deadline = requireDeadline(cascade, drug, input.now);

  const at = input.now.toISOString();
  const source: DerivationSource = {
    name: 'Vitalink cascade',
    url: `/api/v1/cascade/${cascade.cascadeId}`,
    query: null,
    fetchedAt: at,
  };

  const urgency = deriveUrgency({
    coverDaysBand: cascade.coverDaysBand,
    alertSeverity: cascade.alertSeverity,
    affectedPopulation: consignment.affectedPopulation,
    isNlemCritical: drug.nlemCritical,
  });

  const handling = specialHandlingFor(drug);
  const customsRequired = consignment.origin.country !== consignment.destination.country;
  const volume = volumeM3(consignment.dimensionsCm);

  const derivation = [
    ...urgency.derivation,
    deadline.derivation,
    ...explainLabelConstraints(drug, handling),
    explainLane(consignment, customsRequired),
    explainConsignment(consignment.weightKg, volume),
  ];

  return {
    request: buildRequest(input, {
      handling,
      customsRequired,
      volume,
      temperatureRequirement,
      deadlineIso: deadline.deadlineIso,
      urgency: urgency.urgency,
      source,
      provenance: {
        source_name: source.name,
        source_url: source.url,
        query: null,
        fetched_at: at,
      },
    }),
    prohibitedRanges: drug.prohibitedTemperatureRanges,
    urgency,
    derivation,
  };
}
