import { useEffect, useState } from 'react';

import type { IncidentHistory } from '@vitalink/contracts';

import { dateLabel, operations } from './api';
import { Evidence } from './Evidence';
import { sourceChanges } from './source-history';

export function HistoryPanel({
  incidentId,
  refreshKey,
}: {
  incidentId: string;
  refreshKey: string;
}): React.ReactElement {
  const [history, setHistory] = useState<IncidentHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [versionId, setVersionId] = useState('');
  useEffect(() => {
    let active = true;
    setHistory(null);
    setError(null);
    setVersionId('');
    void operations
      .history(incidentId)
      .then((value) => {
        if (active) setHistory(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'History unavailable.');
      });
    return () => {
      active = false;
    };
  }, [incidentId, refreshKey, revision]);
  const selectedVersion = history?.versions.find((version) => version.id === versionId);
  return (
    <section className="op-history">
      <div className="op-title-row">
        <h3>Observed source changes</h3>
        <button
          onClick={() => {
            setRevision(revision + 1);
          }}
        >
          Reload history
        </button>
      </div>
      <p className="op-muted">
        Changes to FDA facts, separate from case activity. Observation times are not exact onset or
        resolution times.
      </p>
      {error && (
        <p role="alert" className="op-callout">
          {error} Reload to try again.
        </p>
      )}
      {!history && !error && <p role="status">Loading retained observations…</p>}
      {history && (
        <>
          <p className="op-muted">{history.coverage}</p>
          {history.latest ? (
            <div className="op-current-source">
              <span className="op-tag cyan">Latest monitor observation</span>
              <p>
                {history.latest.status} · availability:{' '}
                {history.latest.availability ?? 'Not supplied'}
              </p>
              <small>Source fetched {dateLabel(history.latest.provenance.fetched_at)}</small>
            </div>
          ) : (
            <p className="op-callout">
              Absent from the current bounded monitor. Resolution is unknown unless a retained
              source observation explicitly reports it.
            </p>
          )}
          {history.hasMore && (
            <p className="op-callout">
              Showing the 100 most recent retained versions. Earlier versions are outside this view.
            </p>
          )}
          {history.versions.length > 0 && (
            <div className="op-version-inspector">
              <label>
                Inspect a retained source version
                <select
                  value={versionId}
                  onChange={(event) => {
                    setVersionId(event.target.value);
                  }}
                >
                  <option value="">Select an observation</option>
                  {history.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {dateLabel(version.observedAt)} ·{' '}
                      {version.origin === 'retained_before_tracking'
                        ? 'Legacy observation'
                        : 'Source refresh'}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Only recorded observations can be selected. Gaps are not interpolated; source fetch
                times and fact dates remain separate.
              </p>
              {selectedVersion && (
                <Evidence
                  incident={selectedVersion.snapshot}
                  preserved
                  snapshotLabel="Selected retained source observation"
                  busy
                  onInvestigate={() => undefined}
                />
              )}
            </div>
          )}
          {history.versions.length === 0 && (
            <p className="op-empty">
              No tracked versions yet. The case still preserves its opening evidence. Refresh the
              source to start retaining observations.
            </p>
          )}
          <ol className="op-timeline">
            {[...history.versions].reverse().map((version, index) => {
              const previous = history.versions[history.versions.length - index - 2];
              const changes = previous ? sourceChanges(previous.snapshot, version.snapshot) : [];
              return (
                <li key={version.id}>
                  <time>{dateLabel(version.observedAt)}</time>
                  <h4>{previous ? 'Source facts changed' : 'First retained observation'}</h4>
                  <p className="op-muted">
                    {version.origin === 'retained_before_tracking'
                      ? 'Retained from before history tracking began; earlier changes are unavailable.'
                      : 'Observed during source refresh.'}
                  </p>
                  {previous ? (
                    changes.map((change) => (
                      <div key={change.field} className="op-field-change">
                        <b>{change.label}</b>
                        <div>
                          <span>Previously</span>
                          <p>{change.before}</p>
                        </div>
                        <div>
                          <span>Observed now</span>
                          <p>{change.after}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <dl className="op-facts">
                      <dt>Status</dt>
                      <dd>{version.snapshot.status}</dd>
                      <dt>Availability</dt>
                      <dd>{version.snapshot.availability ?? 'Not supplied'}</dd>
                      <dt>Reason</dt>
                      <dd>{version.snapshot.reason}</dd>
                    </dl>
                  )}
                  {previous && changes.length === 0 && (
                    <p>
                      The normalized record changed in other fields. Open the preserved snapshot
                      below.
                    </p>
                  )}
                  <details>
                    <summary>Source and preserved record</summary>
                    <p>
                      Retained {dateLabel(version.recordedAt)}. Fingerprint: {version.digest}
                    </p>
                    <a
                      href={version.snapshot.provenance.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source retrieval query
                    </a>
                    <pre>{JSON.stringify(version.snapshot, null, 2)}</pre>
                  </details>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
