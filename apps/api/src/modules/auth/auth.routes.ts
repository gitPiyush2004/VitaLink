/**
 * URL -> middleware chain -> controller. No logic (PART 3A.1).
 *
 * A router is meant to be readable as a table of contents: what paths exist, what
 * each one requires, and which controller method handles it. Anything else in
 * here is a smell.
 *
 * The module is wired up by a factory rather than by import-time side effects, so
 * dependencies are visible: this router needs a repository, which needs a
 * connection. Nothing reaches into a global.
 */

import { Router } from 'express';

import { createTokenService } from '@shared/auth/tokens';
import { requireAuth } from '@shared/middleware/auth';
import { validate } from '@shared/middleware/validate';

import { createAuthController } from './auth.controller';
import { createAuthRepository } from './auth.repository';
import { loginRequestSchema, logoutRequestSchema, refreshRequestSchema } from './auth.schema';
import { AuthService } from './auth.service';

export function createAuthRouter(): Router {
  const repository = createAuthRepository();
  const service = new AuthService(repository, createTokenService());
  const controller = createAuthController(service);

  const router = Router();

  router.post('/login', validate({ body: loginRequestSchema }), controller.login);
  router.post('/refresh', validate({ body: refreshRequestSchema }), controller.refresh);
  router.post('/logout', requireAuth, validate({ body: logoutRequestSchema }), controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
