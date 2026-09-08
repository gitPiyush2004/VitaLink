/**
 * Request and response schemas for this module's routes.
 *
 * Most of these are re-exported from `@vitalink/contracts` rather than redefined,
 * because the frontend needs the same shapes. Anything genuinely local to the
 * HTTP surface — a refresh body, a logout body — is defined here.
 */

import { z } from 'zod';

import { loginRequestSchema, oauthCallbackQuerySchema } from '@vitalink/contracts';

export { loginRequestSchema, oauthCallbackQuerySchema };

/**
 * The refresh token normally arrives as an httpOnly cookie. The optional body
 * field exists for non-browser clients (the workers, integration tests) that
 * have no cookie jar.
 */
export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const logoutRequestSchema = z.object({
  /** When true, every session for this user is ended, not just this one. */
  all_sessions: z.boolean().default(false),
});
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
