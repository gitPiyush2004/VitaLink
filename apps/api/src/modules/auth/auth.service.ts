/**
 * The business logic of authentication.
 *
 * What makes this the reference service (PART 3A.1):
 *
 *  - it is framework-free: no `req`, no `res`, no Mongoose. Every input is a
 *    plain value, every output a domain object, every failure a typed error.
 *    That is what lets a worker or a CLI script call `loginWithPassword` too.
 *  - dependencies arrive through the constructor, so a unit test writes
 *    `new AuthService(stubRepository)` and needs no mocking framework
 *    (PART 3A.5 rule 5).
 *  - every method is inside the 50-line budget, and the parts that are pure
 *    rules live in `domain/`.
 *
 * A class rather than a closure factory, deliberately: constructor injection is
 * the pattern the spec names first, and it keeps each method individually
 * measurable against the complexity budget instead of hiding them inside one
 * large factory function.
 */

import { compare, hash } from 'bcryptjs';

import type { PublicUser, Role } from '@vitalink/contracts';

import { PASSWORD_HASH_ROUNDS } from '@config/constants';
import { scopesForRole } from '@shared/auth/permissions';
import type { TokenService } from '@shared/auth/tokens';
import { ConflictError, UnauthenticatedError, ValidationError } from '@shared/errors';

import type { AuthRepository } from './auth.repository';
import type { UserEntity } from './auth.types';
import { assessPassword, emailDomain } from './domain/password-policy';

/**
 * A bcrypt hash of a value nobody knows, compared against when the email does
 * not exist.
 *
 * Without it, a failed login for an unknown email returns in about a millisecond
 * and a failed login for a known email returns in about 250, which turns the
 * login endpoint into a user-enumeration oracle. Doing the work anyway removes
 * the timing signal.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO.31nMJi3D2X5vB8i0Q8O0EAJqZ2XZbW';

export type LoginResult = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  user: PublicUser;
};

export type RegisterUserInput = {
  email: string;
  password: string;
  displayName: string;
  role: Role;
};

function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    org_id: user.orgId,
    role: user.role,
    scopes: scopesForRole(user.role),
    created_at: user.createdAt,
  };
}

async function issueSession(tokens: TokenService, user: UserEntity): Promise<LoginResult> {
  const access = await tokens.signAccessToken({
    userId: user.id,
    orgId: user.orgId,
    role: user.role,
    scopes: scopesForRole(user.role),
  });
  // A new family id per login, so revoking one stolen session does not log the
  // user out of their other devices.
  const refresh = await tokens.issueRefreshToken({
    userId: user.id,
    orgId: user.orgId,
    familyId: access.jti,
  });

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.token,
    refreshExpiresIn: refresh.expiresIn,
    user: toPublicUser(user),
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
  ) {}

  async loginWithPassword(email: string, password: string): Promise<LoginResult> {
    const found = await this.repository.findUserByEmailWithSecret(email);

    // Compare against the dummy hash rather than returning early — see above.
    const isValid = await compare(password, found?.passwordHash ?? DUMMY_HASH);

    if (found === null || !isValid || found.isDisabled) {
      // One message for all three cases, on purpose: telling the caller which
      // one failed tells an attacker which emails are registered.
      throw new UnauthenticatedError('Email or password is incorrect.');
    }

    await this.repository.recordLogin(found.id, new Date());
    return issueSession(this.tokens, found);
  }

  /**
   * Rotates the refresh token: the presented one is consumed atomically and a
   * fresh one is issued. Presenting an already-consumed token therefore fails,
   * which is how token theft becomes detectable rather than silent.
   */
  async refresh(refreshToken: string): Promise<LoginResult> {
    const record = await this.tokens.consumeRefreshToken(refreshToken);
    if (record === null) {
      throw new UnauthenticatedError('Refresh token is invalid, expired or already used.');
    }

    const user = await this.repository.findUserById(record.userId);
    if (user === null || user.isDisabled) {
      throw new UnauthenticatedError('Account is no longer active.');
    }

    return issueSession(this.tokens, user);
  }

  /**
   * Ends a session. Two things happen and both are necessary: the refresh token
   * is deleted so no new access token can be minted, and the current access
   * token's `jti` is denylisted so the one already in the browser stops working
   * immediately rather than in up to fifteen minutes.
   */
  async logout(refreshToken: string | null, jti: string, tokenExp: number): Promise<void> {
    if (refreshToken !== null) {
      await this.tokens.revokeRefreshToken(refreshToken);
    }
    await this.tokens.denyJti(jti, tokenExp);
  }

  async getPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (user === null) {
      throw new UnauthenticatedError('Account no longer exists.');
    }
    return toPublicUser(user);
  }

  /**
   * Creates a user against an existing organisation, resolved from the email
   * domain. Used by the seed script and by the admin screen; there is no public
   * self-service signup, because Vitalink is an internal operations tool.
   */
  async registerUser(input: RegisterUserInput): Promise<PublicUser> {
    const domain = emailDomain(input.email);
    if (domain === null) {
      throw new ValidationError('Email address is malformed.');
    }

    const assessment = assessPassword(input.password, input.email);
    if (!assessment.isAcceptable) {
      throw new ValidationError('Password does not meet the policy.', {
        problems: assessment.problems,
      });
    }

    const org = await this.repository.findOrgByEmailDomain(domain);
    if (org === null) {
      throw new ValidationError(`No organisation is registered for the domain ${domain}.`);
    }

    if ((await this.repository.findUserByEmailWithSecret(input.email)) !== null) {
      throw new ConflictError('An account with that email already exists.');
    }

    return toPublicUser(
      await this.repository.createUser({
        email: input.email,
        passwordHash: await hash(input.password, PASSWORD_HASH_ROUNDS),
        displayName: input.displayName,
        orgId: org.id,
        role: input.role,
        oauthSubject: null,
      }),
    );
  }
}
