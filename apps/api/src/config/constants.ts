/**
 * Every named constant in the API.
 *
 * ESLint's `no-magic-numbers` rule is an error everywhere except this folder, so
 * any number with meaning has to be named here first. The payoff is that "why is
 * it 8 seconds?" has an answer next to the number instead of in someone's head.
 */

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;
export const DAYS_PER_YEAR = 365.25;

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

export const API_PREFIX = '/api/v1';

/** Body size cap. Generous enough for a scenario matrix, small enough to be safe. */
export const JSON_BODY_LIMIT = '1mb';

/** Webhook bodies are read raw for HMAC, so they get their own tighter cap. */
export const WEBHOOK_BODY_LIMIT = '512kb';

/** How long to let in-flight requests finish on SIGTERM before forcing exit. */
export const SHUTDOWN_GRACE_MS = 10 * MS_PER_SECOND;

/** How long to wait for a Mongo primary before failing a request. */
export const MONGO_SERVER_SELECTION_TIMEOUT_MS = 10 * MS_PER_SECOND;

export const RATE_LIMIT_WINDOW_MS = MS_PER_MINUTE;
export const RATE_LIMIT_MAX_PER_USER = 120;
export const RATE_LIMIT_MAX_PER_ORG = 600;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** bcrypt work factor. 12 is the usual 2020s default: ~250ms on commodity hardware. */
export const PASSWORD_HASH_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 12;

export const REFRESH_COOKIE_NAME = 'vitalink_refresh';
export const OAUTH_STATE_COOKIE_NAME = 'vitalink_oauth_state';
export const OAUTH_VERIFIER_COOKIE_NAME = 'vitalink_oauth_verifier';
/** PKCE state is short-lived by design: it only has to survive one redirect. */
export const OAUTH_STATE_TTL_SECONDS = 10 * SECONDS_PER_MINUTE;

/** Inbound webhook replay window. Anything older is rejected even if the HMAC matches. */
export const WEBHOOK_REPLAY_WINDOW_SECONDS = 5 * SECONDS_PER_MINUTE;

// ---------------------------------------------------------------------------
// VERIFY (stage 2)
// ---------------------------------------------------------------------------

/**
 * How far back VERIFY's clustering window reaches.
 *
 * Thirty days: long enough that a recall and the coverage of it land in the same
 * window even when the press picks it up a fortnight later, short enough that a
 * cluster is one event rather than a quarter's worth of them.
 */
export const CLUSTER_WINDOW_DAYS = 30;

/** Rule from the spec: an alert needs two genuinely independent sources. */
export const MIN_INDEPENDENT_SOURCES = 2;

/** Below this, a cluster is quarantined rather than promoted to an alert. */
export const MIN_VERACITY_TO_PUBLISH = 0.5;

/** Jaccard similarity over text shingles above which two signals are the same story. */
export const DEDUPE_SIMILARITY_THRESHOLD = 0.7;
export const DEDUPE_SHINGLE_SIZE = 5;

/** Veracity decays with age: a three-week-old corroboration is weaker evidence. */
export const VERACITY_RECENCY_HALF_LIFE_DAYS = 14;

// ---------------------------------------------------------------------------
// TRACE (stage 4)
// ---------------------------------------------------------------------------

/** Per-hop attenuation in the exposure sum. Overridable per cascade run. */
export const DEFAULT_CASCADE_DECAY = 0.75;

/** Traversal depth cap. The regulatory-to-physical chain is 7 hops at most. */
export const DEFAULT_CASCADE_MAX_DEPTH = 6;

/** Paths beyond this many per drug are dropped: they contribute ~nothing and cost time. */
export const MAX_PATHS_PER_DRUG = 200;

/** Days of cover below which a facility is treated as heading for stockout. */
export const SAFETY_COVER_DAYS = 7;

/** Horizon for the cover projection curve. */
export const COVER_PROJECTION_DAYS = 90;

