# VitaLink contributor context

Read [the context entry point](docs/context/00_START_HERE.md), especially current state, data boundaries and the roadmap, before changing product behavior. Use the file index to locate implementation and dependencies. Earlier build logs and the original master plan record history; they are not proof of current integration status.

## Project boundaries

- The first working use case is a public-evidence pharmaceutical disruption investigation for FDA-regulated products.
- Do not fabricate supplier offers, hospital inventory, facilities, routes, carrier prices or exposure numbers. Preserve unknowns and source coverage.
- Retain REAL/DERIVED/MODELLED/SCENARIO provenance. Labeler associations do not prove API suppliers or plants. Recall applicability remains limited by identifiers and lots.
- Keep mock carrier mode off for real-data operation. Five carrier adapters are unavailable stubs; DSV quote mapping is unverified. Environment fields alone do not complete integrations.
- Candidate discovery, cost benchmarks and route-exposure comparison are proposed additions, not completed workflows. Do not claim substitution equivalence or predict delays without applicable evidence and validation.

## Implementation conventions

Follow existing route → controller → service → repository/domain layering. Cross-module calls use public interfaces. Mongoose access belongs in repositories/models; external HTTP belongs in `packages/connectors`. Keep organisation scope and optimistic case-write checks intact.

Use meaningful tests for behavior changes. Run `npm run verify`; numerical changes also need the brain's ruff, mypy and pytest checks. Inspect production web build warnings when UI/dependency changes warrant it. Docker configuration is supplied but has not been executed on the original development host.

## Documentation and publication

Update the relevant authored overview when behavior or scope changes. Run `npm run docs:context` after source/config formatting, then `npm run docs:context:check`. Generated file notes should not be edited manually; curated responsibilities live in `scripts/docs/roles.json`.

Never commit `.env`, keys, private accounts/cases, local databases/logs or `.obsidian` preferences. Do not confuse an engineering acceptance scenario with an actual hospital or commercial transaction. Document validation results and unresolved limits without claiming forecast accuracy from tests or source counts.
