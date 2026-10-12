# Repository file index

413 versionable files outside this vault, each with a source note. Ignored secrets/runtime/dependencies and generated vault files are excluded. Notes include curated responsibility, extracted declarations/tests, static dependencies/consumers and source fingerprints. Coverage is checked by `npm run docs:context:check`.

[Start here](00_START_HERE.md) · [Architecture](03_SYSTEM_ARCHITECTURE.md) · [Current state](02_CURRENT_STATE.md) · [Validation](07_LOCAL_SETUP_AND_VALIDATION.md)

## auth

Authenticates users, isolates organisations and enforces roles, access-token and refresh-session rules.

- [apps/api/src/modules/auth/README.md](files/apps--api--src--modules--auth--README.md.md)
- [apps/api/src/modules/auth/**tests**/auth.service.test.ts](files/apps--api--src--modules--auth--__tests__--auth.service.test.ts.md)
- [apps/api/src/modules/auth/**tests**/factories/user.factory.ts](files/apps--api--src--modules--auth--__tests__--factories--user.factory.ts.md)
- [apps/api/src/modules/auth/**tests**/password-policy.test.ts](files/apps--api--src--modules--auth--__tests__--password-policy.test.ts.md)
- [apps/api/src/modules/auth/auth.controller.ts](files/apps--api--src--modules--auth--auth.controller.ts.md)
- [apps/api/src/modules/auth/auth.repository.ts](files/apps--api--src--modules--auth--auth.repository.ts.md)
- [apps/api/src/modules/auth/auth.routes.ts](files/apps--api--src--modules--auth--auth.routes.ts.md)
- [apps/api/src/modules/auth/auth.schema.ts](files/apps--api--src--modules--auth--auth.schema.ts.md)
- [apps/api/src/modules/auth/auth.service.ts](files/apps--api--src--modules--auth--auth.service.ts.md)
- [apps/api/src/modules/auth/auth.types.ts](files/apps--api--src--modules--auth--auth.types.ts.md)
- [apps/api/src/modules/auth/domain/password-policy.ts](files/apps--api--src--modules--auth--domain--password-policy.ts.md)
- [apps/api/src/modules/auth/index.ts](files/apps--api--src--modules--auth--index.ts.md)
- [apps/api/src/modules/auth/models/org.model.ts](files/apps--api--src--modules--auth--models--org.model.ts.md)
- [apps/api/src/modules/auth/models/user.model.ts](files/apps--api--src--modules--auth--models--user.model.ts.md)

## brain

Calculates the published reliability model and proxy-rate fits; formula reproduction is not validated forecasting.

- [apps/brain/Dockerfile](files/apps--brain--Dockerfile.md)
- [apps/brain/README.md](files/apps--brain--README.md.md)
- [apps/brain/app/**init**.py](files/apps--brain--app--__init__.py.md)
- [apps/brain/app/config.py](files/apps--brain--app--config.py.md)
- [apps/brain/app/domain/**init**.py](files/apps--brain--app--domain--__init__.py.md)
- [apps/brain/app/domain/paper_baseline.py](files/apps--brain--app--domain--paper_baseline.py.md)
- [apps/brain/app/domain/rate_estimation.py](files/apps--brain--app--domain--rate_estimation.py.md)
- [apps/brain/app/domain/reliability.py](files/apps--brain--app--domain--reliability.py.md)
- [apps/brain/app/main.py](files/apps--brain--app--main.py.md)
- [apps/brain/app/routers/**init**.py](files/apps--brain--app--routers--__init__.py.md)
- [apps/brain/app/routers/health.py](files/apps--brain--app--routers--health.py.md)
- [apps/brain/app/routers/reliability.py](files/apps--brain--app--routers--reliability.py.md)
- [apps/brain/app/schemas.py](files/apps--brain--app--schemas.py.md)
- [apps/brain/app/services/**init**.py](files/apps--brain--app--services--__init__.py.md)
- [apps/brain/app/services/reliability_service.py](files/apps--brain--app--services--reliability_service.py.md)
- [apps/brain/pyproject.toml](files/apps--brain--pyproject.toml.md)
- [apps/brain/requirements-dev.txt](files/apps--brain--requirements-dev.txt.md)
- [apps/brain/requirements.txt](files/apps--brain--requirements.txt.md)
- [apps/brain/tests/**init**.py](files/apps--brain--tests--__init__.py.md)
- [apps/brain/tests/test_rate_estimation.py](files/apps--brain--tests--test_rate_estimation.py.md)
- [apps/brain/tests/test_reliability.py](files/apps--brain--tests--test_reliability.py.md)
- [apps/brain/tests/test_reliability_api.py](files/apps--brain--tests--test_reliability_api.py.md)

## cascade

Traces a conditional upstream shock through observed associations and projects explicitly supplied days of cover.

- [apps/api/src/modules/cascade/**tests**/cover-projection.test.ts](files/apps--api--src--modules--cascade--__tests__--cover-projection.test.ts.md)
- [apps/api/src/modules/cascade/**tests**/exposure.test.ts](files/apps--api--src--modules--cascade--__tests__--exposure.test.ts.md)
- [apps/api/src/modules/cascade/cascade.controller.ts](files/apps--api--src--modules--cascade--cascade.controller.ts.md)
- [apps/api/src/modules/cascade/cascade.repository.ts](files/apps--api--src--modules--cascade--cascade.repository.ts.md)
- [apps/api/src/modules/cascade/cascade.routes.ts](files/apps--api--src--modules--cascade--cascade.routes.ts.md)
- [apps/api/src/modules/cascade/cascade.schema.ts](files/apps--api--src--modules--cascade--cascade.schema.ts.md)
- [apps/api/src/modules/cascade/cascade.service.ts](files/apps--api--src--modules--cascade--cascade.service.ts.md)
- [apps/api/src/modules/cascade/domain/cover-projection.ts](files/apps--api--src--modules--cascade--domain--cover-projection.ts.md)
- [apps/api/src/modules/cascade/domain/exposure.ts](files/apps--api--src--modules--cascade--domain--exposure.ts.md)
- [apps/api/src/modules/cascade/index.ts](files/apps--api--src--modules--cascade--index.ts.md)
- [apps/api/src/modules/cascade/models/cascade.model.ts](files/apps--api--src--modules--cascade--models--cascade.model.ts.md)

