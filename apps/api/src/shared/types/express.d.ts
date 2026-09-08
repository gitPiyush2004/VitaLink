/**
 * Declaration merging so `req.requestId`, `req.log` and `req.auth` are typed.
 *
 * This is the conventional way to extend Express's Request. The alternative —
 * casting `req` at every use site — is exactly the kind of `as` noise that makes
 * a codebase unreadable.
 */

import type { Logger } from 'pino';

import type { AccessTokenClaims } from '@vitalink/contracts';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requestId middleware. Present on every request. */
      requestId: string;
      /** Child logger bound to this request's id. */
      log: Logger;
      /** Set by the auth middleware. Absent on public routes. */
      auth?: AccessTokenClaims;
      /** Raw body, preserved only on webhook routes so HMAC can be verified. */
      rawBody?: Buffer;
    }
  }
}
