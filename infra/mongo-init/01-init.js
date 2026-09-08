/**
 * Runs once, when the Mongo data directory is empty.
 *
 * Two things happen here that cannot happen from application code:
 *
 *  1. The application user is created. The root credentials in docker-compose are
 *     for initialisation only; the app connects as `vitalink`.
 *  2. The `signals` time-series collection is created explicitly. Mongo cannot
 *     create a time-series collection implicitly on first write, so a plain
 *     `insertOne` would silently produce an ordinary collection instead — and we
 *     would lose the bucketing that makes the ingest volume affordable.
 */

// eslint-disable-next-line no-undef -- mongosh globals
const database = db.getSiblingDB('vitalink');

database.createCollection('signals', {
  timeseries: {
    timeField: 'published_at',
    // Queries are almost always "recent signals from source X", so source is the
    // natural bucketing key.
    metaField: 'source',
    granularity: 'minutes',
  },
  // Raw signals are evidence: they are kept, not expired. The eval harness
  // replays them, so a TTL here would delete the results chapter's inputs.
});

database.createCollection('processed_events');
database.createCollection('carrier_raw_payloads');

print('vitalink: initialised signals time-series collection');
