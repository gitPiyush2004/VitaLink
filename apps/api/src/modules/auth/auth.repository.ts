/**
 * The only place in this module that touches Mongoose.
 *
 * Four conventions this file establishes, and every other repository follows:
 *
 *  1. It returns plain domain objects, never Mongoose documents. `.lean()` on
 *     every read that does not need document methods, then an explicit mapper.
 *  2. The snake_case-to-camelCase mapping happens here and nowhere else. The
 *     mappers are written out by hand rather than done with a recursive key
 *     transformer, so there is a specific line you can point at where the shape
 *     changes.
 *  3. Each method is a standalone module-level function, and `createAuthRepository`
 *     only names them. That keeps every function inside the 50-line budget and
 *     lets you read one query without scrolling past the other six.
 *  4. It is constructed, not imported as a singleton, so a service can be unit
 *     tested by passing a stub with the same method signatures and no mocking
 *     framework at all (PART 3A.5 rule 5).
 */

import { Types } from 'mongoose';

import { DatabaseError } from '@shared/errors';

import type { CreateUserInput, OrgEntity, UserEntity, UserWithSecret } from './auth.types';
import { OrgModel, type OrgDocument } from './models/org.model';
import { UserModel, type UserDocument } from './models/user.model';

/**
 * What `.lean()` actually returns: the inferred document fields, an ObjectId
 * `_id`, and the two timestamps — which Mongoose adds at runtime but does not
 * include in `InferSchemaType`, so they are declared here explicitly.
 */
type Timestamps = { created_at: Date; updated_at: Date };
type LeanUser = UserDocument & Timestamps & { _id: Types.ObjectId };
type LeanOrg = OrgDocument & Timestamps & { _id: Types.ObjectId };

function toUserEntity(row: LeanUser): UserEntity {
  return {
    id: row._id.toString(),
    email: row.email,
    displayName: row.display_name,
    orgId: row.org_id,
    role: row.role,
    // Schema defaults make these `T | null | undefined` in the inferred type;
    // the domain entity uses a plain `T | null`, so the boundary normalises it.
    oauthSubject: row.oauth_subject ?? null,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    isDisabled: row.is_disabled ?? false,
    createdAt: row.created_at.toISOString(),
  };
}

function toOrgEntity(row: LeanOrg): OrgEntity {
  return {
    id: row._id.toString(),
    name: row.name,
    emailDomains: row.email_domains,
    // `Mixed` is genuinely unknown at the schema level, so it is narrowed here
    // at the boundary rather than trusted further in.
    carrierPreference: (row.carrier_preference ?? {}) as Record<string, number>,
    isActive: row.is_active ?? true,
  };
}

/**
 * The one function that returns the password hash. `.select('+password_hash')` is
 * needed because the schema marks it `select: false` — opt-in rather than
 * opt-out, so leaking it takes a deliberate act.
 */
async function findUserByEmailWithSecret(email: string): Promise<UserWithSecret | null> {
  try {
    const row = await UserModel.findOne({ email: email.trim().toLowerCase() })
      .select('+password_hash')
      .lean<LeanUser & { password_hash: string }>()
      .exec();

    if (row === null) return null;
    return { ...toUserEntity(row), passwordHash: row.password_hash };
  } catch (error) {
    throw new DatabaseError('findUserByEmailWithSecret', error);
  }
}

async function findUserById(id: string): Promise<UserEntity | null> {
  // A malformed id is a miss, not a cast error. Mongoose would otherwise throw.
  if (!Types.ObjectId.isValid(id)) return null;
  try {
    const row = await UserModel.findById(id).lean<LeanUser>().exec();
    return row === null ? null : toUserEntity(row);
  } catch (error) {
    throw new DatabaseError('findUserById', error);
  }
}

async function findUserByOauthSubject(subject: string): Promise<UserEntity | null> {
  try {
    const row = await UserModel.findOne({ oauth_subject: subject }).lean<LeanUser>().exec();
    return row === null ? null : toUserEntity(row);
  } catch (error) {
    throw new DatabaseError('findUserByOauthSubject', error);
  }
}

