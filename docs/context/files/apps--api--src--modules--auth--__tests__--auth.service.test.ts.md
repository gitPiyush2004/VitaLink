---
source: 'apps/api/src/modules/auth/__tests__/auth.service.test.ts'
component: auth
generated: true
---

# apps/api/src/modules/auth/**tests**/auth.service.test.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Checks the behavior named in its tests using controlled inputs. Test examples are not public source observations or measured production outcomes.

**Component:** Authenticates users, isolates organisations and enforces roles, access-token and refresh-session rules.

## Source structure

- `RepositoryOverrides` — TypeAliasDeclaration, [line 25](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L25).
- `notStubbed` — FunctionDeclaration, [line 34](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L34).
- `stubRepository` — FunctionDeclaration, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L40).
- `TokenCalls` — TypeAliasDeclaration, [line 55](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L55).
- `stubTokens` — FunctionDeclaration, [line 62](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L62).

## Static dependencies

- [apps/api/src/modules/auth/**tests**/factories/user.factory.ts](./apps--api--src--modules--auth--__tests__--factories--user.factory.ts.md)
- [apps/api/src/modules/auth/auth.repository.ts](./apps--api--src--modules--auth--auth.repository.ts.md)
- [apps/api/src/modules/auth/auth.service.ts](./apps--api--src--modules--auth--auth.service.ts.md)
- [apps/api/src/modules/auth/auth.types.ts](./apps--api--src--modules--auth--auth.types.ts.md)
- [apps/api/src/shared/auth/tokens.ts](./apps--api--src--shared--auth--tokens.ts.md)

Other import specifiers: `vitest`.

## Static consumers

No direct source-import consumers found; entry points, scripts, HTTP calls and document links can still use this file.

## Named test cases and groups

- AuthService.loginWithPassword ([line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L92)).
- issues an access token and a refresh token for correct credentials ([line 93](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L93)).
- puts the role scopes on the returned user, not just the role ([line 110](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L110)).
- rejects a wrong password ([line 127](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L127)).
- gives the same message for an unknown email as for a wrong password ([line 139](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L139)).
- refuses a disabled account even with the correct password ([line 158](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L158)).
- AuthService.refresh ([line 174](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L174)).
- rotates a valid refresh token into a new pair ([line 175](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L175)).
- rejects a refresh token that has already been used ([line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L188)).
- rejects a refresh for an account that has since been disabled ([line 198](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L198)).
- AuthService.logout ([line 212](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L212)).
- revokes the refresh token and denylists the current access token ([line 213](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L213)).
- still denylists the access token when no refresh cookie was presented ([line 224](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L224)).
- AuthService.registerUser ([line 234](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L234)).
- rejects a password that fails the policy before touching the database ([line 235](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L235)).
- rejects an email domain with no registered organisation ([line 249](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L249)).
- creates the user against the organisation resolved from the email domain ([line 263](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L263)).
- refuses to create a second account with the same email ([line 292](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/modules/auth/__tests__/auth.service.test.ts#L292)).

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `5885c4e7cf8acc5ac27c81b3a2b1c5df1decfbf959b4e4fc03f822c564178041`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
