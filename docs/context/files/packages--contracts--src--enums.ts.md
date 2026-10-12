---
source: 'packages/contracts/src/enums.ts'
component: contracts
generated: true
---

# packages/contracts/src/enums.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Supports this component through the configuration or source declarations identified below; consult the linked source for full behavior.

**Component:** Defines shared runtime-validated domain contracts and provenance envelopes for observations, derived values, models and assumptions.

## Source structure

- `ROLES` — binding, [line 16](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L16).
- `roleSchema` — binding, [line 24](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L24).
- `Role` — TypeAliasDeclaration, [line 25](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L25).
- `SCOPES` — binding, [line 28](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L28).
- `scopeSchema` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L52).
- `Scope` — TypeAliasDeclaration, [line 53](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L53).
- `NODE_TYPES` — binding, [line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L59).
- `nodeTypeSchema` — binding, [line 70](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L70).
- `NodeType` — TypeAliasDeclaration, [line 71](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L71).
- `EDGE_RELATIONS` — binding, [line 73](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L73).
- `edgeRelationSchema` — binding, [line 83](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L83).
- `EdgeRelation` — TypeAliasDeclaration, [line 84](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L84).
- `SIGNAL_SOURCES` — binding, [line 90](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L90).
- `signalSourceSchema` — binding, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L109).
- `SignalSource` — TypeAliasDeclaration, [line 110](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L110).
- `DISRUPTION_CATEGORIES` — binding, [line 113](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L113).
- `disruptionCategorySchema` — binding, [line 127](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L127).
- `DisruptionCategory` — TypeAliasDeclaration, [line 128](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L128).
- `VERIFICATION_ARMS` — binding, [line 131](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L131).
- `verificationArmSchema` — binding, [line 132](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L132).
- `VerificationArm` — TypeAliasDeclaration, [line 133](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L133).
- `QUARANTINE_REASONS` — binding, [line 136](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L136).
- `quarantineReasonSchema` — binding, [line 143](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L143).
- `QuarantineReason` — TypeAliasDeclaration, [line 144](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L144).
- `CARRIER_IDS` — binding, [line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L150).
- `carrierIdSchema` — binding, [line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L151).
- `CarrierId` — TypeAliasDeclaration, [line 152](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L152).
- `CARRIER_TIERS` — binding, [line 160](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L160).
- `carrierTierSchema` — binding, [line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L161).
- `CarrierTier` — TypeAliasDeclaration, [line 162](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L162).
- `QUOTE_STATUSES` — binding, [line 165](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L165).
- `quoteStatusSchema` — binding, [line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L172).
- `QuoteStatus` — TypeAliasDeclaration, [line 173](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L173).
- `UNAVAILABLE_REASONS` — binding, [line 176](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L176).
- `unavailableReasonSchema` — binding, [line 187](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L187).
- `UnavailableReason` — TypeAliasDeclaration, [line 188](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L188).
- `TRANSPORT_MODES` — binding, [line 190](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L190).
- `transportModeSchema` — binding, [line 191](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L191).
- `TransportMode` — TypeAliasDeclaration, [line 192](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L192).
- `NORMALISED_SERVICES` — binding, [line 194](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L194).
- `normalisedServiceSchema` — binding, [line 195](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L195).
- `NormalisedService` — TypeAliasDeclaration, [line 196](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L196).
- `TEMPERATURE_RANGES` — binding, [line 199](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L199).
- `temperatureRangeSchema` — binding, [line 200](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L200).
- `TemperatureRange` — TypeAliasDeclaration, [line 201](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L201).
- `SPECIAL_HANDLING` — binding, [line 203](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L203).
- `specialHandlingSchema` — binding, [line 211](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L211).
- `SpecialHandling` — TypeAliasDeclaration, [line 212](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L212).
- `URGENCY_LEVELS` — binding, [line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L214).
- `urgencySchema` — binding, [line 215](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L215).
- `Urgency` — TypeAliasDeclaration, [line 216](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L216).
- `TRACKING_GRANULARITIES` — binding, [line 218](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L218).
- `trackingGranularitySchema` — binding, [line 219](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L219).
- `TrackingGranularity` — TypeAliasDeclaration, [line 220](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L220).
- `INELIGIBILITY_REASONS` — binding, [line 226](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L226).
- `ineligibilityReasonSchema` — binding, [line 237](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L237).
- `IneligibilityReason` — TypeAliasDeclaration, [line 238](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L238).
- `capabilityFlagSchema` — binding, [line 244](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L244).
- `CapabilityFlag` — TypeAliasDeclaration, [line 245](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L245).

## Static dependencies

No resolved repository source imports.

Other import specifiers: `zod`.

## Static consumers

- [packages/contracts/src/auth.ts](./packages--contracts--src--auth.ts.md)
- [packages/contracts/src/catalog.ts](./packages--contracts--src--catalog.ts.md)
- [packages/contracts/src/events.ts](./packages--contracts--src--events.ts.md)
- [packages/contracts/src/graph.ts](./packages--contracts--src--graph.ts.md)
- [packages/contracts/src/index.ts](./packages--contracts--src--index.ts.md)
- [packages/contracts/src/logistics-decision.ts](./packages--contracts--src--logistics-decision.ts.md)
- [packages/contracts/src/logistics.ts](./packages--contracts--src--logistics.ts.md)
- [packages/contracts/src/scenarios.ts](./packages--contracts--src--scenarios.ts.md)
- [packages/contracts/src/signals.ts](./packages--contracts--src--signals.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `0d14a6b7ccbb1d27f6e8063ebbe014066f8effc8d389c24126e64c5ac40da831`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
