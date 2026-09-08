/**
 * Named bounds used by the schemas.
 *
 * These exist because `z.number().min(-180).max(180)` tells a reader the range
 * but not the reason. `LONGITUDE_MIN` does. It also means a bound is defined once
 * rather than retyped in each schema that needs it, so they cannot drift apart.
 */

/** RFC 5321 caps an email address at 320 characters (64 local + @ + 255 domain). */
export const EMAIL_MAX_LENGTH = 320;

/** Matches MIN_PASSWORD_LENGTH in the API's constants; the policy lives there. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/** Long enough for a Mongo ObjectId hex string or one of our slug ids. */
export const ID_MAX_LENGTH = 200;

/** ISO 3166-1 alpha-2. */
export const COUNTRY_CODE_LENGTH = 2;

export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

/** The LLM's ordinal severity label. Not a score, and never multiplied into one. */
export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 5;

/** An insight is one sentence. The cap stops the model writing an essay. */
export const INSIGHT_MAX_LENGTH = 240;

/** Two years is the longest disruption duration a scenario may assume. */
export const SHOCK_DURATION_MAX_DAYS = 730;

/** The regulatory-to-physical chain is seven hops, so eight is a generous cap. */
export const CASCADE_MAX_DEPTH_LIMIT = 8;

/** The Fragility Index is a percentage: 100 * expected shortage. */
export const FRAGILITY_INDEX_MAX = 100;

/** Sub-scores are 0..100 so a reader can compare them without normalising. */
export const SUB_SCORE_MAX = 100;
