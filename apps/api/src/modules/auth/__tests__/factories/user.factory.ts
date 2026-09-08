/**
 * Test factories, not fixtures (PART 3A.10).
 *
 * A fixture file is a static blob that every test has to read to understand.
 * A factory has sensible defaults and takes overrides, so a test says exactly
 * what it cares about — `makeUser({ isDisabled: true })` — and nothing else.
 */

import type { OrgEntity, UserEntity, UserWithSecret } from '../../auth.types';

/** bcrypt hash of 'Correct-Horse-42', generated once and pasted here. */
export const KNOWN_PASSWORD = 'Correct-Horse-42';
export const KNOWN_PASSWORD_HASH = '$2a$10$KMVEVGyX7gYjFawVSpGoJef1G0dg7/.gfdlRw1EOikEtyPpBJ2RL2';

export function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: '650000000000000000000001',
    email: 'analyst@vitalink.test',
    displayName: 'Test Analyst',
    orgId: '650000000000000000000099',
    role: 'ANALYST_VIEWER',
    oauthSubject: null,
    lastLoginAt: null,
    isDisabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeUserWithSecret(overrides: Partial<UserWithSecret> = {}): UserWithSecret {
  return { ...makeUser(), passwordHash: KNOWN_PASSWORD_HASH, ...overrides };
}

export function makeOrg(overrides: Partial<OrgEntity> = {}): OrgEntity {
  return {
    id: '650000000000000000000099',
    name: 'Test Health Authority',
    emailDomains: ['vitalink.test'],
    carrierPreference: {},
    isActive: true,
    ...overrides,
  };
}