async function createUser(input: CreateUserInput): Promise<UserEntity> {
  try {
    // `.create()` runs the schema's pre-save hook, which is why the email ends up
    // normalised even though this function does not normalise it.
    const created = await UserModel.create({
      email: input.email,
      password_hash: input.passwordHash ?? '',
      display_name: input.displayName,
      org_id: input.orgId,
      role: input.role,
      oauth_subject: input.oauthSubject,
    });

    return toUserEntity(created.toObject<LeanUser>());
  } catch (error) {
    throw new DatabaseError('createUser', error);
  }
}

async function recordLogin(userId: string, at: Date): Promise<void> {
  try {
    await UserModel.updateOne({ _id: userId }, { $set: { last_login_at: at } }).exec();
  } catch (error) {
    throw new DatabaseError('recordLogin', error);
  }
}

async function findOrgByEmailDomain(domain: string): Promise<OrgEntity | null> {
  try {
    const row = await OrgModel.findOne({ email_domains: domain.toLowerCase() })
      .lean<LeanOrg>()
      .exec();
    return row === null ? null : toOrgEntity(row);
  } catch (error) {
    throw new DatabaseError('findOrgByEmailDomain', error);
  }
}

/**
 * Creates an organisation if one does not already claim the domain.
 *
 * Exists because the bootstrap script needs it, and the ESLint layering rule
 * correctly refused to let that script import `OrgModel` directly. Adding the
 * method here rather than relaxing the rule is the point of having the rule.
 */
async function upsertOrgByDomain(input: { name: string; emailDomain: string }): Promise<OrgEntity> {
  try {
    const row = await OrgModel.findOneAndUpdate(
      { email_domains: input.emailDomain.toLowerCase() },
      {
        $setOnInsert: {
          name: input.name,
          email_domains: [input.emailDomain.toLowerCase()],
          is_active: true,
        },
      },
      { upsert: true, new: true },
    )
      .lean<LeanOrg>()
      .exec();

    if (row === null) throw new Error('org upsert returned no document');
    return toOrgEntity(row);
  } catch (error) {
    throw new DatabaseError('upsertOrgByDomain', error);
  }
}

async function findOrgById(id: string): Promise<OrgEntity | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  try {
    const row = await OrgModel.findById(id).lean<LeanOrg>().exec();
    return row === null ? null : toOrgEntity(row);
  } catch (error) {
    throw new DatabaseError('findOrgById', error);
  }
}

/**
 * The contract a service depends on.
 *
 * Declaring it as a type rather than inferring it from the implementation is the
 * point: a unit test can satisfy this with seven one-line stubs, and the service
 * never learns that Mongo exists.
 */
/**
 * Every organisation, id and name only.
 *
 * A tiny query with a specific job: a CLI script has no request to take an org
 * from, and hardcoding one meant the pipeline wrote to a tenant no user belonged
 * to. See `scripts/cli-org.ts`.
 */
async function listOrgs(): Promise<{ id: string; name: string }[]> {
  try {
    const docs = await OrgModel.find({}, { name: 1 })
      .lean<{ _id: unknown; name: string }[]>()
      .exec();
    return docs.map((doc) => ({ id: String(doc._id), name: doc.name }));
  } catch (error) {
    throw new DatabaseError('listOrgs', error);
  }
}

export type AuthRepository = {
  findUserByEmailWithSecret(email: string): Promise<UserWithSecret | null>;
  findUserById(id: string): Promise<UserEntity | null>;
  findUserByOauthSubject(subject: string): Promise<UserEntity | null>;
  createUser(input: CreateUserInput): Promise<UserEntity>;
  recordLogin(userId: string, at: Date): Promise<void>;
  findOrgByEmailDomain(domain: string): Promise<OrgEntity | null>;
  findOrgById(id: string): Promise<OrgEntity | null>;
  upsertOrgByDomain(input: { name: string; emailDomain: string }): Promise<OrgEntity>;
  listOrgs(): Promise<{ id: string; name: string }[]>;
};

export function createAuthRepository(): AuthRepository {
  return {
    findUserByEmailWithSecret,
    findUserById,
    findUserByOauthSubject,
    createUser,
    recordLogin,
    findOrgByEmailDomain,
    findOrgById,
    upsertOrgByDomain,
    listOrgs,
  };
}