## catalog

Assembles observed product/label data and explicit redundancy proxies; labelers are not proven API suppliers or plants.

- [apps/api/src/modules/catalog/**tests**/redundancy-derivation.test.ts](files/apps--api--src--modules--catalog--__tests__--redundancy-derivation.test.ts.md)
- [apps/api/src/modules/catalog/**tests**/storage-parsing.test.ts](files/apps--api--src--modules--catalog--__tests__--storage-parsing.test.ts.md)
- [apps/api/src/modules/catalog/catalog.controller.ts](files/apps--api--src--modules--catalog--catalog.controller.ts.md)
- [apps/api/src/modules/catalog/catalog.repository.ts](files/apps--api--src--modules--catalog--catalog.repository.ts.md)
- [apps/api/src/modules/catalog/catalog.routes.ts](files/apps--api--src--modules--catalog--catalog.routes.ts.md)
- [apps/api/src/modules/catalog/catalog.schema.ts](files/apps--api--src--modules--catalog--catalog.schema.ts.md)
- [apps/api/src/modules/catalog/catalog.service.ts](files/apps--api--src--modules--catalog--catalog.service.ts.md)
- [apps/api/src/modules/catalog/catalog.types.ts](files/apps--api--src--modules--catalog--catalog.types.ts.md)
- [apps/api/src/modules/catalog/domain/drug-assembly.ts](files/apps--api--src--modules--catalog--domain--drug-assembly.ts.md)
- [apps/api/src/modules/catalog/domain/redundancy-derivation.ts](files/apps--api--src--modules--catalog--domain--redundancy-derivation.ts.md)
- [apps/api/src/modules/catalog/domain/storage-parsing.ts](files/apps--api--src--modules--catalog--domain--storage-parsing.ts.md)
- [apps/api/src/modules/catalog/index.ts](files/apps--api--src--modules--catalog--index.ts.md)
- [apps/api/src/modules/catalog/models/drug.model.ts](files/apps--api--src--modules--catalog--models--drug.model.ts.md)
- [apps/api/src/modules/catalog/models/ingredient.model.ts](files/apps--api--src--modules--catalog--models--ingredient.model.ts.md)
- [apps/api/src/modules/catalog/models/manufacturer.model.ts](files/apps--api--src--modules--catalog--models--manufacturer.model.ts.md)

## connectors

Owns typed external HTTP, source parsing, provenance, caching, retries, rate limits and adapter availability.

- [packages/connectors/README.md](files/packages--connectors--README.md.md)
- [packages/connectors/package.json](files/packages--connectors--package.json.md)
- [packages/connectors/src/**tests**/cached-client.test.ts](files/packages--connectors--src--__tests__--cached-client.test.ts.md)
- [packages/connectors/src/**tests**/decode-body.test.ts](files/packages--connectors--src--__tests__--decode-body.test.ts.md)
- [packages/connectors/src/**tests**/rate-limiter.test.ts](files/packages--connectors--src--__tests__--rate-limiter.test.ts.md)
- [packages/connectors/src/**tests**/retry.test.ts](files/packages--connectors--src--__tests__--retry.test.ts.md)
- [packages/connectors/src/**tests**/source-parsers.test.ts](files/packages--connectors--src--__tests__--source-parsers.test.ts.md)
- [packages/connectors/src/carriers/carrier-adapter.ts](files/packages--connectors--src--carriers--carrier-adapter.ts.md)
- [packages/connectors/src/carriers/carrier-registry.ts](files/packages--connectors--src--carriers--carrier-registry.ts.md)
- [packages/connectors/src/carriers/dsv.adapter.ts](files/packages--connectors--src--carriers--dsv.adapter.ts.md)
- [packages/connectors/src/carriers/dsv.contracts.ts](files/packages--connectors--src--carriers--dsv.contracts.ts.md)
- [packages/connectors/src/carriers/index.ts](files/packages--connectors--src--carriers--index.ts.md)
- [packages/connectors/src/carriers/mock-carrier.adapter.ts](files/packages--connectors--src--carriers--mock-carrier.adapter.ts.md)
- [packages/connectors/src/carriers/unavailable-carrier.adapter.ts](files/packages--connectors--src--carriers--unavailable-carrier.adapter.ts.md)
- [packages/connectors/src/http/cached-client.ts](files/packages--connectors--src--http--cached-client.ts.md)
- [packages/connectors/src/http/classify.ts](files/packages--connectors--src--http--classify.ts.md)
- [packages/connectors/src/http/connector-error.ts](files/packages--connectors--src--http--connector-error.ts.md)
- [packages/connectors/src/http/decode-body.ts](files/packages--connectors--src--http--decode-body.ts.md)
- [packages/connectors/src/http/index.ts](files/packages--connectors--src--http--index.ts.md)
- [packages/connectors/src/http/ports.ts](files/packages--connectors--src--http--ports.ts.md)
- [packages/connectors/src/http/rate-limiter.ts](files/packages--connectors--src--http--rate-limiter.ts.md)
- [packages/connectors/src/http/retry.ts](files/packages--connectors--src--http--retry.ts.md)
- [packages/connectors/src/http/slow-hosts.ts](files/packages--connectors--src--http--slow-hosts.ts.md)
- [packages/connectors/src/index.ts](files/packages--connectors--src--index.ts.md)
- [packages/connectors/src/reliability.client.ts](files/packages--connectors--src--reliability.client.ts.md)
- [packages/connectors/src/sources/**tests**/fda-archive.test.ts](files/packages--connectors--src--sources--__tests__--fda-archive.test.ts.md)
- [packages/connectors/src/sources/**tests**/fda-date.test.ts](files/packages--connectors--src--sources--__tests__--fda-date.test.ts.md)
- [packages/connectors/src/sources/**tests**/openfda-page.test.ts](files/packages--connectors--src--sources--__tests__--openfda-page.test.ts.md)
- [packages/connectors/src/sources/comtrade.client.ts](files/packages--connectors--src--sources--comtrade.client.ts.md)
- [packages/connectors/src/sources/fda-archive-csv.ts](files/packages--connectors--src--sources--fda-archive-csv.ts.md)
- [packages/connectors/src/sources/fda-archive-index.ts](files/packages--connectors--src--sources--fda-archive-index.ts.md)
- [packages/connectors/src/sources/fda-archive.client.ts](files/packages--connectors--src--sources--fda-archive.client.ts.md)
- [packages/connectors/src/sources/fda-csv-quotes.ts](files/packages--connectors--src--sources--fda-csv-quotes.ts.md)
- [packages/connectors/src/sources/fda-date.ts](files/packages--connectors--src--sources--fda-date.ts.md)
- [packages/connectors/src/sources/gdelt.client.ts](files/packages--connectors--src--sources--gdelt.client.ts.md)
- [packages/connectors/src/sources/geo.client.ts](files/packages--connectors--src--sources--geo.client.ts.md)
- [packages/connectors/src/sources/hazard.client.ts](files/packages--connectors--src--sources--hazard.client.ts.md)
- [packages/connectors/src/sources/index.ts](files/packages--connectors--src--sources--index.ts.md)
- [packages/connectors/src/sources/openfda.client.ts](files/packages--connectors--src--sources--openfda.client.ts.md)
- [packages/connectors/src/sources/source-registry.ts](files/packages--connectors--src--sources--source-registry.ts.md)
- [packages/connectors/tsconfig.json](files/packages--connectors--tsconfig.json.md)

