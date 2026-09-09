/**
 * The auth module's public surface.
 *
 * Anything outside this module — another module, a worker, a script — imports
 * from here and gets a wired service. It never reaches for the repository or a
 * model, and ESLint's `no-restricted-imports` enforces that.
 *
 * This file exists because the rule caught a real violation: the bootstrap
 * script was importing `OrgModel` and `createAuthRepository` directly. A module
 * with a public surface is the fix; relaxing the rule would not have been.
 */

import { createTokenService } from '@shared/auth/tokens';

import { createAuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

export { AuthService } from './auth.service';
export type { LoginResult, RegisterUserInput } from './auth.service';

/** A fully wired `AuthService`. The only way to get one from outside the module. */
export function createAuthService(): AuthService {
  return new AuthService(createAuthRepository(), createTokenService());
}
