import { useEffect, useState } from 'react';

import type { Investigation } from '@vitalink/contracts';
import { QuantityValue } from '@vitalink/ui';

import { getCascade, type CascadeRow } from '../api/queries';

export function TracePanel({
  record,
  busy,
  change,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
}): React.ReactElement {
  const [shock, setShock] = useState(
    record.analysis?.nodes.find((node) => node.type === 'ingredient')?.id ?? '',
  );
  const [cover, setCover] = useState('');
  const [duration, setDuration] = useState('');
  const [cascade, setCascade] = useState<CascadeRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (record.cascadeId) {
      void getCascade(record.cascadeId)
        .then((result) => {
          if (active) setCascade(result);
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : 'Trace unavailable');
        });
    }
    return () => {
      active = false;
    };
  }, [record.cascadeId]);
  return (
    <>
      <h3>Trace a conditional disruption</h3>
      <p className="op-muted">
        Select an ingredient or labeler connected by observed FDA listings. This tests a stated
        shock; it does not declare all connected products recalled. Coverage is limited to medicines
        ingested into VitaLink.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          change(
            { shockNodeId: shock, coverDays: Number(cover), durationDays: Number(duration) },
            '/trace',
          );
        }}
      >
        <label>
          Upstream entity
          <select
            required
            value={shock}
            onChange={(event) => {
              setShock(event.target.value);
            }}
          >
            <option value="">Select a related entity</option>
            {record.analysis?.nodes
              .filter((node) => node.type !== 'drug')
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label} · {node.type === 'manufacturer' ? 'labeler' : node.type}
                </option>
              ))}
          </select>
        </label>
        <div className="op-field-row">
          <label>
            Assumed cover (days)
            <input
              required
              type="number"
              min="0"
              max="365"
              step="any"
              value={cover}
              onChange={(event) => {
                setCover(event.target.value);
              }}
            />
          </label>
          <label>
            Shock duration (days)
            <input
              required
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(event) => {
                setDuration(event.target.value);
              }}
            />
          </label>
        </div>
        <button className="op-primary" disabled={busy}>
          Run impact trace →
        </button>
      </form>
      {error && <p className="op-error">{error}</p>}
      {cascade && (
        <>
          <p className="op-callout">
            {cascade.exposedDrugs.length} medicines reached in the observed catalogue. Exposure is a
            structural index; it is not a shortage probability.
          </p>
          {cascade.exposedDrugs.map((drug) => (
            <div className="op-source" key={drug.drugId}>
              <b>{drug.label}</b>
              <p>
                Structural exposure: <QuantityValue quantity={drug.exposureQuantity} />
              </p>
              <p>
                Conditional cover: <QuantityValue quantity={drug.coverBandDays} />
              </p>
              {drug.propagationPaths.map((path, index) => (
                <p className="op-path" key={index}>
                  {path.hops
                    .map((hop) => `${hop.fromLabel} —${hop.rel}→ ${hop.toLabel}`)
                    .join(' · ')}
                </p>
              ))}
              <details>
                <summary>Projection assumptions</summary>
                <pre>
                  {JSON.stringify(
                    {
                      request: cascade.request,
                      projection: drug.coverProjection.assumptions,
                      method: drug.exposureQuantity.provenance.calculation_method,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          ))}
          <p className="op-muted">
            Hospital stocking relationships and patient exposure are unavailable. No affected
            hospital or population is inferred from a location alone.
          </p>
        </>
      )}
    </>
  );
}
