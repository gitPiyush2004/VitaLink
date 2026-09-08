# ADR-0004: Express 5's native async handling, no `asyncHandler` wrapper

- Status: accepted
- Date: 2026-09-08

## Context

In Express 4, an `async` route handler that rejects does not reach the error
middleware — the request hangs until it times out. The standard fix is a wrapper:

```js
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

The spec (PART 3A.5 rule 2) says to pick one approach and be consistent.

## Options considered

**Express 4 + `asyncHandler` on every route.** The pattern most tutorials show, so
the most recognisable. Requires remembering the wrapper on every single async
handler; forgetting one produces a hanging request that is hard to diagnose.

**Express 5 native forwarding.** Express 5 forwards a rejected promise from a
handler to the error middleware automatically. Nothing to remember, nothing to
forget.

## Decision

Express 5, no wrapper. Handlers are plain `async` functions and typed errors
propagate to `shared/middleware/error-handler.ts` on their own.

## Consequences

- No wrapper to forget, so the hanging-request failure mode does not exist.
- `requireAuth` is a bare `async` middleware that throws `UnauthenticatedError`,
  and that becomes a 401 with no plumbing.
- **Worth being able to explain:** "where is your asyncHandler?" is a reasonable
  interview question, and the answer is that it solves an Express 4 problem that
  Express 5 fixed upstream. Knowing _why_ the wrapper existed is the point; adding
  it to Express 5 would be cargo cult.
- Middleware written for Express 4 that mutates `req.query` needs care, because
  Express 5 makes it a getter. `shared/middleware/validate.ts` uses
  `Object.defineProperty` for exactly this reason, with a comment.