## contracts

Defines shared runtime-validated domain contracts and provenance envelopes for observations, derived values, models and assumptions.

- [packages/contracts/README.md](files/packages--contracts--README.md.md)
- [packages/contracts/package.json](files/packages--contracts--package.json.md)
- [packages/contracts/src/**tests**/provenance.test.ts](files/packages--contracts--src--__tests__--provenance.test.ts.md)
- [packages/contracts/src/auth.ts](files/packages--contracts--src--auth.ts.md)
- [packages/contracts/src/cascade.ts](files/packages--contracts--src--cascade.ts.md)
- [packages/contracts/src/catalog.ts](files/packages--contracts--src--catalog.ts.md)
- [packages/contracts/src/common.ts](files/packages--contracts--src--common.ts.md)
- [packages/contracts/src/enums.ts](files/packages--contracts--src--enums.ts.md)
- [packages/contracts/src/events.ts](files/packages--contracts--src--events.ts.md)
- [packages/contracts/src/graph.ts](files/packages--contracts--src--graph.ts.md)
- [packages/contracts/src/history.ts](files/packages--contracts--src--history.ts.md)
- [packages/contracts/src/index.ts](files/packages--contracts--src--index.ts.md)
- [packages/contracts/src/limits.ts](files/packages--contracts--src--limits.ts.md)
- [packages/contracts/src/logistics-decision.ts](files/packages--contracts--src--logistics-decision.ts.md)
- [packages/contracts/src/logistics.ts](files/packages--contracts--src--logistics.ts.md)
- [packages/contracts/src/operational-archive.ts](files/packages--contracts--src--operational-archive.ts.md)
- [packages/contracts/src/operations.ts](files/packages--contracts--src--operations.ts.md)
- [packages/contracts/src/provenance.ts](files/packages--contracts--src--provenance.ts.md)
- [packages/contracts/src/reliability.ts](files/packages--contracts--src--reliability.ts.md)
- [packages/contracts/src/scenarios.ts](files/packages--contracts--src--scenarios.ts.md)
- [packages/contracts/src/signals.ts](files/packages--contracts--src--signals.ts.md)
- [packages/contracts/tsconfig.json](files/packages--contracts--tsconfig.json.md)

## documentation

Explains decisions, development history and limitations; historical intentions are distinct from current implemented behavior.

- [docs/BUILD_LOG.md](files/docs--BUILD_LOG.md.md)
- [docs/CARRIER_STATUS.md](files/docs--CARRIER_STATUS.md.md)
- [docs/CODE_TOUR.md](files/docs--CODE_TOUR.md.md)
- [docs/LEARNING_NOTES.md](files/docs--LEARNING_NOTES.md.md)
- [docs/MODEL_CARDS.md](files/docs--MODEL_CARDS.md.md)
- [docs/adr/0001-redis-bullmq-over-rabbitmq.md](files/docs--adr--0001-redis-bullmq-over-rabbitmq.md.md)
- [docs/adr/0002-commonjs-over-esm.md](files/docs--adr--0002-commonjs-over-esm.md.md)
- [docs/adr/0003-packages-as-source-not-build-output.md](files/docs--adr--0003-packages-as-source-not-build-output.md.md)
- [docs/adr/0004-express-5-native-async.md](files/docs--adr--0004-express-5-native-async.md.md)
- [docs/adr/0005-compound-index-field-order.md](files/docs--adr--0005-compound-index-field-order.md.md)
- [docs/adr/0006-modular-monolith-no-kubernetes.md](files/docs--adr--0006-modular-monolith-no-kubernetes.md.md)
- [docs/adr/0007-in-process-rate-limiter.md](files/docs--adr--0007-in-process-rate-limiter.md.md)
- [docs/adr/0008-no-jitter-in-backoff.md](files/docs--adr--0008-no-jitter-in-backoff.md.md)
- [docs/adr/0009-public-osrm-demo-server.md](files/docs--adr--0009-public-osrm-demo-server.md.md)
- [docs/adr/0010-drug-collection-indexes.md](files/docs--adr--0010-drug-collection-indexes.md.md)
- [docs/adr/0011-edges-follow-supply-flow.md](files/docs--adr--0011-edges-follow-supply-flow.md.md)
- [docs/adr/0012-weight-profiles.md](files/docs--adr--0012-weight-profiles.md.md)
- [docs/adr/0013-connected-regulatory-investigations.md](files/docs--adr--0013-connected-regulatory-investigations.md.md)
- [docs/adr/0014-candidate-discovery-from-public-listings.md](files/docs--adr--0014-candidate-discovery-from-public-listings.md.md)

## evaluation

Audits frozen public snapshots for coverage and reproducibility; does not measure predictive accuracy.

- [eval/README.md](files/eval--README.md.md)
- [eval/audit.ts](files/eval--audit.ts.md)
- [eval/public-data-summary.ts](files/eval--public-data-summary.ts.md)
- [eval/public-data.ts](files/eval--public-data.ts.md)
- [eval/replay-public.ts](files/eval--replay-public.ts.md)

## graph

