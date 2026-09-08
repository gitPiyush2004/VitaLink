# ADR-0002: CommonJS for the Node services, ESM for the browser

- Status: accepted
- Date: 2026-09-08

## Context

The repository has to pick a module system for `apps/api`, `apps/workers` and the
shared packages. `apps/web` is a separate question because Vite is ESM-native.

## Options considered

**ESM everywhere (`"type": "module"`).** Modern and where the ecosystem is going.
Costs: with `moduleResolution: "nodenext"`, every relative import must carry a
`.js` extension in the TypeScript source — `import { x } from './thing.js'` in a
file called `thing.ts`. That is genuinely confusing to read, and this codebase has
a second job, which is to teach.

**CommonJS for Node, ESM for the browser.** Extension-free relative imports,
`tsconfig` path aliases work without extra tooling, every Express and Mongoose
tutorial matches what is on screen.

## Decision

CommonJS for `apps/api`, `apps/workers` and `packages/*`. ESM for `apps/web` and
for the tooling configs that require it (`eslint.config.mjs`,
`vitest.config.mts`).

## Consequences

- Relative imports have no extensions, which is what a reader expects.
- No top-level `await` in the Node services or in `scripts/`. `void main()` at the
  bottom of a script instead. This bit once, in `scripts/probe-sources.ts`, and
  the comment there explains why.
- The shared packages are consumed as TypeScript source rather than build output,
  so the same files serve both module systems and there is no dual-build to keep
  in sync. See ADR-0003.
- Reversible: switching to ESM later is a `tsconfig` change plus a codemod that
  adds extensions. It is not a design lock-in.
