/** JSON snapshots are parsed with the shared Zod contracts on every read/write.
 * Quantities inside them retain their provenance, including operator assumptions.
 */
import { model, Schema } from 'mongoose';

export type SnapshotDoc = {
  _id: string;
  org_id: string;
  payload: unknown;
  changed_at: Date;
  digest?: string;
  versioned?: boolean;
};
function snapshotSchema(collection: string): Schema<SnapshotDoc> {
  const schema = new Schema<SnapshotDoc>(
    {
      _id: { type: String, required: true },
      org_id: { type: String, required: true },
      payload: { type: Schema.Types.Mixed, required: true },
      changed_at: { type: Date, required: true },
      digest: { type: String },
      versioned: { type: Boolean },
    },
    { collection, strict: 'throw', _id: false },
  );
  schema.index({ org_id: 1, changed_at: -1 });
  if (collection === 'operational_incident_versions') {
    schema.index({ org_id: 1, 'payload.incidentId': 1, 'payload.observedAt': -1, _id: 1 });
  }
  if (collection === 'operational_incidents') {
    schema.index({ org_id: 1, 'payload.publishedAt': -1, _id: 1 });
  }
  return schema;
}
export const IncidentModel = model<SnapshotDoc>(
  'OperationalIncident',
  snapshotSchema('operational_incidents'),
);
export const FeedModel = model<SnapshotDoc>('OperationalFeed', snapshotSchema('operational_feeds'));
export const InvestigationModel = model<SnapshotDoc>(
  'Investigation',
  snapshotSchema('investigations'),
);
export const WatchModel = model<SnapshotDoc>('Watch', snapshotSchema('watches'));

export const IncidentVersionModel = model<SnapshotDoc>(
  'IncidentVersion',
  snapshotSchema('operational_incident_versions'),
);
