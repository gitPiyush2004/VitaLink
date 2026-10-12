import { useEffect, useState } from 'react';

import type { HistoricalShortageRow, MedicineArchive } from '@vitalink/contracts';

import { operations } from './api';

export function archiveDateWarnings(row: HistoricalShortageRow, capturedAt: string): string[] {
  return [
    ...row.dateIssues,
    ...(['initialPostingDate', 'updateDate', 'changeDate'] as const).flatMap((field) => {
      const value = row[field];
      return value !== null && value > capturedAt.slice(0, 10)
        ? [
            `${field} (${value}) falls after capture; retained but unusable as a historical event date.`,
          ]
        : [];
    }),
  ];
}
export function ArchiveHistoryPanel({ id }: { id: string }): React.ReactElement {
  const [archive, setArchive] = useState<MedicineArchive | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void operations
      .archive(id)
      .then((value) => {
        if (active) setArchive(value);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Archive evidence unavailable.');
        }
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section>
      <h3>Archived FDA medicine observations</h3>
      <p className="op-muted">
        Earlier source captures, separate from live fact tracking. Printed medicine-name
        associations do not establish the identity of this product NDC.
      </p>
      {error && (
        <p role="alert" className="op-callout">
          {error} Reopen History to try again.
        </p>
      )}
      {!archive && !error && <p role="status">Loading archived observations…</p>}
      {archive && (
        <>
          <p className="op-muted">{archive.coverage}</p>
          <div className="op-current-source">
            <b>{archive.printedMedicineName}</b>
            <p>
              {archive.observations.length} matching captures from {archive.storedCaptures} imported
              captures.
            </p>
            <small>{archive.basis}</small>
          </div>
          {archive.observations.length === 0 && (
            <p className="op-empty">
              {archive.storedCaptures === 0
                ? 'No verified archive collection has been imported. Live tracking and preserved case evidence are still available.'
                : 'No exact printed-name association was found. We have not guessed a historical product match.'}
            </p>
          )}
          {[...archive.observations].reverse().map((observation) => (
            <details key={observation.snapshotId}>
              <summary>
                {observation.capture.capturedAt.slice(0, 10)} UTC · {observation.rows.length}{' '}
                retained presentation rows
              </summary>
              <p>
                {(['Current', 'Resolved', 'To Be Discontinued', 'Unknown'] as const)
                  .map(
                    (status) =>
                      `${status}: ${String(observation.rows.filter((r) => r.status === status).length)}`,
                  )
                  .join('; ')}
                . Counts are source rows, not independent shortage episodes.
              </p>
              <a href={observation.provenance.source_url} target="_blank" rel="noreferrer">
                Original archived FDA CSV
              </a>
              <p>
                Source captured {observation.capture.capturedAt}; retrieved later at{' '}
                {observation.provenance.fetched_at}.
              </p>
              <p>
                Parser {observation.parser.version}: {observation.parser.mode}.
              </p>
              {observation.parser.issues.map((issue) => (
                <p className="op-callout" key={issue}>
                  {issue}
                </p>
              ))}
              {observation.rows.map((row) => (
                <article className="op-archive-row" key={`${row.key}:${String(row.sourceRow)}`}>
                  <b>
                    {row.companyName ?? 'Company not supplied'} · {row.status}
                  </b>
                  <p>{row.presentation ?? 'Presentation not supplied'}</p>
                  <p>
                    Availability: {row.availability ?? 'Not supplied'}. Reason:{' '}
                    {row.reason ?? 'Not supplied'}.
                  </p>
                  <small>CSV record {row.sourceRow}</small>
                  {archiveDateWarnings(row, observation.capture.capturedAt).map((warning) => (
                    <p className="op-callout" key={warning}>
                      {warning}
                    </p>
                  ))}
                </article>
              ))}
              <p>Original decoded CSV SHA-256: {observation.bodySha256}</p>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
