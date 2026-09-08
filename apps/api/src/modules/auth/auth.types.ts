/**
 * Module-local types.
 *
 * Note the three distinct shapes, which is PART 3A.5 rule 7 made concrete:
 *
 *   LoginRequest  (in auth.schema.ts) — the zod-validated request DTO
 *   UserEntity    (here)              — the internal domain entity
 *   UserDocument  (in models/)        — the Mongoose model
 *
 * They are not interchangeable and they are never passed into each other. A
 * request body is never handed straight to a model, which is the bug that lets a
 * client set `role: 'ADMINISTRATOR'` on itself.
 */

import type { Role } from '@vitalink/contracts';

/**
 * A user as the business logic sees one: camelCase, no Mongoose, no password
 * hash. Repositories return this; services only ever see this.
 */
export type UserEntity = {
  id: string;
  email: string;
  displayName: string;
  orgId: string;
  role: Role;
  oauthSubject: string | null;
  lastLoginAt: string | null;
  isDisabled: boolean;
  createdAt: string;
};

/**
 * The same entity plus the hash, returned only by the one repository method that
 * needs it. Separating it means the hash cannot travel through the codebase by
 * accident — it is visible in the type when it is present.
 */
export type UserWithSecret = UserEntity & { passwordHash: string };

export type OrgEntity = {
  id: string;
  name: string;
  emailDomains: string[];
  carrierPreference: Record<string, number>;
  isActive: boolean;
};

export type CreateUserInput = {
  email: string;
  passwordHash: string | null;
  displayName: string;
  orgId: string;
  role: Role;
  oauthSubject: string | null;
};
