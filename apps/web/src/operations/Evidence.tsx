import type { Incident } from '@vitalink/contracts';

import { dateLabel } from './api';

export function Evidence({
  incident,
  onInvestigate,
  busy,
}: {
  incident: Incident;
  onInvestigate: () => void;
  busy: boolean;
}): React.ReactElement {
  return (
    <>
      <div className="op-section-label">01 / SOURCE EVIDENCE</div>
      <div className="op-title-row">
        <span className={`op-tag ${incident.kind === 'RECALL' ? 'amber' : 'cyan'}`}>
          {incident.kind}
        </span>
        <span className="op-mono">{incident.classification ?? incident.status}</span>
      </div>
      <h2>{incident.title}</h2>
      <p className="op-company">{incident.company}</p>
      <p className="op-reason">{incident.reason || 'The source does not specify a reason.'}</p>
      <dl className="op-facts">
        <dt>Source status</dt>
        <dd>{incident.status}</dd>
        <dt>Reported</dt>
        <dd>{dateLabel(incident.publishedAt)}</dd>
        <dt>Source fetched</dt>
        <dd>{dateLabel(incident.provenance.fetched_at)}</dd>
        <dt>Product NDC</dt>
        <dd>{incident.productNdcs.join(', ') || 'Not supplied'}</dd>
        {incident.availability && (
          <>
            <dt>Presentation</dt>
            <dd>{incident.availability}</dd>
          </>
        )}
        {incident.location && (
          <>
            <dt>Firm location</dt>
            <dd>
              {incident.location.label}
              <small>
                City-level context ·{' '}
                {incident.location.coordinates
                  ? 'OpenStreetMap geocoded'
                  : 'Coordinates unavailable'}
              </small>
            </dd>
          </>
        )}
      </dl>
      {incident.presentation && (
        <details>
          <summary>Presentation details</summary>
          <p>{incident.presentation}</p>
        </details>
      )}
      {incident.lots && (
        <details>
          <summary>Lot / code scope</summary>
          <p>{incident.lots}</p>
        </details>
      )}
      {incident.distribution && (
        <details>
          <summary>Distribution reported by FDA</summary>
          <p>{incident.distribution}</p>
        </details>
      )}
      <div className="op-actions">
        <a className="op-link" href={incident.sourceUrl} target="_blank" rel="noreferrer">
          Open original FDA record ↗
        </a>
        <button className="op-primary" disabled={busy} onClick={onInvestigate}>
          Open investigation →
        </button>
      </div>
      <p className="op-muted">
        A regulatory event does not establish a shortage at your organisation. Investigate the
        affected product and your inventory before acting.
      </p>
    </>
  );
}
