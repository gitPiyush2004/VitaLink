import type { InvestigationAnalysis, Quantity } from '@vitalink/contracts';
import { QuantityValue } from '@vitalink/ui';

function Metric({
  label,
  quantity,
}: {
  label: string;
  quantity: Quantity | null;
}): React.ReactElement {
  return (
    <div className="op-metric">
      <span>{label}</span>
      <div>{quantity ? <QuantityValue quantity={quantity} /> : 'Unavailable'}</div>
      {quantity && (
        <details>
          <summary>Source & method</summary>
          <pre>{JSON.stringify(quantity.provenance, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
export function Analysis({ analysis }: { analysis: InvestigationAnalysis }): React.ReactElement {
  const drug = analysis.nodes.find((node) => node.type === 'drug');
  const neighbours = analysis.nodes.filter((node) => node.id !== drug?.id);
  return (
    <>
      <div className="op-section-label">02 / MEDICINE EXPOSURE</div>
      <h3>{analysis.drugName}</h3>
      <div className="op-callout">
        <b>{analysis.match.kind.toUpperCase()} RELATIONSHIP</b>
        <p>{analysis.match.reason}</p>
      </div>
      <div className="op-metrics">
        <Metric label="Labelers observed" quantity={analysis.labelerCount} />
        <Metric label="Listing concentration" quantity={analysis.concentration} />
      </div>
      <details open>
        <summary>
          Evidence network · {analysis.nodes.length} nodes / {analysis.edges.length} links
        </summary>
        <div className="op-network">
          <div className="op-network-root">
            {analysis.drugName}
            <small>MEDICINE</small>
          </div>
          <div className="op-network-branches">
            {neighbours.map((node) => (
              <div key={node.id}>
                <span>{node.label}</span>
                <small>{node.type === 'manufacturer' ? 'labeler' : node.type}</small>
              </div>
            ))}
          </div>
        </div>
        <p className="op-muted">
          Regulatory relationships from FDA listings. Lines represent relationships, not transport
          routes.
        </p>
      </details>
      <details>
        <summary>Storage evidence</summary>
        <p>
          {analysis.storage ?? 'Unclassified'} ·{' '}
          {analysis.storageText ?? 'No label storage text returned.'}
        </p>
      </details>
      <h3>Reliability model</h3>
      {analysis.reliability ? (
        <>
          <div className="op-metrics">
            <Metric label="Long-run availability" quantity={analysis.reliability.r} />
            <Metric
              label="Long-run shortage fraction"
              quantity={analysis.reliability.expected_shortage_s}
            />
          </div>
          <p className="op-muted">
            Series–parallel model · rates fitted where history supports them; paper baselines
            otherwise. These ranges are sensitivity bands, not confidence intervals.
          </p>
          <details>
            <summary>Model inputs and sensitivity</summary>
            <pre>
              {JSON.stringify(
                {
                  inputs: analysis.reliability.input,
                  rateOrigins: analysis.reliability.rate_origins,
                  availability: analysis.reliability.r,
                  assumptions: analysis.reliability.assumptions,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      ) : (
        <p className="op-callout">{analysis.reliabilityError ?? 'Model results unavailable.'}</p>
      )}
      <details>
        <summary>Assumptions and source coverage</summary>
        <ul>
          {analysis.assumptions.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        {analysis.historyProvenance && (
          <a href={analysis.historyProvenance.source_url} target="_blank" rel="noreferrer">
            Recall history source ↗
          </a>
        )}
      </details>
    </>
  );
}
