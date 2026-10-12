import { model, Schema } from 'mongoose';

type ArchiveDoc = { _id: string; medicine_keys: string[]; payload: unknown };
const schema = new Schema<ArchiveDoc>(
  {
    _id: { type: String, required: true },
    medicine_keys: { type: [String], required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'public_fda_archive_snapshots', strict: 'throw', _id: false },
);
schema.index({ medicine_keys: 1 });
export const ArchiveSnapshotModel = model<ArchiveDoc>('PublicFdaArchiveSnapshot', schema);