Builds coherent catalogue-backed ingredient/labeler associations; physical plant and delivery dependencies are unobserved.

- [apps/api/src/modules/graph/**tests**/build-graph.test.ts](files/apps--api--src--modules--graph--__tests__--build-graph.test.ts.md)
- [apps/api/src/modules/graph/domain/build-graph.ts](files/apps--api--src--modules--graph--domain--build-graph.ts.md)
- [apps/api/src/modules/graph/graph.repository.ts](files/apps--api--src--modules--graph--graph.repository.ts.md)
- [apps/api/src/modules/graph/graph.service.ts](files/apps--api--src--modules--graph--graph.service.ts.md)
- [apps/api/src/modules/graph/index.ts](files/apps--api--src--modules--graph--index.ts.md)
- [apps/api/src/modules/graph/models/graph-edge.model.ts](files/apps--api--src--modules--graph--models--graph-edge.model.ts.md)
- [apps/api/src/modules/graph/models/graph-node.model.ts](files/apps--api--src--modules--graph--models--graph-node.model.ts.md)

## graph-package

Provides reusable graph representation, traversal and metrics independent of API storage.

- [packages/graph/package.json](files/packages--graph--package.json.md)
- [packages/graph/src/**tests**/metrics.test.ts](files/packages--graph--src--__tests__--metrics.test.ts.md)
- [packages/graph/src/**tests**/traversal.test.ts](files/packages--graph--src--__tests__--traversal.test.ts.md)
- [packages/graph/src/index.ts](files/packages--graph--src--index.ts.md)
- [packages/graph/src/metrics.ts](files/packages--graph--src--metrics.ts.md)
- [packages/graph/src/supply-graph.ts](files/packages--graph--src--supply-graph.ts.md)
- [packages/graph/src/traversal.ts](files/packages--graph--src--traversal.ts.md)
- [packages/graph/tsconfig.json](files/packages--graph--tsconfig.json.md)

## health

Reports process/dependency health without implementing a pharmaceutical analysis stage.

- [apps/api/src/modules/health/health.routes.ts](files/apps--api--src--modules--health--health.routes.ts.md)

## infrastructure

Configures service/container orchestration and datastore setup; container execution remains unverified on the original host.

- [infra/docker-compose.yml](files/infra--docker-compose.yml.md)
- [infra/mongo-init/01-init.js](files/infra--mongo-init--01-init.js.md)

## logistics

Derives shipment constraints, excludes infeasible/unknown-critical-capability carriers and scores available evidence; no live quote has been established.

- [apps/api/src/modules/logistics/README.md](files/apps--api--src--modules--logistics--README.md.md)
- [apps/api/src/modules/logistics/**tests**/eligibility-gate.test.ts](files/apps--api--src--modules--logistics--__tests__--eligibility-gate.test.ts.md)
- [apps/api/src/modules/logistics/**tests**/factories/logistics.factory.ts](files/apps--api--src--modules--logistics--__tests__--factories--logistics.factory.ts.md)
- [apps/api/src/modules/logistics/**tests**/score.test.ts](files/apps--api--src--modules--logistics--__tests__--score.test.ts.md)
- [apps/api/src/modules/logistics/domain/carrier-fallbacks.ts](files/apps--api--src--modules--logistics--domain--carrier-fallbacks.ts.md)
- [apps/api/src/modules/logistics/domain/eligibility-gate.ts](files/apps--api--src--modules--logistics--domain--eligibility-gate.ts.md)
- [apps/api/src/modules/logistics/domain/recommend.ts](files/apps--api--src--modules--logistics--domain--recommend.ts.md)
- [apps/api/src/modules/logistics/domain/score.ts](files/apps--api--src--modules--logistics--domain--score.ts.md)
- [apps/api/src/modules/logistics/domain/shipment-derivation.ts](files/apps--api--src--modules--logistics--domain--shipment-derivation.ts.md)
- [apps/api/src/modules/logistics/domain/sub-scores.ts](files/apps--api--src--modules--logistics--domain--sub-scores.ts.md)
- [apps/api/src/modules/logistics/domain/urgency.ts](files/apps--api--src--modules--logistics--domain--urgency.ts.md)
- [apps/api/src/modules/logistics/index.ts](files/apps--api--src--modules--logistics--index.ts.md)
- [apps/api/src/modules/logistics/logistics.controller.ts](files/apps--api--src--modules--logistics--logistics.controller.ts.md)
- [apps/api/src/modules/logistics/logistics.repository.ts](files/apps--api--src--modules--logistics--logistics.repository.ts.md)
- [apps/api/src/modules/logistics/logistics.routes.ts](files/apps--api--src--modules--logistics--logistics.routes.ts.md)
- [apps/api/src/modules/logistics/logistics.schema.ts](files/apps--api--src--modules--logistics--logistics.schema.ts.md)
- [apps/api/src/modules/logistics/logistics.service.ts](files/apps--api--src--modules--logistics--logistics.service.ts.md)
- [apps/api/src/modules/logistics/models/logistics-recommendation.model.ts](files/apps--api--src--modules--logistics--models--logistics-recommendation.model.ts.md)
- [apps/api/src/modules/logistics/models/mappers.ts](files/apps--api--src--modules--logistics--models--mappers.ts.md)
- [apps/api/src/modules/logistics/models/shipment-request.model.ts](files/apps--api--src--modules--logistics--models--shipment-request.model.ts.md)

## operations

Connects public regulatory incidents to organisation-scoped investigations, analysis, conditional response inputs and decision history.

