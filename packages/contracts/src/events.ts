/**
 * The event catalogue and the `EventBus` interface.
 *
 * The interface exists so the queue adapter can be swapped in one file. We chose
 * Redis + BullMQ (ADR-0001) because Redis is already required for the HTTP cache,
 * the Socket.IO adapter and rate limiting, so BullMQ adds capability without
 * adding a second piece of infrastructure. If that ever stops being true, only
 * the adapter behind this interface changes.
 *
 * Naming: events are `noun.past-tense-verb`; queues are `area.action`.
 */

import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from './common';
import { carrierIdSchema, signalSourceSchema } from './enums';

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

export const EVENT_NAMES = [
  'signal.ingested',
  'cluster.formed',
  'alert.verified',
  'signal.quarantined',
  'graph.rebuilt',
  'cascade.completed',
  'reliability.computed',
  'recommendation.issued',
  'shipment.derived',
  'quotes.collected',
  'logistics.recommended',
  'excursion.detected',
  'shipment.delayed',
  'eval.completed',
] as const;
export const eventNameSchema = z.enum(EVENT_NAMES);
export type EventName = z.infer<typeof eventNameSchema>;

/** Queues, named `area.action`. One per unit of independently scalable work. */
export const QUEUE_NAMES = [
  'ingest.openfda',
  'ingest.gdelt',
  'ingest.dailymed',
  'ingest.comtrade',
  'ingest.hazard',
  'ingest.cdsco',
  'verify.cluster',
  'graph.rebuild',
  'cascade.run',
  'reliability.compute',
  'scenario.simulate',
  'logistics.compare',
  'logistics.track',
  'webhook.deliver',
  'eval.replay',
] as const;
export const queueNameSchema = z.enum(QUEUE_NAMES);
export type QueueName = z.infer<typeof queueNameSchema>;

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Every event carries an `event_id`. Consumers write it into `processed_events`
 * with a unique index in the same operation that records their result, so a
 * duplicate delivery fails the index write and exits. PART 11.
 *
 * `request_id` is propagated from the originating HTTP request so one id traces a
 * whole distributed workflow through the API, the workers and the Python service.
 */
export const eventEnvelopeSchema = z.object({
  event_id: z.uuid(),
  name: eventNameSchema,
  occurred_at: isoDateTimeSchema,
  request_id: z.string(),
  org_id: idSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

export const eventPayloadSchemas = {
  'signal.ingested': z.object({
    signal_ids: z.array(idSchema),
    source: signalSourceSchema,
  }),
  'cluster.formed': z.object({
    cluster_id: idSchema,
    signal_ids: z.array(idSchema),
  }),
  'alert.verified': z.object({
    alert_id: idSchema,
    independent_source_count: z.number().int(),
    resolved_node_id: idSchema.nullable(),
  }),
  'signal.quarantined': z.object({
    quarantine_id: idSchema,
    cluster_id: idSchema,
    reason: z.string(),
  }),
  'graph.rebuilt': z.object({
    node_count: z.number().int(),
    edge_count: z.number().int(),
  }),
  'cascade.completed': z.object({
    cascade_id: idSchema,
    alert_id: idSchema.nullable(),
    exposed_drug_count: z.number().int(),
  }),
  'reliability.computed': z.object({
    drug_id: idSchema,
    fragility_index: z.number(),
  }),
  'recommendation.issued': z.object({
    recommendation_id: idSchema,
    cascade_id: idSchema,
    chosen_scenario_id: idSchema,
  }),
  'shipment.derived': z.object({
    shipment_request_id: idSchema,
    cascade_id: idSchema,
    drug_id: idSchema,
  }),
  'quotes.collected': z.object({
    shipment_request_id: idSchema,
    quote_ids: z.array(idSchema),
    carriers_attempted: z.number().int(),
    carriers_quoted: z.number().int(),
  }),
  'logistics.recommended': z.object({
    logistics_recommendation_id: idSchema,
    shipment_request_id: idSchema,
    recommended_quote_id: idSchema.nullable(),
  }),
  'excursion.detected': z.object({
    shipment_request_id: idSchema,
    temperature_c: z.number(),
    threshold_text: z.string(),
  }),
  'shipment.delayed': z.object({
    shipment_request_id: idSchema,
    previous_eta: isoDateTimeSchema.nullable(),
    new_eta: isoDateTimeSchema,
    deadline: isoDateTimeSchema,
    carrier_id: carrierIdSchema,
  }),
  'eval.completed': z.object({
    eval_run_id: idSchema,
    experiment: z.string(),
  }),
} as const satisfies Record<EventName, z.ZodTypeAny>;

export type EventPayload<N extends EventName> = z.infer<(typeof eventPayloadSchemas)[N]>;

/** Events published to external subscribers as outbound webhooks (PART 8). */
export const OUTBOUND_WEBHOOK_EVENTS = [
  'alert.verified',
  'cascade.completed',
  'recommendation.issued',
  'excursion.detected',
  'shipment.delayed',
] as const satisfies readonly EventName[];

// ---------------------------------------------------------------------------
// The swappable interface (ADR-0001)
// ---------------------------------------------------------------------------

export type EventHandler<N extends EventName = EventName> = (
  envelope: EventEnvelope & { name: N; payload: EventPayload<N> },
) => Promise<void>;

export type EventBus = {
  publish<N extends EventName>(
    name: N,
    payload: EventPayload<N>,
    context: { requestId: string; orgId: string },
  ): Promise<string>;

  subscribe<N extends EventName>(name: N, handler: EventHandler<N>): Promise<void>;

  /** Explicit ack, so an adapter with at-least-once delivery can be plugged in. */
  ack(eventId: string): Promise<void>;

  close(): Promise<void>;
};
