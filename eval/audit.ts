import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { z } from 'zod';

import { derived, feedStatusSchema, incidentSchema, type Incident } from '@vitalink/contracts';

const snapshotSchema = z
  .object({
    incidents: z.array(incidentSchema).min(1),
    feeds: z.array(feedStatusSchema),
  })
  .refine(
    (one) => new Set(one.incidents.map((row) => row.id)).size === one.incidents.length,
    'Snapshot contains duplicate event identities',
  );

function measure(label: string, records: Incident[], test: (one: Incident) => boolean) {
  const matched = records.filter(test).length;
  const fetchedAt = records
    .map((one) => one.provenance.fetched_at)
    .sort()
    .at(-1);
  if (!fetchedAt || !records[0]) return { label, denominator: 0, count: null, fraction: null };
  const source = {
    name: 'Frozen FDA operational snapshot',
    url: records[0].provenance.source_url,
    query: 'See archived snapshot and each record’s original query',
    fetchedAt,
  };
  return {
    label,
    denominator: records.length,
    count: derived({
      value: matched,
      unit: 'records',
      source,
      method: `Count records satisfying: ${label}.`,
    }),
    fraction: derived({
      value: matched / records.length,
      unit: null,
      source,
      method: `Matching records / records in this stratum (${matched}/${records.length}). This is data coverage, not predictive accuracy.`,
    }),
  };
}
export function auditSnapshot(raw: unknown) {
  const snapshot = snapshotSchema.parse(raw);
  const recalls = snapshot.incidents.filter((one) => one.kind === 'RECALL');
  const shortages = snapshot.incidents.filter((one) => one.kind === 'SHORTAGE');
  return {
    schemaVersion: 1,
    purpose:
      'Reproducible coverage audit of actual regulatory records; not a forecasting benchmark.',
    sourceFetchTimes: [
      ...new Set(snapshot.incidents.map((one) => one.provenance.fetched_at)),
    ].sort(),
    feedCoverage: snapshot.feeds,
    metrics: [
      measure('Recall records with lot/code scope', recalls, (one) => Boolean(one.lots)),
      measure(
        'Recall records with FDA product NDC identifiers',
        recalls,
        (one) => one.productNdcs.length > 0,
      ),
      measure('Recall records with generic names', recalls, (one) => one.genericNames.length > 0),
      measure('Recall records with firm-city coordinates', recalls, (one) =>
        Boolean(one.location?.coordinates),
      ),
      measure(
        'Shortage presentations explicitly Available',
        shortages,
        (one) => one.availability === 'Available',
      ),
      measure(
        'Shortage presentations explicitly Unavailable',
        shortages,
        (one) => one.availability === 'Unavailable',
      ),
      measure(
        'Shortage presentations with product NDC identifiers',
        shortages,
        (one) => one.productNdcs.length > 0,
      ),
      measure(
        'Records with a parseable publication/update date',
        snapshot.incidents,
        (one) => one.publishedAt !== null,
      ),
    ],
    unavailableEvaluation: {
      forecastingAccuracy:
        'No frozen point-in-time feature series, outcome labels or out-of-sample benchmark exists yet.',
      populationImpact:
        'FDA does not expose organisational inventory, hospital demand or verified supplier-to-hospital relationships.',
      generalisation:
        'Both regulatory feeds are capped. Missing records are not negative outcomes. Results describe this snapshot only.',
    },
  };
}
function main(): void {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: npm run eval:audit -- snapshot.json report.json');
  const bytes = readFileSync(input);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  const report = {
    snapshotSha256: createHash('sha256').update(bytes).digest('hex'),
    ...auditSnapshot(raw),
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved ${report.metrics.length} reproducible coverage measurements to ${output}.`);
}
if (process.argv[1]?.endsWith('audit.ts')) main();
