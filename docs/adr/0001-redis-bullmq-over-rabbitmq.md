# ADR-0001: Redis + BullMQ rather than RabbitMQ

- Status: accepted
- Date: 2026-09-08

## Context

Vitalink needs a queue for ingestion polling, verification, cascade runs,
scenario simulation, carrier quote fan-out and webhook delivery. It needs
repeatable schedules, retries with backoff and a dead-letter path.

## Options considered

**RabbitMQ.** Topic exchanges, per-message routing keys, mature management UI.
Adds a second stateful piece of infrastructure and an AMQP client.

**Redis + BullMQ.** Redis is already required for four other jobs: the provenance
HTTP cache, the Socket.IO multi-instance adapter, rate-limit counters and the JWT
`jti` denylist. BullMQ rides on it and provides repeatable schedules, retries,
exponential backoff, dead-letter queues and a dashboard.

**Postgres-backed queue (e.g. pg-boss).** Rejected early: we have no Postgres, and
adding one for a queue would be worse than adding RabbitMQ for a queue.

## Decision

Redis + BullMQ.

The deciding argument is not that BullMQ is better than RabbitMQ — it is that
Redis has to exist regardless, so BullMQ adds capability without adding
infrastructure. RabbitMQ's advantage is rich topic-exchange routing, and Vitalink
has a fixed, small set of named queues with no dynamic routing at all.

## Consequences

- One stateful dependency for five jobs. `docker compose up` stays short.
- Redis runs with `appendonly yes`, because losing the queue would drop scheduled
  ingestion and losing the refresh-token store would log every user out.
- BullMQ requires `maxRetriesPerRequest: null`, so it gets its own ioredis client
  rather than sharing the general-purpose one.
- **Mitigation for the lock-in:** an `EventBus` interface (`publish` / `subscribe`
  / `ack`) lives in `packages/contracts/src/events.ts`. Swapping the adapter is
  one file. That interface exists specifically so this ADR can be reversed
  cheaply if the routing needs change.
