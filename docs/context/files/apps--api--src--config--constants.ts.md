---
source: 'apps/api/src/config/constants.ts'
component: shared
generated: true
---

# apps/api/src/config/constants.ts

[Source on GitHub](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts) · [File index](../FILE_INDEX.md) · [Architecture](../03_SYSTEM_ARCHITECTURE.md) · [Data boundaries](../04_DATA_AND_EVIDENCE.md)

## Responsibility

Names shared limits, TTLs and numeric infrastructure constants so business code avoids unexplained literals.

**Component:** Supplies API configuration, authentication, persistence, HTTP/middleware and composition infrastructure.

## Source structure

- `MS_PER_SECOND` — binding, [line 13](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L13).
- `SECONDS_PER_MINUTE` — binding, [line 14](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L14).
- `MINUTES_PER_HOUR` — binding, [line 15](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L15).
- `HOURS_PER_DAY` — binding, [line 16](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L16).
- `MS_PER_MINUTE` — binding, [line 17](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L17).
- `MS_PER_HOUR` — binding, [line 18](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L18).
- `MS_PER_DAY` — binding, [line 19](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L19).
- `DAYS_PER_YEAR` — binding, [line 20](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L20).
- `API_PREFIX` — binding, [line 26](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L26).
- `JSON_BODY_LIMIT` — binding, [line 29](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L29).
- `WEBHOOK_BODY_LIMIT` — binding, [line 32](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L32).
- `SHUTDOWN_GRACE_MS` — binding, [line 35](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L35).
- `MONGO_SERVER_SELECTION_TIMEOUT_MS` — binding, [line 38](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L38).
- `RATE_LIMIT_WINDOW_MS` — binding, [line 40](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L40).
- `RATE_LIMIT_MAX_PER_USER` — binding, [line 41](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L41).
- `RATE_LIMIT_MAX_PER_ORG` — binding, [line 42](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L42).
- `PASSWORD_HASH_ROUNDS` — binding, [line 49](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L49).
- `MIN_PASSWORD_LENGTH` — binding, [line 50](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L50).
- `REFRESH_COOKIE_NAME` — binding, [line 52](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L52).
- `OAUTH_STATE_COOKIE_NAME` — binding, [line 53](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L53).
- `OAUTH_VERIFIER_COOKIE_NAME` — binding, [line 54](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L54).
- `OAUTH_STATE_TTL_SECONDS` — binding, [line 56](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L56).
- `WEBHOOK_REPLAY_WINDOW_SECONDS` — binding, [line 59](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L59).
- `CLUSTER_WINDOW_DAYS` — binding, [line 72](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L72).
- `MIN_INDEPENDENT_SOURCES` — binding, [line 75](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L75).
- `MIN_VERACITY_TO_PUBLISH` — binding, [line 78](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L78).
- `DEDUPE_SIMILARITY_THRESHOLD` — binding, [line 81](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L81).
- `DEDUPE_SHINGLE_SIZE` — binding, [line 82](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L82).
- `VERACITY_RECENCY_HALF_LIFE_DAYS` — binding, [line 85](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L85).
- `DEFAULT_CASCADE_DECAY` — binding, [line 92](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L92).
- `DEFAULT_CASCADE_MAX_DEPTH` — binding, [line 95](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L95).
- `MAX_PATHS_PER_DRUG` — binding, [line 98](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L98).
- `SAFETY_COVER_DAYS` — binding, [line 101](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L101).
- `COVER_PROJECTION_DAYS` — binding, [line 104](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L104).
- `COVER_BAND_RELATIVE_WIDTH` — binding, [line 111](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L111).
- `PAPER_BASELINE` — binding, [line 122](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L122).
- `MIN_EVENTS_TO_FIT_RATE` — binding, [line 132](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L132).
- `Z_API_TAIL_SHARE_THRESHOLD` — binding, [line 141](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L141).
- `MODELLED_BAND_RELATIVE_WIDTH` — binding, [line 144](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L144).
- `CARRIER_TIMEOUT_MS` — binding, [line 151](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L151).
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD` — binding, [line 154](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L154).
- `CIRCUIT_BREAKER_OPEN_MS` — binding, [line 155](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L155).
- `NEUTRAL_SUB_SCORE` — binding, [line 162](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L162).
- `CARRIER_RAW_ARCHIVE_TTL_SECONDS` — binding, [line 172](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L172).
- `HASH_PREFIX_LENGTH` — binding, [line 176](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L176).
- `DEADLINE_SAFETY_MARGIN_DAYS` — binding, [line 179](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L179).
- `URGENCY_COVER_DAYS` — binding, [line 182](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L182).
- `URGENCY_ESCALATION_SEVERITY` — binding, [line 189](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L189).
- `URGENCY_ESCALATION_POPULATION` — binding, [line 192](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L192).
- `AIR_VOLUMETRIC_DIVISOR_KG_PER_M3` — binding, [line 195](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L195).
- `CO2_KG_PER_TONNE_KM` — binding, [line 198](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L198).
- `DEFAULT_PAGE_SIZE` — binding, [line 210](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L210).
- `MAX_PAGE_SIZE` — binding, [line 211](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L211).
- `MAX_GRAPH_NEIGHBOURS` — binding, [line 214](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L214).
- `MAX_SCENARIOS_PER_MATRIX` — binding, [line 215](https://github.com/gitPiyush2004/VitaLink/blob/main/apps/api/src/config/constants.ts#L215).

## Static dependencies

No resolved repository source imports.

Other import specifiers: none.

## Static consumers

- [apps/api/src/app.ts](./apps--api--src--app.ts.md)
- [apps/api/src/main.ts](./apps--api--src--main.ts.md)
- [apps/api/src/modules/auth/auth.controller.ts](./apps--api--src--modules--auth--auth.controller.ts.md)
- [apps/api/src/modules/auth/auth.service.ts](./apps--api--src--modules--auth--auth.service.ts.md)
- [apps/api/src/modules/auth/domain/password-policy.ts](./apps--api--src--modules--auth--domain--password-policy.ts.md)
- [apps/api/src/modules/cascade/**tests**/cover-projection.test.ts](./apps--api--src--modules--cascade--__tests__--cover-projection.test.ts.md)
- [apps/api/src/modules/cascade/cascade.service.ts](./apps--api--src--modules--cascade--cascade.service.ts.md)
- [apps/api/src/modules/cascade/domain/cover-projection.ts](./apps--api--src--modules--cascade--domain--cover-projection.ts.md)
- [apps/api/src/modules/catalog/catalog.repository.ts](./apps--api--src--modules--catalog--catalog.repository.ts.md)
- [apps/api/src/modules/catalog/domain/redundancy-derivation.ts](./apps--api--src--modules--catalog--domain--redundancy-derivation.ts.md)
- [apps/api/src/modules/graph/graph.repository.ts](./apps--api--src--modules--graph--graph.repository.ts.md)
- [apps/api/src/modules/graph/graph.service.ts](./apps--api--src--modules--graph--graph.service.ts.md)
- [apps/api/src/modules/logistics/domain/recommend.ts](./apps--api--src--modules--logistics--domain--recommend.ts.md)
- [apps/api/src/modules/logistics/domain/shipment-derivation.ts](./apps--api--src--modules--logistics--domain--shipment-derivation.ts.md)
- [apps/api/src/modules/logistics/domain/sub-scores.ts](./apps--api--src--modules--logistics--domain--sub-scores.ts.md)
- [apps/api/src/modules/logistics/domain/urgency.ts](./apps--api--src--modules--logistics--domain--urgency.ts.md)
- [apps/api/src/modules/logistics/logistics.service.ts](./apps--api--src--modules--logistics--logistics.service.ts.md)
- [apps/api/src/modules/scenarios/domain/enumerate.ts](./apps--api--src--modules--scenarios--domain--enumerate.ts.md)
- [apps/api/src/modules/scenarios/domain/outcome-terms.ts](./apps--api--src--modules--scenarios--domain--outcome-terms.ts.md)
- [apps/api/src/modules/scenarios/scenarios.service.ts](./apps--api--src--modules--scenarios--scenarios.service.ts.md)
- [apps/api/src/modules/signals/**tests**/verify.test.ts](./apps--api--src--modules--signals--__tests__--verify.test.ts.md)
- [apps/api/src/modules/signals/domain/ingest-mappers.ts](./apps--api--src--modules--signals--domain--ingest-mappers.ts.md)
- [apps/api/src/modules/signals/domain/simhash.ts](./apps--api--src--modules--signals--domain--simhash.ts.md)
- [apps/api/src/modules/signals/domain/veracity.ts](./apps--api--src--modules--signals--domain--veracity.ts.md)
- [apps/api/src/modules/signals/signals.adjudicate.ts](./apps--api--src--modules--signals--signals.adjudicate.ts.md)
- [apps/api/src/modules/signals/signals.queries.ts](./apps--api--src--modules--signals--signals.queries.ts.md)
- [apps/api/src/modules/signals/signals.verify.ts](./apps--api--src--modules--signals--signals.verify.ts.md)
- [apps/api/src/shared/auth/tokens.ts](./apps--api--src--shared--auth--tokens.ts.md)
- [apps/api/src/shared/connectors/carriers.ts](./apps--api--src--shared--connectors--carriers.ts.md)
- [apps/api/src/shared/db/mongo.ts](./apps--api--src--shared--db--mongo.ts.md)
- [apps/api/src/shared/http/pagination.ts](./apps--api--src--shared--http--pagination.ts.md)
- [apps/api/src/shared/middleware/rate-limit.ts](./apps--api--src--shared--middleware--rate-limit.ts.md)

## Maintenance and verification

Inspect the source and direct dependencies before changing behavior. Use [validation guidance](../07_LOCAL_SETUP_AND_VALIDATION.md) and the relevant component tests. Dependency edges are static imports/re-exports, not a complete call graph. Declarations are structural evidence, not a claim that an integration ran.

Source SHA-256: `99d198d728668499b4ee45c2949217afea0b4f4a2facf5cafcc6290b4a9b4314`.

Generated by `npm run docs:context`; edit curated roles or authored overview notes, then regenerate. Do not edit this card manually.
