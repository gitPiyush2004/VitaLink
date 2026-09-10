/**
 * Typed reads of the API, one function per endpoint.
 *
 * The response types are declared here rather than imported from the API's
 * internal record types, and that is deliberate: the API's `ScenarioRunRecord`
 * is an internal shape, and importing it would couple the browser to a server
 * refactor. What the browser depends on is the *wire* shape, which is what these
 * types describe.
 *
 * Where a shape is a contract — `Quantity`, `CarrierQuote` — it comes from
 * `@vitalink/contracts`, because that package exists precisely so the two ends
 * agree on it.
 */

import type { CarrierQuote, Quantity } from '@vitalink/contracts';

import { request } from './client';

// ---------------------------------------------------------------------------
// SENSE and VERIFY
// ---------------------------------------------------------------------------

export type SignalRow = {
  id: string;
  source: string;
  publishedAt: string;
  title: string;
  url: string;
  domain: string | null;
  category: string;
  manufacturer: string | null;
  drugOrIngredient: string | null;
  severity: number;
  insight: string;
  isPharmaSupplyRelevant: boolean;
  /** STRUCTURED_FIELD, KEYWORD or LLM. Shown on the row. */
  extractionMethod: string;
  severityBasis: string;
  extractionBasis: string;
};

export type AlertRow = {
  id: string;
  category: string;
  manufacturer: string | null;
  drugOrIngredient: string | null;
  severity: number;
  insight: string;
  resolvedNodeId: string | null;
  resolutionBasis: string;
  independentSourceCount: number;
  veracity: Quantity;
  verified: boolean;
  clusterBasis: string;
  firstSeenAt: string;
  corroborations: { url: string; independence_key: string; query: string }[];
};

export type QuarantineRow = {
  id: string;
  reason: string;
  detail: string;
  independentSourceCount: number;
  veracity: Quantity;
  createdAt: string;
  extraction: { insight: string; category: string; severity_1_5: number } | null;
};

export const listSignals = (limit = 40): Promise<SignalRow[]> =>
  request<SignalRow[]>(`/signals?limit=${String(limit)}`);

export const listAlerts = (limit = 20): Promise<AlertRow[]> =>
  request<AlertRow[]>(`/signals/alerts?limit=${String(limit)}`);

export const listQuarantine = (limit = 30): Promise<QuarantineRow[]> =>
  request<QuarantineRow[]>(`/signals/quarantine?limit=${String(limit)}`);

export const quarantineSummary = (): Promise<Record<string, number>> =>
  request<Record<string, number>>('/signals/quarantine/summary');

export type IngestOutcome = {
  perSource: { source: string; fetched: number; stored: number; skipped: string[] }[];
  signalsStored: number;
  sourceFailures: { source: string; error: string }[];
};

export const runIngest = (): Promise<IngestOutcome> =>
  request<IngestOutcome>('/signals/ingest', { method: 'POST' });

export type VerifyOutcome = {
  clustersConsidered: number;
  alertsPublished: number;
  quarantined: number;
  byQuarantineReason: Record<string, number>;
  corroborationRate: string;
  corroborationBudget: { limit: number; used: number; notAttempted: number; note: string };
};

export const runVerify = (): Promise<VerifyOutcome> =>
  request<VerifyOutcome>('/signals/verify', { method: 'POST' });

// ---------------------------------------------------------------------------
// MAP and TRACE
// ---------------------------------------------------------------------------

export type DrugRow = {
  id: string;
  genericName: string;
  temperatureRequirement: string | null;
  storageParseReason: string | null;
  prohibitedTemperatureRanges: string[];
  coldChain: boolean;
  isSingleSource: boolean;
  apiTierVisibility: string;
  zApi: Quantity | null;
  zPlant: Quantity | null;
  hhiManufacturers: Quantity | null;
  rawLabelerCount: Quantity | null;
  labelerCountWasTruncated: boolean;
};

export const listDrugs = (limit = 50): Promise<DrugRow[]> =>
  request<DrugRow[]>(`/catalog/drugs?limit=${String(limit)}`);

export type ExposedDrug = {
  drugId: string;
  label: string;
  exposureQuantity: Quantity;
  coverBandDays: Quantity;
  coverProjection: {
    days: number[];
    coverLow: number[];
    coverHigh: number[];
    stockoutDayBand: { low: number; high: number } | null;
    assumptions: Record<string, unknown>;
    calculationMethod: string;
  };
  propagationPaths: {
    hops: { fromLabel: string; toLabel: string; rel: string; weight: number }[];
    pathWeight: number;
    length: number;
  }[];
};

export type CascadeRow = {
  id: string;
  status: string;
  request: {
    shockNodeId: string;
    alertId: string | null;
    durationDays: number;
    decay: number;
    maxDepth: number;
    assumedCoverDays: number;
  };
  exposedDrugs: ExposedDrug[];
  touchedNodeIds: string[];
  traversalNotes: {
    pathsPrunedByWeight: number;
    pathsPrunedByCap: number;
    graphWasTruncated: boolean;
    droppedEdges: number;
  };
  startedAt: string;
};

export const listCascades = (limit = 10): Promise<CascadeRow[]> =>
  request<CascadeRow[]>(`/cascade?limit=${String(limit)}`);

export const getCascade = (id: string): Promise<CascadeRow> =>
  request<CascadeRow>(`/cascade/${encodeURIComponent(id)}`);

