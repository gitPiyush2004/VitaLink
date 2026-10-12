/** Imported, verified public archive evidence, never a current-stock or direct-NDC history. */
import { z } from 'zod';

import {
  archiveCaptureSchema,
  historicalShortageRowSchema,
  shortageSnapshotSchema,
} from './history';
import { provenanceSchema } from './provenance';

export const medicineArchiveObservationSchema = z.object({
  snapshotId: z.string(),
  capture: archiveCaptureSchema,
  provenance: provenanceSchema,
  parser: shortageSnapshotSchema.shape.parser,
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(historicalShortageRowSchema),
});
export type MedicineArchiveObservation = z.infer<typeof medicineArchiveObservationSchema>;
export const medicineArchiveSchema = z.object({
  printedMedicineName: z.string(),
  observations: z.array(medicineArchiveObservationSchema),
  storedCaptures: z.number().int().nonnegative(),
  basis: z.literal(
    'exact normalized printed medicine name; company/presentation identity is not established',
  ),
  coverage: z.string(),
});
export type MedicineArchive = z.infer<typeof medicineArchiveSchema>;
