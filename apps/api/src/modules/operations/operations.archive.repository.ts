/** Immutable normalized imports, queried by a name association with explicit scope. */
import {
  medicineArchiveObservationSchema,
  shortageSnapshotSchema,
  type HistoricalShortageRow,
  type MedicineArchive,
  type ShortageSnapshot,
} from '@vitalink/contracts';

import { printedMedicineKey } from './domain/archive-medicine';
import { ArchiveSnapshotModel } from './models/archive.model';

const ARCHIVE_CAPTURE_LIMIT = 200;
export function createArchiveRepository() {
  return { importSnapshot, archiveMedicine };
}
async function importSnapshot(input: ShortageSnapshot): Promise<boolean> {
  const snapshot = shortageSnapshotSchema.parse(input);
  const snapshotId = `${snapshot.capture.timestamp}-${snapshot.bodySha256}`;
  const rowsByMedicine: Record<string, HistoricalShortageRow[]> = {};
  for (const row of snapshot.rows) {
    const key = printedMedicineKey(row.genericName);
    (rowsByMedicine[key] ??= []).push(row);
  }
  const payload = {
    snapshotId,
    capture: snapshot.capture,
    provenance: snapshot.provenance,
    bodySha256: snapshot.bodySha256,
    parser: snapshot.parser,
    rowsByMedicine,
  };
  const existing = await ArchiveSnapshotModel.findById(snapshotId).lean().exec();
  if (existing && JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
    throw new Error(
      'Existing archive interpretation differs; use a new parser version instead of replacing evidence.',
    );
  }
  const result = await ArchiveSnapshotModel.updateOne(
    { _id: snapshotId },
    { $setOnInsert: { medicine_keys: Object.keys(rowsByMedicine), payload } },
    { upsert: true },
  ).exec();
  return result.upsertedCount > 0;
}
async function archiveMedicine(name: string): Promise<MedicineArchive> {
  const key = printedMedicineKey(name);
  const [docs, storedCaptures] = await Promise.all([
    ArchiveSnapshotModel.find({ medicine_keys: key })
      .select({
        'payload.snapshotId': 1,
        'payload.capture': 1,
        'payload.provenance': 1,
        'payload.bodySha256': 1,
        'payload.parser': 1,
        [`payload.rowsByMedicine.${key}`]: 1,
      })
      .sort({ 'payload.capture.timestamp': 1 })
      .limit(ARCHIVE_CAPTURE_LIMIT)
      .lean()
      .exec(),
    ArchiveSnapshotModel.countDocuments().exec(),
  ]);
  const observations = docs.map((doc) => {
    const value = doc.payload as { rowsByMedicine: Record<string, HistoricalShortageRow[]> };
    return medicineArchiveObservationSchema.parse({
      ...value,
      rows: value.rowsByMedicine[key] ?? [],
    });
  });
  return {
    printedMedicineName: name,
    observations,
    storedCaptures,
    basis:
      'exact normalized printed medicine name; company/presentation identity is not established',
    coverage:
      'Up to 200 imported captures for the exact printed medicine name. These are retained legacy FDA presentations across companies and forms, not a verified history of this product NDC. Archive periods are irregular; absence is not resolution. The source collection has rejected/missing captures and disclosed parser repairs. Observation times are not exact event times.',
  };
}
