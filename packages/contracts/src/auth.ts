/**
 * Auth request/response contracts (PART 8).
 *
 * The access token is RS256 and short-lived; the refresh token is rotated on
 * every use and revoked through a `jti` denylist in Redis. Those mechanics live
 * in the auth module — this file is only the shapes on the wire.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { roleSchema, scopeSchema } from './enums';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './limits';

export const loginRequestSchema = z.object({
  email: z.email().max(EMAIL_MAX_LENGTH),
  /** Minimum length only. Complexity rules belong in the service, with the policy. */
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const publicUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  display_name: z.string(),
  org_id: idSchema,
  role: roleSchema,
  scopes: z.array(scopeSchema),
  created_at: isoDateTimeSchema,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/**
 * The refresh token is NOT in this body. It is set as an httpOnly, Secure,
 * SameSite=Strict cookie so page JavaScript cannot read it, which is the whole
 * point of using a cookie rather than localStorage.
 */
export const loginResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
  token_type: z.literal('Bearer'),
  user: publicUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** Claims we put in the access token. Kept minimal — a token is not a database. */
export const accessTokenClaimsSchema = z.object({
  sub: idSchema,
  org: idSchema,
  role: roleSchema,
  scopes: z.array(scopeSchema),
  jti: z.string(),
  iss: z.string(),
  aud: z.string(),
  iat: z.number(),
  exp: z.number(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const oauthStartResponseSchema = z.object({
  authorization_url: z.url(),
  state: z.string(),
});
export type OauthStartResponse = z.infer<typeof oauthStartResponseSchema>;

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type OauthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;
