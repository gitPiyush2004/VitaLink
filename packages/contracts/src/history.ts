/** Archived observations are separate from current operational incidents. */
import { z } from 'zod';

import { provenanceSchema } from './provenance';

export const archiveCaptureSchema = z.object({
  timestamp: z.string().regex(/^\d{14}$/),
  capturedAt: z.iso.datetime(),
  originalUrl: z.url(),
  mimeType: z.string(),
  archiveDigest: z.string(),
});
export type ArchiveCapture = z.infer<typeof archiveCaptureSchema>;

export const historicalShortageRowSchema = z.object({
  /** Source identity based on printed medicine, company and presentation; not a clinical identifier. */
  key: z.string(),
  sourceRow: z.number().int().positive(),
  genericName: z.string().min(1),
  companyName: z.string().nullable(),
  presentation: z.string().nullable(),
  status: z.enum(['Current', 'Resolved', 'To Be Discontinued', 'Unknown']),
  statusRaw: z.string().nullable(),
  availability: z.string().nullable(),
  reason: z.string().nullable(),
  therapeuticCategory: z.string().nullable(),
  /** Dates printed in the archived response; never substituted with capture time. */
  initialPostingDate: z.string().nullable(),
  updateDate: z.string().nullable(),
  changeDate: z.string().nullable(),
  discontinuedDate: z.string().nullable(),
  dateIssues: z.array(z.string()),
});
export type HistoricalShortageRow = z.infer<typeof historicalShortageRowSchema>;

export const shortageSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  parser: z.object({
    version: z.literal(1),
    mode: z.enum(['strict', 'repaired_embedded_quotes']),
    issues: z.array(z.string()),
  }),
  capture: archiveCaptureSchema,
  provenance: provenanceSchema,
  /** SHA-256 of the decoded source response text; not the archive's CDX digest. */
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  rows: z.array(historicalShortageRowSchema),
  rowCount: z.number().int().nonnegative(),
});
export type ShortageSnapshot = z.infer<typeof shortageSnapshotSchema>;
