import { useEffect, useState } from 'react';

import type { InvestigationReport } from '@vitalink/contracts';

import { dateLabel, operations } from './api';
import { renderInvestigationReport } from './report';

export function downloadEvidence(contents: string, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
export function ReportPanel({
  id,
  updatedAt,
}: {
  id: string;
  updatedAt: string;
}): React.ReactElement {
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    void operations
      .report(id)
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Report unavailable.');
      });
    return () => {
      active = false;
    };
  }, [id, updatedAt, revision]);
  const html = report ? renderInvestigationReport(report) : null;
  return (
    <section>
      <h3>Investigation report</h3>
      <p className="op-muted">
        A readable record of the evidence, candidate reasoning, observed changes and your next
        action. Download it to read offline or use your browser’s Print command to save a PDF.
      </p>
      <div className="op-report-actions">
        <button
          disabled={!html}
          className="op-primary"
          onClick={() => {
            if (html) {
              downloadEvidence(html, 'text/html;charset=utf-8', `vitalink-${id}-report.html`);
            }
          }}
        >
          Download readable report
        </button>
        <button
          disabled={!report}
          onClick={() => {
            if (report) {
              downloadEvidence(
                JSON.stringify(report, null, 2),
                'application/json',
                `vitalink-${id}-evidence.json`,
              );
            }
          }}
        >
          Download evidence JSON
        </button>
        <button
          onClick={() => {
            setRevision(revision + 1);
          }}
        >
          Refresh report
        </button>
      </div>
      {error && (
        <p className="op-callout" role="alert">
          {error} Refresh to try again.
        </p>
      )}
      {!report && !error && <p role="status">Preparing the report…</p>}
      {report && (
        <p className="op-muted">
          Generated {dateLabel(report.generatedAt)}. Case updated{' '}
          {dateLabel(report.investigation.updatedAt)}.
        </p>
      )}
      {html && (
        <iframe
          title="Investigation report preview"
          className="op-report-preview"
          srcDoc={html}
          sandbox=""
        />
      )}
    </section>
  );
}
