/**
 * Thin controllers (PART 3A.1).
 *
 * Each handler does exactly three things: read already-validated input, call the
 * service, shape the response. No business logic, no database access, nothing
 * over about twenty lines. If a handler here grows, that is the signal that logic
 * has leaked out of the service.
 *
 * The one thing that legitimately lives here is cookie handling, because a cookie
 * is a transport concern and the service must not know that HTTP exists.
 */

import type { CookieOptions, Request, RequestHandler, Response } from 'express';

import type { LoginRequest } from '@vitalink/contracts';

import { MS_PER_SECOND, REFRESH_COOKIE_NAME } from '@config/constants';
import { isProduction } from '@config/env';
import { UnauthenticatedError } from '@shared/errors';
import { sendCreated, sendOk } from '@shared/http';

import type { LogoutRequest } from './auth.schema';
import type { AuthService, LoginResult } from './auth.service';

/**
 * `httpOnly` so page JavaScript cannot read it, `sameSite: 'strict'` so it is not
 * sent on cross-site requests (which is CSRF protection for this cookie), and
 * `path` scoped to the auth routes so it is not attached to every API call.
 */
function refreshCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: maxAgeSeconds * MS_PER_SECOND,
  };
}

function setRefreshCookie(res: Response, result: LoginResult): void {
  res.cookie(
    REFRESH_COOKIE_NAME,
    result.refreshToken,
    refreshCookieOptions(result.refreshExpiresIn),
  );
}

/** The refresh token is never returned in the body — only the access token is. */
function loginBody(result: LoginResult): {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: LoginResult['user'];
} {
  return {
    access_token: result.accessToken,
    expires_in: result.expiresIn,
    token_type: 'Bearer',
    user: result.user,
  };
}

export type AuthController = {
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
};

export function createAuthController(service: AuthService): AuthController {
  return {
    async login(req: Request, res: Response): Promise<void> {
      const body = req.body as LoginRequest;
      const result = await service.loginWithPassword(body.email, body.password);

      setRefreshCookie(res, result);
      sendCreated(res, loginBody(result));
    },

    async refresh(req: Request, res: Response): Promise<void> {
      const fromCookie: unknown = req.cookies[REFRESH_COOKIE_NAME];
      const fromBody = (req.body as { refresh_token?: string }).refresh_token;
      const token = typeof fromCookie === 'string' ? fromCookie : fromBody;

      if (token === undefined) {
        throw new UnauthenticatedError('No refresh token was presented.');
      }

      const result = await service.refresh(token);
      setRefreshCookie(res, result);
      sendOk(res, loginBody(result));
    },

    async logout(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) {
        throw new UnauthenticatedError('Logout requires an access token.');
      }

      const fromCookie: unknown = req.cookies[REFRESH_COOKIE_NAME];
      const token = typeof fromCookie === 'string' ? fromCookie : null;

      await service.logout(token, req.auth.jti, req.auth.exp);

      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      sendOk(res, { logged_out: true, all_sessions: (req.body as LogoutRequest).all_sessions });
    },

    async me(req: Request, res: Response): Promise<void> {
      if (req.auth === undefined) {
        throw new UnauthenticatedError();
      }
      sendOk(res, await service.getPublicUser(req.auth.sub));
    },
  };
}