- [apps/api/src/modules/operations/README.md](files/apps--api--src--modules--operations--README.md.md)
- [apps/api/src/modules/operations/**tests**/candidate-discovery.test.ts](files/apps--api--src--modules--operations--__tests__--candidate-discovery.test.ts.md)
- [apps/api/src/modules/operations/**tests**/candidate-reference.test.ts](files/apps--api--src--modules--operations--__tests__--candidate-reference.test.ts.md)
- [apps/api/src/modules/operations/**tests**/candidates.test.ts](files/apps--api--src--modules--operations--__tests__--candidates.test.ts.md)
- [apps/api/src/modules/operations/**tests**/equivalence.test.ts](files/apps--api--src--modules--operations--__tests__--equivalence.test.ts.md)
- [apps/api/src/modules/operations/**tests**/incidents.test.ts](files/apps--api--src--modules--operations--__tests__--incidents.test.ts.md)
- [apps/api/src/modules/operations/**tests**/ingestion.test.ts](files/apps--api--src--modules--operations--__tests__--ingestion.test.ts.md)
- [apps/api/src/modules/operations/**tests**/response-plan.test.ts](files/apps--api--src--modules--operations--__tests__--response-plan.test.ts.md)
- [apps/api/src/modules/operations/**tests**/review-workflow.test.ts](files/apps--api--src--modules--operations--__tests__--review-workflow.test.ts.md)
- [apps/api/src/modules/operations/**tests**/shortage-evidence.test.ts](files/apps--api--src--modules--operations--__tests__--shortage-evidence.test.ts.md)
- [apps/api/src/modules/operations/**tests**/strength.test.ts](files/apps--api--src--modules--operations--__tests__--strength.test.ts.md)
- [apps/api/src/modules/operations/domain/archive-medicine.ts](files/apps--api--src--modules--operations--domain--archive-medicine.ts.md)
- [apps/api/src/modules/operations/domain/candidate-identity.ts](files/apps--api--src--modules--operations--domain--candidate-identity.ts.md)
- [apps/api/src/modules/operations/domain/candidate-reference.ts](files/apps--api--src--modules--operations--domain--candidate-reference.ts.md)
- [apps/api/src/modules/operations/domain/candidates.ts](files/apps--api--src--modules--operations--domain--candidates.ts.md)
- [apps/api/src/modules/operations/domain/decision.ts](files/apps--api--src--modules--operations--domain--decision.ts.md)
- [apps/api/src/modules/operations/domain/equivalence.ts](files/apps--api--src--modules--operations--domain--equivalence.ts.md)
- [apps/api/src/modules/operations/domain/incident-history.ts](files/apps--api--src--modules--operations--domain--incident-history.ts.md)
- [apps/api/src/modules/operations/domain/incidents.ts](files/apps--api--src--modules--operations--domain--incidents.ts.md)
- [apps/api/src/modules/operations/domain/matching.ts](files/apps--api--src--modules--operations--domain--matching.ts.md)
- [apps/api/src/modules/operations/domain/response-plan.ts](files/apps--api--src--modules--operations--domain--response-plan.ts.md)
- [apps/api/src/modules/operations/domain/shortage-evidence.ts](files/apps--api--src--modules--operations--domain--shortage-evidence.ts.md)
- [apps/api/src/modules/operations/domain/strength.ts](files/apps--api--src--modules--operations--domain--strength.ts.md)
- [apps/api/src/modules/operations/index.ts](files/apps--api--src--modules--operations--index.ts.md)
- [apps/api/src/modules/operations/models/archive.model.ts](files/apps--api--src--modules--operations--models--archive.model.ts.md)
- [apps/api/src/modules/operations/models/operations.model.ts](files/apps--api--src--modules--operations--models--operations.model.ts.md)
- [apps/api/src/modules/operations/operations.analysis.ts](files/apps--api--src--modules--operations--operations.analysis.ts.md)
- [apps/api/src/modules/operations/operations.archive.repository.ts](files/apps--api--src--modules--operations--operations.archive.repository.ts.md)
- [apps/api/src/modules/operations/operations.candidates.ts](files/apps--api--src--modules--operations--operations.candidates.ts.md)
- [apps/api/src/modules/operations/operations.controller.ts](files/apps--api--src--modules--operations--operations.controller.ts.md)
- [apps/api/src/modules/operations/operations.incidents.repository.ts](files/apps--api--src--modules--operations--operations.incidents.repository.ts.md)
- [apps/api/src/modules/operations/operations.ingestion.ts](files/apps--api--src--modules--operations--operations.ingestion.ts.md)
- [apps/api/src/modules/operations/operations.queue.ts](files/apps--api--src--modules--operations--operations.queue.ts.md)
- [apps/api/src/modules/operations/operations.repository.ts](files/apps--api--src--modules--operations--operations.repository.ts.md)
- [apps/api/src/modules/operations/operations.routes.ts](files/apps--api--src--modules--operations--operations.routes.ts.md)
- [apps/api/src/modules/operations/operations.schema.ts](files/apps--api--src--modules--operations--operations.schema.ts.md)
- [apps/api/src/modules/operations/operations.service.ts](files/apps--api--src--modules--operations--operations.service.ts.md)

## scenarios

Enumerates bounded sourcing × logistics scenarios, calculates outcomes and compares Pareto trade-offs with disclosed objectives.

- [apps/api/src/modules/scenarios/README.md](files/apps--api--src--modules--scenarios--README.md.md)
- [apps/api/src/modules/scenarios/**tests**/pareto.test.ts](files/apps--api--src--modules--scenarios--__tests__--pareto.test.ts.md)
- [apps/api/src/modules/scenarios/domain/enumerate.ts](files/apps--api--src--modules--scenarios--domain--enumerate.ts.md)
- [apps/api/src/modules/scenarios/domain/outcome-terms.ts](files/apps--api--src--modules--scenarios--domain--outcome-terms.ts.md)
- [apps/api/src/modules/scenarios/domain/pareto.ts](files/apps--api--src--modules--scenarios--domain--pareto.ts.md)
- [apps/api/src/modules/scenarios/index.ts](files/apps--api--src--modules--scenarios--index.ts.md)
- [apps/api/src/modules/scenarios/models/scenario-run.model.ts](files/apps--api--src--modules--scenarios--models--scenario-run.model.ts.md)
- [apps/api/src/modules/scenarios/scenarios.controller.ts](files/apps--api--src--modules--scenarios--scenarios.controller.ts.md)
- [apps/api/src/modules/scenarios/scenarios.repository.ts](files/apps--api--src--modules--scenarios--scenarios.repository.ts.md)
- [apps/api/src/modules/scenarios/scenarios.routes.ts](files/apps--api--src--modules--scenarios--scenarios.routes.ts.md)
- [apps/api/src/modules/scenarios/scenarios.schema.ts](files/apps--api--src--modules--scenarios--scenarios.schema.ts.md)
- [apps/api/src/modules/scenarios/scenarios.service.ts](files/apps--api--src--modules--scenarios--scenarios.service.ts.md)

## scripts

