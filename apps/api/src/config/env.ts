/**
 * Environment configuration, validated once at import time.
 *
 * PART 3A.5 rule 4: fail fast on config. `parseEnv` throws while the module is
 * being imported, so a process with a bad `.env` refuses to start rather than
 * crashing on the first request that happens to need the missing value. That is
 * the difference between a five-second fix and a 3 a.m. debugging session.
 *
 * Nothing else in the codebase reads `process.env`. A CI grep would be overkill;
 * the convention is simply that this is the only file that does.
 */

import { z } from 'zod';

const SECONDS_PER_MINUTE = 60;
const DEFAULT_ACCESS_TTL_S = 15 * SECONDS_PER_MINUTE;
const DEFAULT_REFRESH_TTL_S = 14 * 24 * 60 * SECONDS_PER_MINUTE;
const DEFAULT_API_PORT = 4000;

/** Accepts "true"/"false"/"1"/"0" because shells and Docker disagree about booleans. */
const booleanFromString = z
  .string()
  .transform((raw) => raw.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0']))
  .transform((value) => value === 'true' || value === '1');

/**
 * A carrier preference map, e.g. `{"dsv":2.0}`.
 *
 * Spec 6.2: a preference you can see is a business rule; a preference you cannot
 * see is a bug. It defaults to empty, and when non-empty the recommendation
 * explanation is required to disclose it.
 */
const carrierPreferenceMap = z
  .string()
  .default('{}')
  .transform((raw, ctx): Record<string, number> => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return z.record(z.string(), z.number()).parse(parsed);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'CARRIER_PREFERENCE_JSON must be a JSON object of carrier id -> bonus points.',
      });
      return {};
    }
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_API_PORT),
    WEB_ORIGIN: z.url().default('http://localhost:5173'),

    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

    BRAIN_BASE_URL: z.url(),
    BRAIN_SHARED_SECRET: z.string().min(16, 'BRAIN_SHARED_SECRET must be at least 16 chars'),

    // PEM blocks. Kept as strings so they can come from a secrets manager as-is.
    JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is required (RS256 PKCS#8 PEM)'),
    JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is required (SPKI PEM)'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(DEFAULT_ACCESS_TTL_S),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(DEFAULT_REFRESH_TTL_S),
    JWT_ISSUER: z.string().min(1).default('vitalink'),
    JWT_AUDIENCE: z.string().min(1).default('vitalink-api'),

    GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().default(''),

    WEBHOOK_SIGNING_SECRET: z.string().min(16, 'WEBHOOK_SIGNING_SECRET must be at least 16 chars'),

    UN_COMTRADE_API_KEY: z.string().default(''),
    DATA_GOV_IN_API_KEY: z.string().default(''),
    NOMINATIM_USER_AGENT: z.string().min(1).default('vitalink/0.1 (contact-unset)'),

    ANTHROPIC_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default('claude-sonnet-5'),
    LLM_ENABLED: booleanFromString.default(false),

    DSV_ENVIRONMENT: z.enum(['demo', 'production']).default('demo'),
    DSV_CLIENT_ID: z.string().default(''),
    DSV_CLIENT_SECRET: z.string().default(''),
    DSV_SUBSCRIPTION_KEY: z.string().default(''),

    FEDEX_CLIENT_ID: z.string().default(''),
    FEDEX_CLIENT_SECRET: z.string().default(''),
    FEDEX_ACCOUNT_NUMBER: z.string().default(''),
    FEDEX_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

    UPS_CLIENT_ID: z.string().default(''),
    UPS_CLIENT_SECRET: z.string().default(''),
    UPS_ACCOUNT_NUMBER: z.string().default(''),
    UPS_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

    DHL_API_KEY: z.string().default(''),
    DHL_API_SECRET: z.string().default(''),
    DHL_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

    KUEHNE_NAGEL_API_KEY: z.string().default(''),
    CEVA_API_KEY: z.string().default(''),

    CARRIER_MOCK_MODE: booleanFromString.default(false),
    RATE_MODEL_ENABLED: booleanFromString.default(false),
    CARRIER_PREFERENCE_JSON: carrierPreferenceMap,
  })
  .superRefine((env, ctx) => {
    // CI gate 5 asserts this same property statically. Enforcing it here as well
    // means a misconfigured production deploy cannot boot, not merely that a test
    // would have caught it.
    if (env.NODE_ENV === 'production' && env.CARRIER_MOCK_MODE) {
      ctx.addIssue({
        code: 'custom',
        path: ['CARRIER_MOCK_MODE'],
        message:
          'CARRIER_MOCK_MODE cannot be enabled when NODE_ENV=production. Mock quotes must ' +
          'never be reachable in production (spec Rule 4).',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Exported so tests can build a config object without touching `process.env`.
 * Production code uses the `env` singleton below.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration. The process will not start.\n${problems}\n\n` +
        'Copy .env.example to .env and fill in the missing values.',
    );
  }

  return result.data;
}

export const env: Env = parseEnv(process.env);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
