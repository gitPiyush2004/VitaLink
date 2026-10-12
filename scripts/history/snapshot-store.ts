/** Content-addressed source bodies and immutable, schema-checked metadata. */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { archiveReplayUrl, archiveTimestampToIso, parseArchiveCsv } from '@vitalink/connectors';
import {
  archiveCaptureSchema,
  provenanceSchema,
  shortageSnapshotSchema,
  type ShortageSnapshot,
} from '@vitalink/contracts';

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
export function writeImmutable(path: string, text: string): void {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, text, { flag: 'wx', mode: 0o444 });
  try {
    // A hard link publishes complete content atomically and refuses replacement.
    linkSync(temporary, path);
  } catch (error) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) throw error;
  } finally {
    rmSync(temporary, { force: true });
  }
}
export class SnapshotStore {
  constructor(readonly root: string) {
    mkdirSync(join(root, 'bodies'), { recursive: true });
    mkdirSync(join(root, 'snapshots'), { recursive: true });
  }
  putBody(rawBody: string): string {
    const hash = sha256(rawBody);
    writeImmutable(join(this.root, 'bodies', `${hash}.csv`), rawBody);
    return hash;
  }
  findCapture(timestamp: string) {
    if (!/^\d{14}$/.test(timestamp)) throw new Error('Invalid capture timestamp.');
    const ids = readdirSync(join(this.root, 'snapshots')).filter(
      (name) => name.startsWith(`${timestamp}-`) && name.endsWith('.json'),
    );
    if (ids.length !== 1) return null;
    // Reuse only the original body and retrieval provenance. Derived rows from
    // older parser interpretations are never trusted or copied.
    const saved = z
      .object({
        bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
        capture: archiveCaptureSchema,
        provenance: provenanceSchema,
      })
      .parse(JSON.parse(readFileSync(join(this.root, 'snapshots', ids[0] ?? ''), 'utf8')));
    const rawBody = readFileSync(join(this.root, 'bodies', `${saved.bodySha256}.csv`), 'utf8');
    if (
      sha256(rawBody) !== saved.bodySha256 ||
      ids[0] !== `${timestamp}-${saved.bodySha256}.json` ||
      saved.capture.timestamp !== timestamp ||
      archiveTimestampToIso(timestamp) !== saved.capture.capturedAt ||
      archiveReplayUrl(saved.capture) !== saved.provenance.source_url
    ) {
      throw new Error('Reusable original source integrity check failed.');
    }
    return { capture: saved.capture, provenance: saved.provenance, rawBody };
  }
  put(snapshot: ShortageSnapshot, rawBody: string): string {
    shortageSnapshotSchema.parse(snapshot);
    if (sha256(rawBody) !== snapshot.bodySha256 || snapshot.rows.length !== snapshot.rowCount) {
      throw new Error('Source body hash or row count does not match snapshot metadata.');
    }
    const id = `${snapshot.capture.timestamp}-${snapshot.bodySha256}`;
    this.putBody(rawBody);
    const path = join(this.root, 'snapshots', `${id}.json`);
    if (existsSync(path)) {
      const saved = this.load(id);
      if (
        JSON.stringify(saved.rows) !== JSON.stringify(snapshot.rows) ||
        JSON.stringify(saved.capture) !== JSON.stringify(snapshot.capture)
      ) {
        throw new Error(
          'Existing snapshot interpretation differs; version the parser instead of overwriting.',
        );
      }
    } else {
      writeImmutable(path, JSON.stringify(snapshot, null, 2) + '\n');
    }
    return id;
  }
  load(id: string): ShortageSnapshot {
    if (!/^\d{14}-[a-f0-9]{64}$/.test(id)) throw new Error('Invalid snapshot identifier.');
    const snapshot = shortageSnapshotSchema.parse(
      JSON.parse(readFileSync(join(this.root, 'snapshots', `${id}.json`), 'utf8')),
    );
    const body = readFileSync(join(this.root, 'bodies', `${snapshot.bodySha256}.csv`), 'utf8');
    if (
      sha256(body) !== snapshot.bodySha256 ||
      `${snapshot.capture.timestamp}-${snapshot.bodySha256}` !== id ||
      snapshot.rows.length !== snapshot.rowCount
    ) {
      throw new Error('Snapshot integrity validation failed.');
    }
    const interpreted = parseArchiveCsv(body);
    if (
      JSON.stringify(interpreted.rows) !== JSON.stringify(snapshot.rows) ||
      JSON.stringify(interpreted.parser) !== JSON.stringify(snapshot.parser) ||
      archiveTimestampToIso(snapshot.capture.timestamp) !== snapshot.capture.capturedAt ||
      archiveReplayUrl(snapshot.capture) !== snapshot.provenance.source_url
    ) {
      throw new Error('Snapshot interpretation or capture provenance integrity validation failed.');
    }
    return snapshot;
  }
}