Provides setup, source probes and mechanical verification/documentation commands rather than runtime product data.

- [apps/api/src/scripts/cli-org.ts](files/apps--api--src--scripts--cli-org.ts.md)
- [apps/api/src/scripts/create-org.ts](files/apps--api--src--scripts--create-org.ts.md)
- [apps/api/src/scripts/decide.ts](files/apps--api--src--scripts--decide.ts.md)
- [apps/api/src/scripts/rebuild-graph.ts](files/apps--api--src--scripts--rebuild-graph.ts.md)
- [apps/api/src/scripts/recommend-carrier.ts](files/apps--api--src--scripts--recommend-carrier.ts.md)
- [apps/api/src/scripts/refresh-catalog.ts](files/apps--api--src--scripts--refresh-catalog.ts.md)
- [apps/api/src/scripts/run-cascade.ts](files/apps--api--src--scripts--run-cascade.ts.md)
- [apps/api/src/scripts/sense.ts](files/apps--api--src--scripts--sense.ts.md)
- [scripts/dev/bootstrap.sh](files/scripts--dev--bootstrap.sh.md)
- [scripts/dev/lint-python.sh](files/scripts--dev--lint-python.sh.md)
- [scripts/docs/context.mjs](files/scripts--docs--context.mjs.md)
- [scripts/docs/roles.json](files/scripts--docs--roles.json.md)
- [scripts/gates/gate-1-provenance.ts](files/scripts--gates--gate-1-provenance.ts.md)
- [scripts/gates/gate-2-no-fixtures.ts](files/scripts--gates--gate-2-no-fixtures.ts.md)
- [scripts/gates/gate-3-no-direct-http.ts](files/scripts--gates--gate-3-no-direct-http.ts.md)
- [scripts/gates/gate-4-reliability.sh](files/scripts--gates--gate-4-reliability.sh.md)
- [scripts/gates/gate-5-no-fake-quotes.ts](files/scripts--gates--gate-5-no-fake-quotes.ts.md)
- [scripts/gates/gate-lib.ts](files/scripts--gates--gate-lib.ts.md)
- [scripts/gates/gate-secrets.ts](files/scripts--gates--gate-secrets.ts.md)
- [scripts/history/README.md](files/scripts--history--README.md.md)
- [scripts/history/**tests**/history.test.ts](files/scripts--history--__tests__--history.test.ts.md)
- [scripts/history/**tests**/persistence.test.ts](files/scripts--history--__tests__--persistence.test.ts.md)
- [scripts/history/collect.ts](files/scripts--history--collect.ts.md)
- [scripts/history/domain/quality.ts](files/scripts--history--domain--quality.ts.md)
- [scripts/history/domain/reconstruction.ts](files/scripts--history--domain--reconstruction.ts.md)
- [scripts/history/domain/selection.ts](files/scripts--history--domain--selection.ts.md)
- [scripts/history/evaluate-persistence.ts](files/scripts--history--evaluate-persistence.ts.md)
- [scripts/history/forecast/baselines.ts](files/scripts--history--forecast--baselines.ts.md)
- [scripts/history/forecast/cohort.ts](files/scripts--history--forecast--cohort.ts.md)
- [scripts/history/forecast/evaluate.ts](files/scripts--history--forecast--evaluate.ts.md)
- [scripts/history/forecast/metrics.ts](files/scripts--history--forecast--metrics.ts.md)
- [scripts/history/forecast/task.ts](files/scripts--history--forecast--task.ts.md)
- [scripts/history/import-to-app.ts](files/scripts--history--import-to-app.ts.md)
- [scripts/history/replay.ts](files/scripts--history--replay.ts.md)
- [scripts/history/report.ts](files/scripts--history--report.ts.md)
- [scripts/history/snapshot-store.ts](files/scripts--history--snapshot-store.ts.md)
- [scripts/probe-sources.ts](files/scripts--probe-sources.ts.md)

## shared

Supplies API configuration, authentication, persistence, HTTP/middleware and composition infrastructure.

- [apps/api/src/app.ts](files/apps--api--src--app.ts.md)
- [apps/api/src/config/constants.ts](files/apps--api--src--config--constants.ts.md)
- [apps/api/src/config/env.ts](files/apps--api--src--config--env.ts.md)
- [apps/api/src/config/seed-drugs.yaml](files/apps--api--src--config--seed-drugs.yaml.md)
- [apps/api/src/config/weights.ts](files/apps--api--src--config--weights.ts.md)
- [apps/api/src/main.ts](files/apps--api--src--main.ts.md)
- [apps/api/src/routes/index.ts](files/apps--api--src--routes--index.ts.md)
- [apps/api/src/shared/auth/index.ts](files/apps--api--src--shared--auth--index.ts.md)
- [apps/api/src/shared/auth/permissions.ts](files/apps--api--src--shared--auth--permissions.ts.md)
- [apps/api/src/shared/auth/tokens.ts](files/apps--api--src--shared--auth--tokens.ts.md)
- [apps/api/src/shared/connectors/carriers.ts](files/apps--api--src--shared--connectors--carriers.ts.md)
- [apps/api/src/shared/connectors/index.ts](files/apps--api--src--shared--connectors--index.ts.md)
- [apps/api/src/shared/db/document-types.ts](files/apps--api--src--shared--db--document-types.ts.md)
- [apps/api/src/shared/db/index.ts](files/apps--api--src--shared--db--index.ts.md)
- [apps/api/src/shared/db/mappers.ts](files/apps--api--src--shared--db--mappers.ts.md)
- [apps/api/src/shared/db/mongo.ts](files/apps--api--src--shared--db--mongo.ts.md)
- [apps/api/src/shared/db/quantity.schema.ts](files/apps--api--src--shared--db--quantity.schema.ts.md)
- [apps/api/src/shared/db/redis.ts](files/apps--api--src--shared--db--redis.ts.md)
- [apps/api/src/shared/errors/app-error.ts](files/apps--api--src--shared--errors--app-error.ts.md)
- [apps/api/src/shared/errors/index.ts](files/apps--api--src--shared--errors--index.ts.md)
- [apps/api/src/shared/http/index.ts](files/apps--api--src--shared--http--index.ts.md)
- [apps/api/src/shared/http/pagination.ts](files/apps--api--src--shared--http--pagination.ts.md)
- [apps/api/src/shared/http/response.ts](files/apps--api--src--shared--http--response.ts.md)
- [apps/api/src/shared/logger/index.ts](files/apps--api--src--shared--logger--index.ts.md)
- [apps/api/src/shared/logger/logger.ts](files/apps--api--src--shared--logger--logger.ts.md)
- [apps/api/src/shared/middleware/auth.ts](files/apps--api--src--shared--middleware--auth.ts.md)
- [apps/api/src/shared/middleware/error-handler.ts](files/apps--api--src--shared--middleware--error-handler.ts.md)
- [apps/api/src/shared/middleware/index.ts](files/apps--api--src--shared--middleware--index.ts.md)
- [apps/api/src/shared/middleware/not-found.ts](files/apps--api--src--shared--middleware--not-found.ts.md)
- [apps/api/src/shared/middleware/rate-limit.ts](files/apps--api--src--shared--middleware--rate-limit.ts.md)
- [apps/api/src/shared/middleware/request-id.ts](files/apps--api--src--shared--middleware--request-id.ts.md)
- [apps/api/src/shared/middleware/validate.ts](files/apps--api--src--shared--middleware--validate.ts.md)
- [apps/api/src/shared/types/express.d.ts](files/apps--api--src--shared--types--express.d.ts.md)
- [apps/api/src/shared/types/index.ts](files/apps--api--src--shared--types--index.ts.md)

