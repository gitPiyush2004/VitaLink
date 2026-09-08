# ADR-0006: A modular monolith plus one compute service, and no Kubernetes

- Status: accepted
- Date: 2026-09-08

## Context

Vitalink has nine pipeline stages and twelve bounded concerns. The obvious
temptation in a capstone is one microservice per concern, on Kubernetes.

## Options considered

**Microservices per concern.** Twelve services, twelve deploy pipelines, a service
mesh, distributed transactions across `alerts` and `cascades`, and the need to
explain in a viva why a nine-stage pipeline that runs on one machine needs
service discovery.

**Single process for everything, Python included.** Would require the numerical
stack (numpy, scikit-learn, OR-Tools, SciPy) inside the Node process, which is not
possible, or reimplementing the reliability model in TypeScript, which would make
reproducing the paper's table harder to trust.

**Modular monolith + one stateless compute service + a worker process.**

## Decision

Three deployable units:

- `apps/api` — a **modular monolith** with enforced internal boundaries. Owns all
  state. Boundaries are enforced by ESLint, not by network hops.
- `apps/brain` — Python FastAPI. CPU-bound numerical work with a completely
  different dependency tree. **Stateless: no database access at all.** State
  arrives in the request and leaves in the response.
- `apps/workers` — BullMQ consumers. Shares the API's modules, because the API is
  the single owner of state and a worker with its own persistence would be a
  second source of truth.

Docker Compose. No Kubernetes.

## Consequences

- Module boundaries are real but cheap: crossing one is a function call, and
  violating one is a lint error. That is the property microservices are usually
  reached for, without the distributed-systems tax.
- The Python split is justified by dependency isolation and by the value of
  implementing the paper's equations in the language its own community uses — not
  by "microservices are good architecture".
- `apps/brain` having no database is the constraint that keeps it honest: it cannot
  quietly acquire state and become a second owner of truth. The absence of
  `MONGO_URI` in its compose environment is deliberate and commented.
- `docker compose up` brings up the whole system. A new developer reaches a running
  system in under ten minutes, which is a stated Phase 0 gate.
- **What would change at real scale:** the workers scale independently already.
  The API would need horizontal scaling, which is why the Socket.IO Redis adapter
  and the Redis-backed rate limiter are in place from the start rather than
  retrofitted.