/**
 * Inventory is not public anywhere. We model days of cover from published national
 * procurement policy, and report it as a band this wide either side of the policy
 * figure to be honest about the uncertainty.
 */
export const COVER_BAND_RELATIVE_WIDTH = 0.35;

// ---------------------------------------------------------------------------
// QUANTIFY (stage 5)
// ---------------------------------------------------------------------------

/**
 * Tucker & Daskin (arXiv:2107.09167) baseline table, used only where live history
 * is too sparse to fit a rate. Every number that falls back to these is labelled
 * PAPER_BASELINE_FALLBACK on that row, in the UI.
 */
export const PAPER_BASELINE = {
  supplierMtbfYears: 17.3,
  supplierRecoveryYears: 1.2,
  plantMtbfYears: 28.2,
  plantRecoveryYears: 0.8,
  lineMtbfYears: 8.5,
  lineRecoveryYears: 0.08,
} as const;

/** Minimum historical events before we trust a fitted rate over the paper baseline. */
export const MIN_EVENTS_TO_FIT_RATE = 3;

/**
 * Share below which a labeler is treated as long tail.
 *
 * Not used to exclude anyone — HHI already discounts them. It is reported so a
 * reader can see how much of the raw count is relabelers holding one listing
 * each.
 */
export const Z_API_TAIL_SHARE_THRESHOLD = 0.01;

/** Sensitivity half-width used to turn a modelled point into a band. */
export const MODELLED_BAND_RELATIVE_WIDTH = 0.3;

// ---------------------------------------------------------------------------
// Logistics (PART 6)
// ---------------------------------------------------------------------------

/** Per-carrier timeout on the parallel quote fan-out. Spec 6.10. */
export const CARRIER_TIMEOUT_MS = 8 * MS_PER_SECOND;

/** Consecutive failures before the breaker opens for a carrier. */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const CIRCUIT_BREAKER_OPEN_MS = 60 * MS_PER_SECOND;

/**
 * Where a carrier publishes no on-time figure and we have no tracking history,
 * the reliability sub-score contributes at this documented neutral value and the
 * assumption is printed on the row. Spec 6.6.
 */
export const NEUTRAL_SUB_SCORE = 50;

/**
 * How long an archived raw carrier payload is kept.
 *
 * Thirty days: long enough that a recommendation can be audited well after the
 * shipment, short enough that payloads containing account identifiers are not
 * kept indefinitely. A quote older than this keeps its reference and loses its
 * payload, which the archiver's doc comment states plainly.
 */
export const CARRIER_RAW_ARCHIVE_TTL_SECONDS =
  30 * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;

/** Characters of a sha256 hex digest used as a short reference. */
export const HASH_PREFIX_LENGTH = 16;

/** Safety margin subtracted from cover when deriving a delivery deadline. Spec 6.5. */
export const DEADLINE_SAFETY_MARGIN_DAYS = 1;

/** Urgency thresholds, in days of cover. Spec 6.5. */
export const URGENCY_COVER_DAYS = {
  critical: 2,
  high: 5,
  normal: 14,
} as const;

/** Severity at or above which urgency escalates to HIGH regardless of cover. */
export const URGENCY_ESCALATION_SEVERITY = 4;

/** Population above which a critical-drug shipment escalates one urgency level. */
export const URGENCY_ESCALATION_POPULATION = 1_000_000;

/** Volumetric divisor for air freight, kg per cubic metre. Industry standard 1:6. */
export const AIR_VOLUMETRIC_DIVISOR_KG_PER_M3 = 167;

/** Rough emissions factors, tonne-km, for the CO2 term in the objective. */
export const CO2_KG_PER_TONNE_KM = {
  air: 0.5,
  road: 0.062,
  sea: 0.008,
  rail: 0.022,
  express: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Pagination and query guards
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** No unbounded query. Anything that could grow takes a cap. PART 3A.7. */
export const MAX_GRAPH_NEIGHBOURS = 500;
export const MAX_SCENARIOS_PER_MATRIX = 50;
