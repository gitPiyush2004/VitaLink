# `modules/auth` — the reference module

## What this module does

Authenticates users and issues the tokens every other route depends on. Password
login, refresh-token rotation, logout with immediate revocation, and `GET /me`.

## Why it is the reference module

Every other module in `apps/api/src/modules/` copies this file layout exactly. It
was chosen as the template because it is the simplest module that still touches
all five layers _and_ every convention: two Mongoose models, an explicit
repository mapping, a service with real business rules, a thin controller, a
router with per-route permissions, and pure functions in `domain/`.

If a new module does not look like this one, restructure the new module.

## The five layers, and what each one is allowed to do

| Layer      | File                        | May do                                                          | May **not** do                                       |
| ---------- | --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| router     | `auth.routes.ts`            | map URL → middleware → controller                               | contain any logic                                    |
| middleware | `@shared/middleware/*`      | authenticate, validate, rate limit                              | know about auth's internals                          |
| controller | `auth.controller.ts`        | read validated input, call service, shape response, set cookies | business logic, database access                      |
| service    | `auth.service.ts`           | orchestrate, decide, throw typed errors                         | touch `req`/`res`, touch Mongoose, return HTTP codes |
| repository | `auth.repository.ts`        | run queries, map snake_case → camelCase                         | make decisions                                       |
| model      | `models/*.model.ts`         | declare schema and indexes                                      | contain business logic in hooks                      |
| domain     | `domain/password-policy.ts` | pure rules and arithmetic                                       | any I/O, the clock, randomness                       |

The `models/` rule is enforced mechanically: ESLint's `no-restricted-imports`
makes importing anything from a `models/` directory an error outside a
`*.repository.ts` file. Try it — add `import { UserModel } from './models/user.model'`
to `auth.service.ts` and `npm run lint` fails.

## Follow one request end to end

`POST /api/v1/auth/login`

1. `app.ts` — helmet → cors → compression → body parsers → `cookieParser` →
   `requestId` → `httpLogger` → rate limiters → `/api/v1` router
2. `routes/index.ts` — mounts `/auth`
3. `auth.routes.ts` — matches `POST /login`, runs `validate({ body: loginRequestSchema })`
4. `auth.controller.ts#login` — reads `req.body`, calls the service
5. `auth.service.ts#loginWithPassword` — looks the user up, compares the hash,
   records the login, issues a session
6. `auth.repository.ts#findUserByEmailWithSecret` — the only Mongoose call
7. `models/user.model.ts` — the schema and its unique index on `email`
8. back up: the controller sets the httpOnly refresh cookie and calls `sendCreated`
9. on failure anywhere: a typed `AppError` propagates to `shared/middleware/error-handler.ts`

## Decisions in this module worth defending

**RS256, not HS256.** The API signs with a private key. Anything that only needs
to verify — the Socket.IO handshake, a future service — gets the public key and
therefore cannot mint tokens.

**Refresh token is opaque, not a JWT.** It has to be looked up server-side on
every use anyway, because that is what makes rotation and reuse detection
possible. A self-describing token would gain nothing and would leak the user id.

**Rotation with atomic consumption.** `consumeRefreshToken` uses Redis `GETDEL`.
With a separate `GET` then `DEL`, two concurrent refreshes could both read the
same token and both succeed — exactly the race rotation is meant to close.

**Logout does two things.** Deleting the refresh token stops new access tokens
being minted; denylisting the current `jti` stops the access token already in the
browser. Without the second step, "log out" is a lie for up to fifteen minutes.

**The denylist TTL equals the token's remaining life.** That bounds the
denylist's size automatically — an expired token needs no entry, because
verification would reject it regardless.

**Constant-work password comparison.** When the email does not exist we still run
bcrypt, against `DUMMY_HASH`. Otherwise an unknown email returns in ~1 ms and a
known one in ~250 ms, and the login endpoint becomes a user-enumeration oracle.

**One error message for three failures.** Unknown email, wrong password and
disabled account all return "Email or password is incorrect." Distinguishing them
would leak which addresses are registered.

**Dependencies by constructor.** `AuthService` takes an `AuthRepository` and a
`TokenService`. That is why `__tests__/auth.service.test.ts` contains no
`vi.mock` at all — the stubs are plain objects.

## Tests

| File                                  | Covers                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| `__tests__/password-policy.test.ts`   | the pure domain rules. No mocks, by construction.           |
| `__tests__/auth.service.test.ts`      | the business logic, against stub dependencies.              |
| `__tests__/factories/user.factory.ts` | factories with defaults and overrides, not static fixtures. |

## Not built yet

Google OIDC (Authorization Code with PKCE) is specified in PART 8 and has its
schemas in `@vitalink/contracts/auth`, but the routes are deferred past the MVP.
`findUserByOauthSubject` and `findOrgByEmailDomain` exist for it already.
