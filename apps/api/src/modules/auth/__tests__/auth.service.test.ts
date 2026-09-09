/**
 * Service tests with no mocking framework.
 *
 * Both dependencies arrive through the constructor, so the "mocks" here are
 * plain objects with the right method signatures. That is the payoff of
 * dependency injection (PART 3A.5 rule 5): the test reads as a description of
 * behaviour rather than a list of `vi.mock` calls.
 */

import { describe, expect, it } from 'vitest';

import type {
  IssuedAccessToken,
  IssuedRefreshToken,
  RefreshRecord,
  TokenService,
} from '@shared/auth/tokens';

import type { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import type { CreateUserInput } from '../auth.types';

import { KNOWN_PASSWORD, makeOrg, makeUser, makeUserWithSecret } from './factories/user.factory';

type RepositoryOverrides = Partial<AuthRepository>;

/**
 * A method that throws if called.
 *
 * Every repository method starts out like this, so a test that accidentally
 * exercises a query it did not intend fails with a clear message instead of
 * silently returning `undefined`.
 */
function notStubbed<T>(name: string): T {
  return ((): never => {
    throw new Error(`${name} was called but not stubbed in this test`);
  }) as unknown as T;
}

function stubRepository(overrides: RepositoryOverrides = {}): AuthRepository {
  return {
    findUserByEmailWithSecret: notStubbed('findUserByEmailWithSecret'),
    findUserById: notStubbed('findUserById'),
    findUserByOauthSubject: notStubbed('findUserByOauthSubject'),
    createUser: notStubbed('createUser'),
    recordLogin: notStubbed('recordLogin'),
    findOrgByEmailDomain: notStubbed('findOrgByEmailDomain'),
    findOrgById: notStubbed('findOrgById'),
    upsertOrgByDomain: notStubbed('upsertOrgByDomain'),
    ...overrides,
  };
}

type TokenCalls = {
  signed: number;
  refreshIssued: number;
  refreshRevoked: string[];
  jtiDenied: string[];
};

function stubTokens(overrides: Partial<TokenService> = {}): {
  tokens: TokenService;
  calls: TokenCalls;
} {
  const calls: TokenCalls = { signed: 0, refreshIssued: 0, refreshRevoked: [], jtiDenied: [] };

  const tokens: TokenService = {
    signAccessToken: (): Promise<IssuedAccessToken> => {
      calls.signed += 1;
      return Promise.resolve({ token: 'access.jwt', jti: 'jti-1', expiresIn: 900 });
    },
    issueRefreshToken: (): Promise<IssuedRefreshToken> => {
      calls.refreshIssued += 1;
      return Promise.resolve({ token: 'refresh-opaque', expiresIn: 1209600 });
    },
    consumeRefreshToken: (): Promise<RefreshRecord | null> => Promise.resolve(null),
    revokeRefreshToken: (token: string): Promise<void> => {
      calls.refreshRevoked.push(token);
      return Promise.resolve();
    },
    denyJti: (jti: string): Promise<void> => {
      calls.jtiDenied.push(jti);
      return Promise.resolve();
    },
    ...overrides,
  };

  return { tokens, calls };
}

describe('AuthService.loginWithPassword', () => {
  it('issues an access token and a refresh token for correct credentials', async () => {
    const user = makeUserWithSecret();
    const repository = stubRepository({
      findUserByEmailWithSecret: () => Promise.resolve(user),
      recordLogin: () => Promise.resolve(),
    });
    const { tokens, calls } = stubTokens();
    const service = new AuthService(repository, tokens);

    const result = await service.loginWithPassword(user.email, KNOWN_PASSWORD);

    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBe('refresh-opaque');
    expect(calls.signed).toBe(1);
    expect(calls.refreshIssued).toBe(1);
  });

  it('puts the role scopes on the returned user, not just the role', async () => {
    const user = makeUserWithSecret({ role: 'LOGISTICS_MANAGER' });
    const repository = stubRepository({
      findUserByEmailWithSecret: () => Promise.resolve(user),
      recordLogin: () => Promise.resolve(),
    });
    const { tokens } = stubTokens();

    const result = await new AuthService(repository, tokens).loginWithPassword(
      user.email,
      KNOWN_PASSWORD,
    );

    expect(result.user.scopes).toContain('logistics:quote');
    expect(result.user.scopes).not.toContain('cascade:run');
  });

  it('rejects a wrong password', async () => {
    const repository = stubRepository({
      findUserByEmailWithSecret: () => Promise.resolve(makeUserWithSecret()),
    });
    const { tokens } = stubTokens();
    const service = new AuthService(repository, tokens);

    await expect(
      service.loginWithPassword('analyst@vitalink.test', 'Wrong-Password-1'),
    ).rejects.toThrow(/incorrect/i);
  });

  it('gives the same message for an unknown email as for a wrong password', async () => {
    const unknownEmail = stubRepository({ findUserByEmailWithSecret: () => Promise.resolve(null) });
    const wrongPassword = stubRepository({
      findUserByEmailWithSecret: () => Promise.resolve(makeUserWithSecret()),
    });
    const { tokens } = stubTokens();

    const first = await new AuthService(unknownEmail, tokens)
      .loginWithPassword('nobody@vitalink.test', KNOWN_PASSWORD)
      .catch((error: Error) => error.message);
    const second = await new AuthService(wrongPassword, tokens)
      .loginWithPassword('analyst@vitalink.test', 'Wrong-Password-1')
      .catch((error: Error) => error.message);

    // Different messages here would turn the login endpoint into a way to test
    // whether an email address is registered.
    expect(first).toBe(second);
  });

  it('refuses a disabled account even with the correct password', async () => {
    const repository = stubRepository({
      findUserByEmailWithSecret: () => Promise.resolve(makeUserWithSecret({ isDisabled: true })),
    });
    const { tokens, calls } = stubTokens();

    await expect(
      new AuthService(repository, tokens).loginWithPassword(
        'analyst@vitalink.test',
        KNOWN_PASSWORD,
      ),
    ).rejects.toThrow(/incorrect/i);
    expect(calls.signed).toBe(0);
  });
});

describe('AuthService.refresh', () => {
  it('rotates a valid refresh token into a new pair', async () => {
    const repository = stubRepository({ findUserById: () => Promise.resolve(makeUser()) });
    const { tokens, calls } = stubTokens({
      consumeRefreshToken: () =>
        Promise.resolve({ userId: makeUser().id, orgId: makeUser().orgId, familyId: 'fam-1' }),
    });

    const result = await new AuthService(repository, tokens).refresh('refresh-opaque');

    expect(result.accessToken).toBe('access.jwt');
    expect(calls.refreshIssued).toBe(1);
  });

  it('rejects a refresh token that has already been used', async () => {
    // `consumeRefreshToken` returning null is what an already-consumed token
    // looks like: the atomic GETDEL found nothing.
    const { tokens } = stubTokens({ consumeRefreshToken: () => Promise.resolve(null) });

    await expect(new AuthService(stubRepository(), tokens).refresh('already-used')).rejects.toThrow(
      /already used/i,
    );
  });

  it('rejects a refresh for an account that has since been disabled', async () => {
    const repository = stubRepository({
      findUserById: () => Promise.resolve(makeUser({ isDisabled: true })),
    });
    const { tokens } = stubTokens({
      consumeRefreshToken: () => Promise.resolve({ userId: 'u1', orgId: 'o1', familyId: 'f1' }),
    });

    await expect(new AuthService(repository, tokens).refresh('valid')).rejects.toThrow(
      /no longer active/i,
    );
  });
});

describe('AuthService.logout', () => {
  it('revokes the refresh token and denylists the current access token', async () => {
    const { tokens, calls } = stubTokens();

    await new AuthService(stubRepository(), tokens).logout('refresh-opaque', 'jti-1', 9999999999);

    expect(calls.refreshRevoked).toEqual(['refresh-opaque']);
    // Without this, the access token already in the browser stays valid for its
    // full remaining lifetime after the user clicks "log out".
    expect(calls.jtiDenied).toEqual(['jti-1']);
  });

  it('still denylists the access token when no refresh cookie was presented', async () => {
    const { tokens, calls } = stubTokens();

    await new AuthService(stubRepository(), tokens).logout(null, 'jti-2', 9999999999);

    expect(calls.refreshRevoked).toEqual([]);
    expect(calls.jtiDenied).toEqual(['jti-2']);
  });
});

describe('AuthService.registerUser', () => {
  it('rejects a password that fails the policy before touching the database', async () => {
    const { tokens } = stubTokens();
    const service = new AuthService(stubRepository(), tokens);

    await expect(
      service.registerUser({
        email: 'analyst@vitalink.test',
        password: 'short',
        displayName: 'A',
        role: 'ANALYST_VIEWER',
      }),
    ).rejects.toThrow(/policy/i);
  });

  it('rejects an email domain with no registered organisation', async () => {
    const repository = stubRepository({ findOrgByEmailDomain: () => Promise.resolve(null) });
    const { tokens } = stubTokens();

    await expect(
      new AuthService(repository, tokens).registerUser({
        email: 'analyst@unknown.test',
        password: KNOWN_PASSWORD,
        displayName: 'A',
        role: 'ANALYST_VIEWER',
      }),
    ).rejects.toThrow(/no organisation is registered/i);
  });

  it('creates the user against the organisation resolved from the email domain', async () => {
    const org = makeOrg();
    // Collected into an array rather than a `let`, because TypeScript cannot
    // narrow a variable assigned inside a callback and would type it `never`.
    const createCalls: CreateUserInput[] = [];
    const repository = stubRepository({
      findOrgByEmailDomain: () => Promise.resolve(org),
      findUserByEmailWithSecret: () => Promise.resolve(null),
      createUser: (input) => {
        createCalls.push(input);
        return Promise.resolve(makeUser({ orgId: input.orgId, role: input.role }));
      },
    });
    const { tokens } = stubTokens();

    const result = await new AuthService(repository, tokens).registerUser({
      email: 'analyst@vitalink.test',
      password: KNOWN_PASSWORD,
      displayName: 'Test Analyst',
      role: 'SUPPLY_CHAIN_MANAGER',
    });

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]?.orgId).toBe(org.id);
    // The hash is stored, never the password.
    expect(createCalls[0]?.passwordHash).not.toBe(KNOWN_PASSWORD);
    expect(result.org_id).toBe(org.id);
  });

  it('refuses to create a second account with the same email', async () => {
    const repository = stubRepository({
      findOrgByEmailDomain: () => Promise.resolve(makeOrg()),
      findUserByEmailWithSecret: () => Promise.resolve(makeUserWithSecret()),
    });
    const { tokens } = stubTokens();

    await expect(
      new AuthService(repository, tokens).registerUser({
        email: 'analyst@vitalink.test',
        password: KNOWN_PASSWORD,
        displayName: 'A',
        role: 'ANALYST_VIEWER',
      }),
    ).rejects.toThrow(/already exists/i);
  });
});
