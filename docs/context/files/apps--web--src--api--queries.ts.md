---
source: 'apps/web/src/api/queries.ts'
component: web
generated: true
---

# apps/web/src/api/queries.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Supports this component through the configuration or source declarations identified below; consult the linked source for full behavior.

**Component:** Presents the authenticated analyst workspace and earlier stage tools; source facts and scenario assumptions stay distinguishable.

## Source structure

- `SignalRow` — TypeAliasDeclaration, [line 23](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L23).
- `AlertRow` — TypeAliasDeclaration, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L42).
- `QuarantineRow` — TypeAliasDeclaration, [line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L59).
- `listSignals` — binding, [line 69](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L69).
- `listAlerts` — binding, [line 72](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L72).
- `listQuarantine` — binding, [line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L75).
- `quarantineSummary` — binding, [line 78](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L78).
- `IngestOutcome` — TypeAliasDeclaration, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L81).
- `runIngest` — binding, [line 87](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L87).
- `VerifyOutcome` — TypeAliasDeclaration, [line 90](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L90).
- `runVerify` — binding, [line 99](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L99).
- `DrugRow` — TypeAliasDeclaration, [line 106](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L106).
- `listDrugs` — binding, [line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L122).
- `ExposedDrug` — TypeAliasDeclaration, [line 125](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L125).
- `CascadeRow` — TypeAliasDeclaration, [line 145](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L145).
- `listCascades` — binding, [line 167](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L167).
- `getCascade` — binding, [line 170](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L170).
- `runCascade` — binding, [line 173](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L173).
- `SubScoreRow` — TypeAliasDeclaration, [line 184](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L184).
- `RecommendationRow` — TypeAliasDeclaration, [line 193](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L193).
- `listRecommendations` — binding, [line 229](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L229).
- `getRecommendation` — binding, [line 232](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L232).
- `ShipmentRow` — TypeAliasDeclaration, [line 235](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L235).
- `listShipments` — binding, [line 254](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L254).
- `CarrierRow` — TypeAliasDeclaration, [line 257](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L257).
- `listCarriers` — binding, [line 274](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L274).
- `recommendFromCascade` — binding, [line 277](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L277).
- `ScenarioRow` — TypeAliasDeclaration, [line 292](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L292).
- `ScenarioRunRow` — TypeAliasDeclaration, [line 312](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L312).
- `listScenarioRuns` — binding, [line 347](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L347).
- `getScenarioRun` — binding, [line 350](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L350).
- `runScenarios` — binding, [line 353](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/web/src/api/queries.ts#L353).

## Static dependencies

- [apps/web/src/api/client.ts](./apps--web--src--api--client.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)

Other import specifiers: none.

## Static consumers

- [apps/web/src/api/overview.ts](./apps--web--src--api--overview.ts.md)
- [apps/web/src/operations/LogisticsPanel.tsx](./apps--web--src--operations--LogisticsPanel.tsx.md)
- [apps/web/src/operations/NewsPanel.tsx](./apps--web--src--operations--NewsPanel.tsx.md)
- [apps/web/src/operations/TracePanel.tsx](./apps--web--src--operations--TracePanel.tsx.md)
- [apps/web/src/views/CascadeView.tsx](./apps--web--src--views--CascadeView.tsx.md)
- [apps/web/src/views/CatalogView.tsx](./apps--web--src--views--CatalogView.tsx.md)
- [apps/web/src/views/DecideView.tsx](./apps--web--src--views--DecideView.tsx.md)
- [apps/web/src/views/LogisticsView.tsx](./apps--web--src--views--LogisticsView.tsx.md)
- [apps/web/src/views/SenseView.tsx](./apps--web--src--views--SenseView.tsx.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `bf664dfdb9dc2b004d43ebdadc3d97294ccfb2b2d84333431c5bf1d229efbc61`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
