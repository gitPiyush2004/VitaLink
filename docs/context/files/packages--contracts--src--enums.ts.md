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
- `signalSourceSchema` — binding, [line 108](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L108).
- `SignalSource` — TypeAliasDeclaration, [line 109](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L109).
- `DISRUPTION_CATEGORIES` — binding, [line 112](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L112).
- `disruptionCategorySchema` — binding, [line 126](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L126).
- `DisruptionCategory` — TypeAliasDeclaration, [line 127](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L127).
- `VERIFICATION_ARMS` — binding, [line 130](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L130).
- `verificationArmSchema` — binding, [line 131](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L131).
- `VerificationArm` — TypeAliasDeclaration, [line 132](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L132).
- `QUARANTINE_REASONS` — binding, [line 135](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L135).
- `quarantineReasonSchema` — binding, [line 142](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L142).
- `QuarantineReason` — TypeAliasDeclaration, [line 143](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L143).
- `CARRIER_IDS` — binding, [line 149](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L149).
- `carrierIdSchema` — binding, [line 150](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L150).
- `CarrierId` — TypeAliasDeclaration, [line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L151).
- `CARRIER_TIERS` — binding, [line 159](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L159).
- `carrierTierSchema` — binding, [line 160](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L160).
- `CarrierTier` — TypeAliasDeclaration, [line 161](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L161).
- `QUOTE_STATUSES` — binding, [line 164](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L164).
- `quoteStatusSchema` — binding, [line 171](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L171).
- `QuoteStatus` — TypeAliasDeclaration, [line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L172).
- `UNAVAILABLE_REASONS` — binding, [line 175](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L175).
- `unavailableReasonSchema` — binding, [line 186](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L186).
- `UnavailableReason` — TypeAliasDeclaration, [line 187](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L187).
- `TRANSPORT_MODES` — binding, [line 189](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L189).
- `transportModeSchema` — binding, [line 190](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L190).
- `TransportMode` — TypeAliasDeclaration, [line 191](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L191).
- `NORMALISED_SERVICES` — binding, [line 193](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L193).
- `normalisedServiceSchema` — binding, [line 194](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L194).
- `NormalisedService` — TypeAliasDeclaration, [line 195](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L195).
- `TEMPERATURE_RANGES` — binding, [line 198](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L198).
- `temperatureRangeSchema` — binding, [line 199](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L199).
- `TemperatureRange` — TypeAliasDeclaration, [line 200](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L200).
- `SPECIAL_HANDLING` — binding, [line 202](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L202).
- `specialHandlingSchema` — binding, [line 210](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L210).
- `SpecialHandling` — TypeAliasDeclaration, [line 211](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L211).
- `URGENCY_LEVELS` — binding, [line 213](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L213).
- `urgencySchema` — binding, [line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L214).
- `Urgency` — TypeAliasDeclaration, [line 215](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L215).
- `TRACKING_GRANULARITIES` — binding, [line 217](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L217).
- `trackingGranularitySchema` — binding, [line 218](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L218).
- `TrackingGranularity` — TypeAliasDeclaration, [line 219](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L219).
- `INELIGIBILITY_REASONS` — binding, [line 225](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L225).
- `ineligibilityReasonSchema` — binding, [line 236](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L236).
- `IneligibilityReason` — TypeAliasDeclaration, [line 237](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L237).
- `capabilityFlagSchema` — binding, [line 243](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L243).
- `CapabilityFlag` — TypeAliasDeclaration, [line 244](https://github.com/gitPiyush2004/VitaLink/blob/main/packages/contracts/src/enums.ts#L244).

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

Source SHA-256: `872075707a5bee6258d0e68179859d40b820cb6d665d35614c212647e711f06a`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