## signals

Turns retrieved observations into clusters, entity matches, independence checks, corroboration and either published alerts or quarantine.

- [apps/api/src/modules/signals/**tests**/verify.test.ts](files/apps--api--src--modules--signals--__tests__--verify.test.ts.md)
- [apps/api/src/modules/signals/domain/cluster.ts](files/apps--api--src--modules--signals--domain--cluster.ts.md)
- [apps/api/src/modules/signals/domain/extraction.ts](files/apps--api--src--modules--signals--domain--extraction.ts.md)
- [apps/api/src/modules/signals/domain/independence.ts](files/apps--api--src--modules--signals--domain--independence.ts.md)
- [apps/api/src/modules/signals/domain/ingest-mappers.ts](files/apps--api--src--modules--signals--domain--ingest-mappers.ts.md)
- [apps/api/src/modules/signals/domain/resolve.ts](files/apps--api--src--modules--signals--domain--resolve.ts.md)
- [apps/api/src/modules/signals/domain/simhash.ts](files/apps--api--src--modules--signals--domain--simhash.ts.md)
- [apps/api/src/modules/signals/domain/veracity.ts](files/apps--api--src--modules--signals--domain--veracity.ts.md)
- [apps/api/src/modules/signals/domain/verify-helpers.ts](files/apps--api--src--modules--signals--domain--verify-helpers.ts.md)
- [apps/api/src/modules/signals/index.ts](files/apps--api--src--modules--signals--index.ts.md)
- [apps/api/src/modules/signals/models/mappers.ts](files/apps--api--src--modules--signals--models--mappers.ts.md)
- [apps/api/src/modules/signals/models/raw-signal.model.ts](files/apps--api--src--modules--signals--models--raw-signal.model.ts.md)
- [apps/api/src/modules/signals/models/verified-alert.model.ts](files/apps--api--src--modules--signals--models--verified-alert.model.ts.md)
- [apps/api/src/modules/signals/signals.adjudicate.ts](files/apps--api--src--modules--signals--signals.adjudicate.ts.md)
- [apps/api/src/modules/signals/signals.controller.ts](files/apps--api--src--modules--signals--signals.controller.ts.md)
- [apps/api/src/modules/signals/signals.corroborate.ts](files/apps--api--src--modules--signals--signals.corroborate.ts.md)
- [apps/api/src/modules/signals/signals.ingest.ts](files/apps--api--src--modules--signals--signals.ingest.ts.md)
- [apps/api/src/modules/signals/signals.queries.ts](files/apps--api--src--modules--signals--signals.queries.ts.md)
- [apps/api/src/modules/signals/signals.repository.ts](files/apps--api--src--modules--signals--signals.repository.ts.md)
- [apps/api/src/modules/signals/signals.routes.ts](files/apps--api--src--modules--signals--signals.routes.ts.md)
- [apps/api/src/modules/signals/signals.schema.ts](files/apps--api--src--modules--signals--signals.schema.ts.md)
- [apps/api/src/modules/signals/signals.service.ts](files/apps--api--src--modules--signals--signals.service.ts.md)
- [apps/api/src/modules/signals/signals.verify.ts](files/apps--api--src--modules--signals--signals.verify.ts.md)

## tooling

Configures repository builds, quality checks, dependencies and contributor workflow.

- [.dockerignore](files/root--.dockerignore.md)
- [.editorconfig](files/root--.editorconfig.md)
- [.env.example](files/root--.env.example.md)
- [.github/pull_request_template.md](files/root--.github--pull_request_template.md.md)
- [.github/workflows/ci.yml](files/root--.github--workflows--ci.yml.md)
- [.gitignore](files/root--.gitignore.md)
- [.husky/commit-msg](files/root--.husky--commit-msg.md)
- [.husky/pre-commit](files/root--.husky--pre-commit.md)
- [.prettierignore](files/root--.prettierignore.md)
- [.prettierrc.json](files/root--.prettierrc.json.md)
- [AGENTS.md](files/AGENTS.md.md)
- [README.md](files/README.md.md)
- [apps/api/Dockerfile](files/apps--api--Dockerfile.md)
- [apps/api/package.json](files/apps--api--package.json.md)
- [apps/api/tsconfig.json](files/apps--api--tsconfig.json.md)
- [commitlint.config.cjs](files/commitlint.config.cjs.md)
- [eslint.config.mjs](files/eslint.config.mjs.md)
- [package-lock.json](files/package-lock.json.md)
- [package.json](files/package.json.md)
- [tsconfig.base.json](files/tsconfig.base.json.md)
- [tsconfig.json](files/tsconfig.json.md)
- [vitest.config.mts](files/vitest.config.mts.md)

## ui

Provides reusable visual primitives and quantity/provenance rendering.

