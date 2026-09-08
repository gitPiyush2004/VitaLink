# ADR-0003: Workspace packages are consumed as source, and services run via tsx

- Status: accepted
- Date: 2026-09-08

## Context

`packages/contracts` is imported by the React app, the Express API and the BullMQ
workers. Those have different module systems and different bundlers. The
conventional monorepo answer is to build each package to `dist/` and have
consumers import the build output.

## Options considered

**Build each package (tsup / tsc + declarations).** Correct and conventional at
scale. Costs a build step per package, a watch mode in development, and a class of
"stale dist" bugs where a change is invisible until something is rebuilt.

**Consume packages as TypeScript source** ("just-in-time packages", what Turborepo
calls internal packages). Consumers point their `paths` at `src/index.ts`. No
build step, no staleness, one set of files serving both module systems.

## Decision

Packages are consumed as source. The Node services are run with `tsx` — including
in the Docker images — rather than compiled to `dist/` and run with `node`.
`tsc --noEmit` runs in CI for typechecking.

## Consequences

- No package build step, so no stale-`dist` failure mode and no watch processes.
- Typechecking is a separate concern from running, which is arguably clearer: CI
  proves the types, `tsx` runs the code.
- **The honest cost:** `tsx` transpiles with esbuild and does not typecheck at
  runtime, so a type error only surfaces in CI, not on `npm run dev`. Startup is
  also slightly slower than `node dist/main.js`.
- **What a production deployment would change:** bundle each service with `tsup`
  into a single file and run it on plain `node`. That is one config file per
  service and changes no application code. It was not done here because the
  research question does not involve deployment, and the build complexity would be
  paid for on every phase for no benefit.
