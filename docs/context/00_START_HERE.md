# VitaLink project context

VitaLink is a pharmaceutical disruption investigation workspace. It helps an analyst answer: **What happened, which medicine does the evidence actually identify, what might be exposed, and what response can we justify?**

This vault records the project direction, current implementation and source-level context for the capstone's final review of academic Phase 1. The review rubric and deadline have not been supplied. Engineering stages and older build-log phases are not academic review milestones.

## Read in this order

1. [Project purpose](01_PROJECT_PURPOSE.md): the user, problem and public-data workaround.
2. [Current state](02_CURRENT_STATE.md): implemented features and material gaps.
3. [Architecture](03_SYSTEM_ARCHITECTURE.md): processes, boundaries and request flow.
4. [Data and evidence](04_DATA_AND_EVIDENCE.md): what each source can establish.
5. [Workflows](05_FEATURE_WORKFLOWS.md): using the connected investigation.
6. [Review and roadmap](06_REVIEW_AND_ROADMAP.md): review claims and proposed work.
7. [Setup and validation](07_LOCAL_SETUP_AND_VALIDATION.md): reproducible checks.
8. [Decisions and history](08_DECISIONS_AND_HISTORY.md): why the scope changed.
9. [Original-plan assessment](09_ORIGINAL_PLAN.md): ambition versus observability.
10. [Competitor research](10_COMPETITOR_RESEARCH.md): sources and implications.
11. [Candidate and forecast audit](11_CANDIDATE_AND_FORECAST_AUDIT.md): dated source checks, fixes and historical-data feasibility.
12. [Historical-data layer](12_HISTORICAL_DATA_LAYER.md): immutable archive collection, observed histories and coverage gaps.
13. [Conditional persistence evaluation](13_PERSISTENCE_EVALUATION.md): frozen temporal baselines, exclusions and limits.
14. [Phase 1 review readiness](14_PHASE1_REVIEW_READINESS.md): completed scope, acceptance evidence, technical audit and honest review claims.
15. [Globe workspace](15_GLOBE_WORKSPACE.md): globe-first interaction, cartography, national scope and camera context.
16. [File index](FILE_INDEX.md): context for every versionable file outside this vault.

## Using this as an Obsidian vault

Open the repository's `docs/context` folder as a vault. Notes use ordinary Markdown links so they also work on GitHub. Open this note first. Backlinks and graph view connect the architecture, constraints and file notes. Local `.obsidian` preferences are ignored by Git; no plugins or Obsidian account are required.

Example CLI commands after opening the folder:

```sh
obsidian read vault=context path=00_START_HERE.md
obsidian search vault=context query="UNVERIFIED_SCHEMA"
obsidian backlinks vault=context path=04_DATA_AND_EVIDENCE.md
obsidian unresolved vault=context total
```

The vault name is the folder name, `context`; if multiple vaults share that name, select this vault explicitly in Obsidian before using the CLI. The overview notes were authored through the official Obsidian CLI. File notes are generated from the source inventory and TypeScript/Python syntax, with curated component responsibilities. Regenerate them with `npm run docs:context`; check coverage, fingerprints and local links with `npm run docs:context:check`.

Generated notes describe structure, not proof of runtime correctness. They exclude secrets, dependencies, build outputs, private databases and local acceptance accounts. Dependency links cover static source imports; dynamic calls, HTTP boundaries and persistence are explained in the architecture and workflow notes.

## Maintaining the context

Update the relevant overview when behavior or product scope changes, then regenerate the file notes. Keep current facts separate from historical decisions and proposals. A connector, environment variable, test or attractive map is not evidence that an integration has run successfully.
