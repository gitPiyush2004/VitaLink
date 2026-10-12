/**
 * Every closed vocabulary in the system, in one file.
 *
 * These live in `contracts` rather than in the modules that use them because
 * the React app, the Node API, the workers and (mirrored) the Python service all
 * have to agree on the exact strings. One list, one source of truth.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Identity and access (PART 8)
// ---------------------------------------------------------------------------

/** Six roles because six genuinely distinct workflows exist. */
export const ROLES = [
  'ADMINISTRATOR',
  'SUPPLY_CHAIN_MANAGER',
  'PROCUREMENT_MANAGER',
  'LOGISTICS_MANAGER',
  'REGULATORY_QA',
  'ANALYST_VIEWER',
] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Route-level permissions. The matrix that maps roles to these lives in one file. */
export const SCOPES = [
  'catalog:read',
  'graph:read',
  'signals:read',
  'alerts:read',
  'quarantine:read',
  'cascade:read',
  'cascade:run',
  'reliability:read',
  'scenarios:read',
  'scenarios:run',
  'recommendations:read',
  'recommendations:issue',
  'logistics:read',
  'logistics:quote',
  'logistics:recommend',
  'cases:read',
  'cases:write',
  'webhooks:read',
  'webhooks:write',
  'eval:read',
  'eval:run',
  'admin:all',
] as const;
export const scopeSchema = z.enum(SCOPES);
export type Scope = z.infer<typeof scopeSchema>;

// ---------------------------------------------------------------------------
// Graph (PART 3, stage 3)
// ---------------------------------------------------------------------------

export const NODE_TYPES = [
  'country',
  'ingredient',
  'manufacturer',
  'facility',
  'drug',
  'hub',
  'lane',
  'healthcare_facility',
  'district',
] as const;
export const nodeTypeSchema = z.enum(NODE_TYPES);
export type NodeType = z.infer<typeof nodeTypeSchema>;

export const EDGE_RELATIONS = [
  'SOURCED_FROM',
  'CONTAINED_IN',
  'MADE_BY',
  'OPERATES',
  'STOCKED_AT',
  'SHIPS_VIA',
  'DELIVERS_TO',
  'SERVES',
] as const;
export const edgeRelationSchema = z.enum(EDGE_RELATIONS);
export type EdgeRelation = z.infer<typeof edgeRelationSchema>;

// ---------------------------------------------------------------------------
// Signals and alerts (stages 1-2)
// ---------------------------------------------------------------------------

export const SIGNAL_SOURCES = [
  'openfda_enforcement',
  'openfda_shortages',
  'openfda_ndc',
  'openfda_label',
  'openfda_drugsfda',
  'dailymed_spl',
  'cdsco_alerts',
  'gdelt_doc',
  'un_comtrade',
  'nppa_dpco',
  'open_meteo',
  'usgs_fdsnws',
  'osm_overpass',
  'data_gov_in',
  'who_eml',
  'nominatim',
  'osrm',
] as const;
export const signalSourceSchema = z.enum(SIGNAL_SOURCES);
export type SignalSource = z.infer<typeof signalSourceSchema>;

/** What kind of disruption an alert describes. Assigned by the LLM (a category, not a number). */
export const DISRUPTION_CATEGORIES = [
  'RECALL',
  'SHORTAGE',
  'PLANT_SHUTDOWN',
  'REGULATORY_ACTION',
  'QUALITY_FAILURE',
  'RAW_MATERIAL_DISRUPTION',
  'EXPORT_RESTRICTION',
  'LOGISTICS_DISRUPTION',
  'NATURAL_HAZARD',
  'LABOUR_ACTION',
  'CYBER_INCIDENT',
  'OTHER',
] as const;
export const disruptionCategorySchema = z.enum(DISRUPTION_CATEGORIES);
export type DisruptionCategory = z.infer<typeof disruptionCategorySchema>;

/** Which VERIFY implementation produced an alert. The ablation in PART 11 needs this. */
export const VERIFICATION_ARMS = ['CORROBORATING_AGENT', 'SINGLE_CALL_BASELINE'] as const;
export const verificationArmSchema = z.enum(VERIFICATION_ARMS);
export type VerificationArm = z.infer<typeof verificationArmSchema>;

/** Why a signal never became an alert. Shown in the Quarantine view. */
export const QUARANTINE_REASONS = [
  'insufficient_independent_sources',
  'below_veracity_threshold',
  'not_pharma_relevant',
  'no_entity_resolved',
  'extraction_failed',
] as const;
export const quarantineReasonSchema = z.enum(QUARANTINE_REASONS);
export type QuarantineReason = z.infer<typeof quarantineReasonSchema>;