export const runCascade = (body: {
  shock_node_id: string;
  alert_id: string | null;
  duration_days: number;
  assumed_cover_days: number;
}): Promise<CascadeRow> => request<CascadeRow>('/cascade/run', { method: 'POST', body });

// ---------------------------------------------------------------------------
// EXECUTE
// ---------------------------------------------------------------------------

export type SubScoreRow = {
  key: string;
  value: number;
  weight: number;
  contribution: number;
  inputs: Record<string, unknown>;
  neutralFallbackReason: string | null;
};

export type RecommendationRow = {
  id: string;
  shipmentRequestId: string;
  recommendedQuoteId: string | null;
  weightProfile: { name: string; weights: Record<string, number>; selectedBecause: string };
  quotes: CarrierQuote[];
  coverageNote: string;
  createdAt: string;
  recommendation: {
    profile: { name: string; rationale: string };
    eligibility: {
      quoteId: string;
      carrierId: string;
      result: { isEligible: boolean; failures: { reason: string; detail: string }[] };
    }[];
    scored: {
      quoteId: string;
      carrierDisplay: string;
      service: string;
      subScores: SubScoreRow[];
      weightedScore: number;
      preferenceBonus: number;
      preferenceNote: string | null;
      finalScore: number;
    }[];
    counterfactual: {
      runnerUpDisplay: string;
      priceDeltaInr: number;
      transitDeltaHours: number;
      verdict: string;
    } | null;
    carriersAttempted: number;
    carriersQuoted: number;
  };
};

export const listRecommendations = (limit = 10): Promise<RecommendationRow[]> =>
  request<RecommendationRow[]>(`/logistics/recommendations?limit=${String(limit)}`);

export const getRecommendation = (id: string): Promise<RecommendationRow> =>
  request<RecommendationRow>(`/logistics/recommendations/${encodeURIComponent(id)}`);

export type ShipmentRow = {
  request: {
    id: string;
    product: { name: string };
    origin: { city: string; country: string };
    destination: { city: string; country: string };
    temperature_requirement: string;
    required_delivery_deadline: string;
    urgency: string;
    special_handling: string[];
    customs_required: boolean;
    weight_kg: Quantity;
    volume_m3: Quantity;
  };
  prohibitedRanges: string[];
  /** Every step of the derivation. The "zero manual input" claim, in words. */
  derivation: string[];
};

export const listShipments = (limit = 10): Promise<ShipmentRow[]> =>
  request<ShipmentRow[]>(`/logistics/shipments?limit=${String(limit)}`);

export type CarrierRow = {
  id: string;
  displayName: string;
  tier: string;
  isConfigured: boolean;
  integrationNote: string;
  capabilities: {
    temperature_ranges: string[];
    cold_chain_certified: boolean | 'unknown';
    gdp_compliant: boolean | 'unknown';
    dangerous_goods: boolean | 'unknown';
    customs_brokerage: boolean | 'unknown';
    tracking_granularity: string;
  } | null;
  capabilityError: string | null;
};

export const listCarriers = (): Promise<CarrierRow[]> =>
  request<CarrierRow[]>('/logistics/carriers');

export const recommendFromCascade = (
  body: unknown,
): Promise<{
  shipment: ShipmentRow;
  recommendation: RecommendationRow;
}> =>
  request<{ shipment: ShipmentRow; recommendation: RecommendationRow }>(
    '/logistics/recommendations',
    { method: 'POST', body },
  );

// ---------------------------------------------------------------------------
// SIMULATE and DECIDE
// ---------------------------------------------------------------------------

export type ScenarioRow = {
  id: string;
  label: string;
  isBaseline: boolean;
  sourcing: { kind: string; label: string; interventionCostInr: number };
  logistics: { carrierDisplay: string; service: string; quoteStatus: string } | null;
  outcome: {
    expectedShortage: Quantity;
    fragilityIndex: Quantity;
    daysOfCoverBand: Quantity;
    recoveryDays: Quantity;
    logisticsCostInr: Quantity | null;
    co2Kg: Quantity | null;
    deadlineMet: boolean | null;
    quoteStatusWorst: string | null;
    totalCostInr: number;
    unavailable: { field: string; reason: string }[];
  };
};

export type ScenarioRunRow = {
  id: string;
  cascadeId: string;
  drugId: string;
  drugLabel: string;
  scenarios: ScenarioRow[];
  baselineScenarioId: string;
  chosenScenarioId: string;
  weights: Record<string, number>;
  objectiveValues: {
    scenarioId: string;
    value: number;
    breakdown: {
      term: string;
      raw: number;
      normalised: number;
      weight: number;
      contribution: number;
    }[];
  }[];
  paretoFront: {
    scenarioId: string;
    label: string;
    expectedShortage: number;
    totalCostInr: number;
    isDominated: boolean;
    dominatedBy: string | null;
  }[];
  deltaVsBaseline: Record<string, number>;
  solver: string;
  solverStatus: string;
  truncation: string | null;
  createdAt: string;
};

export const listScenarioRuns = (limit = 10): Promise<ScenarioRunRow[]> =>
  request<ScenarioRunRow[]>(`/scenarios?limit=${String(limit)}`);

export const getScenarioRun = (id: string): Promise<ScenarioRunRow> =>
  request<ScenarioRunRow>(`/scenarios/${encodeURIComponent(id)}`);

export const runScenarios = (body: unknown): Promise<ScenarioRunRow> =>
  request<ScenarioRunRow>('/scenarios', { method: 'POST', body });
