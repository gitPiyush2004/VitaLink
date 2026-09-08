/**
 * Access and refresh token mechanics.
 *
 * This lives in `shared/` rather than in the auth module because three different
 * places need to verify a token: the HTTP middleware, the Socket.IO handshake,
 * and the worker that calls back into the API. The auth module owns the *login
 * workflow*; this file owns the *token format*.
 *
 * Design, and the reasoning an interviewer will ask for:
 *
 *  - RS256, not HS256. The API signs with the private key; anything that only
 *    needs to *verify* (the socket server, a future service) gets the public key
 *    and cannot mint tokens.
 *  - 15-minute access token, held in memory by the browser. Short, because it
 *    cannot be revoked directly — only denylisted.
 *  - Refresh token rotated on every use and stored in an httpOnly cookie, so page
 *    JavaScript cannot read it. Reuse of an already-rotated refresh token is
 *    treated as theft and revokes the family.
 *  - Revocation via a `jti` denylist in Redis with a TTL equal to the token's
 *    remaining life. That bounds the denylist's size automatically: an expired
 *    token needs no entry, because verification would reject it anyway.
 */

import { randomUUID } from 'node:crypto';

import { importPKCS8, importSPKI, jwtVerify, SignJWT, type JWTPayload, type KeyLike } from 'jose';

import {
  accessTokenClaimsSchema,
  type AccessTokenClaims,
  type Role,
  type Scope,
} from '@vitalink/contracts';

import { MS_PER_SECOND } from '@config/constants';
import { env } from '@config/env';
import { getRedis } from '@shared/db';
import { UnauthenticatedError } from '@shared/errors';

const ALGORITHM = 'RS256';
const DENYLIST_PREFIX = 'auth:jti:denied:';
const REFRESH_PREFIX = 'auth:refresh:';

type KeyPair = { privateKey: KeyLike; publicKey: KeyLike };
let keys: KeyPair | null = null;

/**
 * Keys are imported once and cached. `.replace` handles the common case of a PEM
 * pasted into a `.env` file as a single line with literal `\n` sequences.
 */
async function getKeys(): Promise<KeyPair> {
  if (keys !== null) return keys;

  const privatePem = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const publicPem = env.JWT_PUBLIC_KEY.replace(/\\n/g, '\n');

  keys = {
    privateKey: await importPKCS8(privatePem, ALGORITHM),
    publicKey: await importSPKI(publicPem, ALGORITHM),
  };
  return keys;
}

export type AccessTokenSubject = {
  userId: string;
  orgId: string;
  role: Role;
  scopes: Scope[];
};

export type IssuedAccessToken = { token: string; jti: string; expiresIn: number };

export async function signAccessToken(subject: AccessTokenSubject): Promise<IssuedAccessToken> {
  const { privateKey } = await getKeys();
  const jti = randomUUID();
  const nowSeconds = Math.floor(Date.now() / MS_PER_SECOND);

  const token = await new SignJWT({
    org: subject.orgId,
    role: subject.role,
    scopes: subject.scopes,
  })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(subject.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(jti)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + env.JWT_ACCESS_TTL_SECONDS)
    .sign(privateKey);

  return { token, jti, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

/**
 * Verifies signature, issuer, audience and expiry, then checks the denylist.
 *
 * The denylist lookup is a deliberate cost: it turns a stateless token into a
 * revocable one. Without it, a compromised access token stays valid for its full
 * 15 minutes no matter what an administrator does.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { publicKey } = await getKeys();

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, publicKey, {
      algorithms: [ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    payload = result.payload;
  } catch {
    throw new UnauthenticatedError('Access token is invalid or has expired.');
  }

  const parsed = accessTokenClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new UnauthenticatedError('Access token claims are malformed.');
  }

  if (await isJtiDenied(parsed.data.jti)) {
    throw new UnauthenticatedError('Access token has been revoked.');
  }

  return parsed.data;
}

export async function isJtiDenied(jti: string): Promise<boolean> {
  const hit = await getRedis().exists(`${DENYLIST_PREFIX}${jti}`);
  return hit === 1;
}

/**
 * Denies a `jti` until the moment the token would have expired anyway.
 *
 * The TTL is what keeps this bounded: we never store an entry for longer than it
 * can matter, so the denylist cannot grow without limit.
 */
export async function denyJti(jti: string, expiresAtUnixSeconds: number): Promise<void> {
  const ttl = expiresAtUnixSeconds - Math.floor(Date.now() / MS_PER_SECOND);
  if (ttl <= 0) return;
  await getRedis().set(`${DENYLIST_PREFIX}${jti}`, '1', 'EX', ttl);
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

export type RefreshRecord = {
  userId: string;
  orgId: string;
  /** All tokens descended from one login. Reuse detection revokes the family. */
  familyId: string;
};

export type IssuedRefreshToken = { token: string; expiresIn: number };

/**
 * A refresh token is an opaque random string, not a JWT.
 *
 * It has to be looked up server-side on every use anyway — that is what makes
 * rotation and reuse detection possible — so there is nothing to gain from making
 * it self-describing, and a self-describing token would leak the user id.
 */
export async function issueRefreshToken(record: RefreshRecord): Promise<IssuedRefreshToken> {
  const token = randomUUID() + randomUUID().replace(/-/g, '');
  await getRedis().set(
    `${REFRESH_PREFIX}${token}`,
    JSON.stringify(record),
    'EX',
    env.JWT_REFRESH_TTL_SECONDS,
  );
  return { token, expiresIn: env.JWT_REFRESH_TTL_SECONDS };
}

/**
 * Consumes a refresh token: reads it and deletes it in one atomic step.
 *
 * `getdel` matters. With a separate GET then DEL, two concurrent refreshes could
 * both read the same token and both succeed, which is exactly the race that
 * rotation is supposed to close.
 */
export async function consumeRefreshToken(token: string): Promise<RefreshRecord | null> {
  const raw = await getRedis().getdel(`${REFRESH_PREFIX}${token}`);
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      'orgId' in parsed &&
      'familyId' in parsed
    ) {
      return parsed as RefreshRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await getRedis().del(`${REFRESH_PREFIX}${token}`);
}

// ---------------------------------------------------------------------------
// The injectable surface
// ---------------------------------------------------------------------------

/**
 * The token operations a service depends on, as a type.
 *
 * Why this exists rather than services importing the functions above directly:
 * `signAccessToken` needs an RSA key and `issueRefreshToken` needs Redis, so a
 * service that imports them is untestable without standing up both. Injecting
 * this interface means `AuthService` can be unit tested against five one-line
 * stubs and no mocking framework (PART 3A.5 rule 5).
 *
 * `verifyAccessToken` is deliberately NOT here. It is used by middleware and by
 * the Socket.IO handshake, neither of which is unit tested in isolation — they
 * are covered by API tests against the real thing.
 */
export type TokenService = {
  signAccessToken(subject: AccessTokenSubject): Promise<IssuedAccessToken>;
  issueRefreshToken(record: RefreshRecord): Promise<IssuedRefreshToken>;
  consumeRefreshToken(token: string): Promise<RefreshRecord | null>;
  revokeRefreshToken(token: string): Promise<void>;
  denyJti(jti: string, expiresAtUnixSeconds: number): Promise<void>;
};

export function createTokenService(): TokenService {
  return {
    signAccessToken,
    issueRefreshToken,
    consumeRefreshToken,
    revokeRefreshToken,
    denyJti,
  };
}