// ---------------------------------------------------------------------------
// Logistics (PART 6)
// ---------------------------------------------------------------------------

export const CARRIER_IDS = ['dsv', 'fedex', 'ups', 'dhl', 'kuehne_nagel', 'ceva', 'mock'] as const;
export const carrierIdSchema = z.enum(CARRIER_IDS);
export type CarrierId = z.infer<typeof carrierIdSchema>;

/**
 * Integration depth, from the audit in docs/CARRIER_STATUS.md.
 *   A = documented self-serve quotation API
 *   B = partially self-serve; some products account-gated
 *   C = no public self-serve API; sandbox only
 */
export const CARRIER_TIERS = ['A', 'B', 'C'] as const;
export const carrierTierSchema = z.enum(CARRIER_TIERS);
export type CarrierTier = z.infer<typeof carrierTierSchema>;

/** Rule 4. The status is never separable from the price. */
export const QUOTE_STATUSES = [
  'LIVE_QUOTE',
  'SANDBOX_QUOTE',
  'CONTRACT_RATE',
  'ESTIMATED',
  'UNAVAILABLE',
] as const;
export const quoteStatusSchema = z.enum(QUOTE_STATUSES);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

/** An UNAVAILABLE carrier is shown with one of these. It is never silently dropped. */
export const UNAVAILABLE_REASONS = [
  'api_timeout',
  'no_credentials',
  'auth_failed',
  'route_not_served',
  'rate_limited',
  'invalid_request',
  'not_publicly_available',
  'circuit_open',
  'upstream_error',
] as const;
export const unavailableReasonSchema = z.enum(UNAVAILABLE_REASONS);
export type UnavailableReason = z.infer<typeof unavailableReasonSchema>;

export const TRANSPORT_MODES = ['air', 'road', 'sea', 'rail', 'express'] as const;
export const transportModeSchema = z.enum(TRANSPORT_MODES);
export type TransportMode = z.infer<typeof transportModeSchema>;

export const NORMALISED_SERVICES = ['express', 'air', 'road', 'sea', 'rail', 'multimodal'] as const;
export const normalisedServiceSchema = z.enum(NORMALISED_SERVICES);
export type NormalisedService = z.infer<typeof normalisedServiceSchema>;

/** Read from the drug's real openFDA label storage section, never asked of the user. */
export const TEMPERATURE_RANGES = ['2-8C', '15-25C', 'frozen', 'ambient', 'cryogenic'] as const;
export const temperatureRangeSchema = z.enum(TEMPERATURE_RANGES);
export type TemperatureRange = z.infer<typeof temperatureRangeSchema>;

export const SPECIAL_HANDLING = [
  'cold_chain',
  'temperature_monitoring',
  'gdp',
  'controlled_substance',
  'fragile',
  'light_sensitive',
] as const;
export const specialHandlingSchema = z.enum(SPECIAL_HANDLING);
export type SpecialHandling = z.infer<typeof specialHandlingSchema>;

export const URGENCY_LEVELS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export const urgencySchema = z.enum(URGENCY_LEVELS);
export type Urgency = z.infer<typeof urgencySchema>;

export const TRACKING_GRANULARITIES = ['none', 'milestone', 'event', 'realtime'] as const;
export const trackingGranularitySchema = z.enum(TRACKING_GRANULARITIES);
export type TrackingGranularity = z.infer<typeof trackingGranularitySchema>;

/**
 * The nine hard-constraint failures from spec 6.6.
 * A carrier that fails any of these is NOT ELIGIBLE and carries no score.
 */
export const INELIGIBILITY_REASONS = [
  'deadline_miss',
  'temperature_unsupported',
  'route_not_served',
  'handling_unsupported',
  'dg_unsupported',
  'customs_unsupported',
  'quote_unavailable',
  'over_budget',
  'mode_excluded',
] as const;
export const ineligibilityReasonSchema = z.enum(INELIGIBILITY_REASONS);
export type IneligibilityReason = z.infer<typeof ineligibilityReasonSchema>;

/**
 * A tri-state used for every carrier capability.
 * `'unknown'` is an honest value; a guessed `true` is not. See spec 6.3.
 */
export const capabilityFlagSchema = z.union([z.boolean(), z.literal('unknown')]);
export type CapabilityFlag = z.infer<typeof capabilityFlagSchema>;
