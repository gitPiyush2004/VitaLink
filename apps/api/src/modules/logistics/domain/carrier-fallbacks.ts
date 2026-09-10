/**
 * Small pure helpers the service needs, kept out of it so it stays about I/O.
 */

import type { CarrierCapabilities, CarrierQuote } from '@vitalink/contracts';

import type { DrugEntity } from '@modules/catalog';

import type { DrugContext } from './shipment-derivation';

/**
 * The subset of a drug record the shipment derivation reads.
 *
 * `category` falls back to the dosage form because openFDA states a dosage form
 * and no therapeutic category; ATC ingestion would supply the real one. Calling
 * a tablet's category "tablet" is imprecise but true, where inventing
 * "anticoagulant" would not be.
 */
export function toDrugContext(drug: DrugEntity): DrugContext {
  return {
    drugId: drug.id,
    genericName: drug.genericName,
    category: drug.dosageForm ?? 'unclassified',
    nlemCritical: drug.nlemCritical,
    temperatureRequirement: drug.temperatureRequirement,
    storageParseReason: drug.storageParseReason,
    coldChain: drug.coldChain,
    prohibitedTemperatureRanges: drug.prohibitedTemperatureRanges,
  };
}

/**
 * The cover band at day zero.
 *
 * Read from the projection's first point rather than re-derived: `coverLow[0]`
 * *is* the low edge of the band, by construction in `projectCover`. Re-applying
 * the band width here would put the same arithmetic in two files, and the two
 * would eventually disagree.
 */
export function coverBandOf(exposed: {
  coverProjection: { coverLow: number[]; coverHigh: number[] };
}): { low: number; high: number } | null {
  const low = exposed.coverProjection.coverLow[0];
  const high = exposed.coverProjection.coverHigh[0];
  return low === undefined || high === undefined ? null : { low, high };
}

/**
 * Capabilities for a carrier whose documentation could not be read.
 *
 * Everything `'unknown'`, which **fails** any constraint requiring it. That is
 * the conservative direction: a lookup failure should eliminate a carrier with a
 * stated reason, never quietly admit one whose handling nobody verified.
 */
export function unknownCapabilities(quote: CarrierQuote): CarrierCapabilities {
  return {
    modes: [],
    temperature_ranges: [],
    cold_chain_certified: 'unknown',
    gdp_compliant: 'unknown',
    dangerous_goods: 'unknown',
    customs_brokerage: 'unknown',
    temperature_monitoring: 'unknown',
    serves_lanes: [],
    tracking_granularity: 'none',
    provenance: {
      source_name: quote.provider_display,
      source_url: quote.provenance.source_url,
      query: null,
      fetched_at: quote.retrieved_at,
      calculation_method:
        "This carrier's documented capabilities could not be read, so every claim is " +
        "'unknown'. Any constraint that requires a capability therefore fails, which " +
        'eliminates the carrier with a stated reason rather than admitting it unverified.',
    },
  };
}