- [packages/ui/package.json](files/packages--ui--package.json.md)
- [packages/ui/src/charts.tsx](files/packages--ui--src--charts.tsx.md)
- [packages/ui/src/chips.tsx](files/packages--ui--src--chips.tsx.md)
- [packages/ui/src/controls.tsx](files/packages--ui--src--controls.tsx.md)
- [packages/ui/src/index.ts](files/packages--ui--src--index.ts.md)
- [packages/ui/src/layout.tsx](files/packages--ui--src--layout.tsx.md)
- [packages/ui/src/provenance.tsx](files/packages--ui--src--provenance.tsx.md)
- [packages/ui/src/theme.css](files/packages--ui--src--theme.css.md)
- [packages/ui/tsconfig.json](files/packages--ui--tsconfig.json.md)

## web

Presents the authenticated analyst workspace and earlier stage tools; source facts and scenario assumptions stay distinguishable.

- [apps/web/Dockerfile](files/apps--web--Dockerfile.md)
- [apps/web/index.html](files/apps--web--index.html.md)
- [apps/web/nginx.conf](files/apps--web--nginx.conf.md)
- [apps/web/package.json](files/apps--web--package.json.md)
- [apps/web/src/App.tsx](files/apps--web--src--App.tsx.md)
- [apps/web/src/api/client.ts](files/apps--web--src--api--client.ts.md)
- [apps/web/src/api/overview.ts](files/apps--web--src--api--overview.ts.md)
- [apps/web/src/api/queries.ts](files/apps--web--src--api--queries.ts.md)
- [apps/web/src/components/ScreenGuide.tsx](files/apps--web--src--components--ScreenGuide.tsx.md)
- [apps/web/src/components/Splash.tsx](files/apps--web--src--components--Splash.tsx.md)
- [apps/web/src/components/icons.tsx](files/apps--web--src--components--icons.tsx.md)
- [apps/web/src/main.tsx](files/apps--web--src--main.tsx.md)
- [apps/web/src/nav.ts](files/apps--web--src--nav.ts.md)
- [apps/web/src/operations/Analysis.tsx](files/apps--web--src--operations--Analysis.tsx.md)
- [apps/web/src/operations/ArchiveHistoryPanel.tsx](files/apps--web--src--operations--ArchiveHistoryPanel.tsx.md)
- [apps/web/src/operations/CandidatesPanel.tsx](files/apps--web--src--operations--CandidatesPanel.tsx.md)
- [apps/web/src/operations/DecisionPanel.tsx](files/apps--web--src--operations--DecisionPanel.tsx.md)
- [apps/web/src/operations/Evidence.tsx](files/apps--web--src--operations--Evidence.tsx.md)
- [apps/web/src/operations/Globe.tsx](files/apps--web--src--operations--Globe.tsx.md)
- [apps/web/src/operations/HistoryPanel.tsx](files/apps--web--src--operations--HistoryPanel.tsx.md)
- [apps/web/src/operations/InvestigationPanel.tsx](files/apps--web--src--operations--InvestigationPanel.tsx.md)
- [apps/web/src/operations/LogisticsPanel.tsx](files/apps--web--src--operations--LogisticsPanel.tsx.md)
- [apps/web/src/operations/MonitorRail.tsx](files/apps--web--src--operations--MonitorRail.tsx.md)
- [apps/web/src/operations/NewsPanel.tsx](files/apps--web--src--operations--NewsPanel.tsx.md)
- [apps/web/src/operations/ReportPanel.tsx](files/apps--web--src--operations--ReportPanel.tsx.md)
- [apps/web/src/operations/ResponsePlanner.tsx](files/apps--web--src--operations--ResponsePlanner.tsx.md)
- [apps/web/src/operations/ScenarioTools.tsx](files/apps--web--src--operations--ScenarioTools.tsx.md)
- [apps/web/src/operations/SourcePanel.tsx](files/apps--web--src--operations--SourcePanel.tsx.md)
- [apps/web/src/operations/TracePanel.tsx](files/apps--web--src--operations--TracePanel.tsx.md)
- [apps/web/src/operations/Workspace.tsx](files/apps--web--src--operations--Workspace.tsx.md)
- [apps/web/src/operations/**tests**/report.test.ts](files/apps--web--src--operations--__tests__--report.test.ts.md)
- [apps/web/src/operations/api.ts](files/apps--web--src--operations--api.ts.md)
- [apps/web/src/operations/candidates.css](files/apps--web--src--operations--candidates.css.md)
- [apps/web/src/operations/operations.css](files/apps--web--src--operations--operations.css.md)
- [apps/web/src/operations/report.ts](files/apps--web--src--operations--report.ts.md)
- [apps/web/src/operations/source-history.ts](files/apps--web--src--operations--source-history.ts.md)
- [apps/web/src/views/CascadeView.tsx](files/apps--web--src--views--CascadeView.tsx.md)
- [apps/web/src/views/CatalogView.tsx](files/apps--web--src--views--CatalogView.tsx.md)
- [apps/web/src/views/DecideView.tsx](files/apps--web--src--views--DecideView.tsx.md)
- [apps/web/src/views/LearnView.tsx](files/apps--web--src--views--LearnView.tsx.md)
- [apps/web/src/views/LoginView.tsx](files/apps--web--src--views--LoginView.tsx.md)
- [apps/web/src/views/LogisticsView.tsx](files/apps--web--src--views--LogisticsView.tsx.md)
- [apps/web/src/views/OverviewView.tsx](files/apps--web--src--views--OverviewView.tsx.md)
- [apps/web/src/views/SenseView.tsx](files/apps--web--src--views--SenseView.tsx.md)
- [apps/web/src/views/types.ts](files/apps--web--src--views--types.ts.md)
- [apps/web/src/views/useApi.ts](files/apps--web--src--views--useApi.ts.md)
- [apps/web/tsconfig.json](files/apps--web--tsconfig.json.md)
- [apps/web/vite.config.ts](files/apps--web--vite.config.ts.md)

## workers

Runs the registered operations ingestion queue and heartbeat; future cascade/quote queue descriptions are not active consumers.

- [apps/workers/Dockerfile](files/apps--workers--Dockerfile.md)
- [apps/workers/package.json](files/apps--workers--package.json.md)
- [apps/workers/src/main.ts](files/apps--workers--src--main.ts.md)
- [apps/workers/tsconfig.json](files/apps--workers--tsconfig.json.md)
