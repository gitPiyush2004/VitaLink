import { useEffect, useState } from 'react';

import { QuantityValue } from '@vitalink/ui';

import {
  listAlerts,
  listQuarantine,
  listSignals,
  runIngest,
  runVerify,
  type AlertRow,
  type QuarantineRow,
  type SignalRow,
} from '../api/queries';

import { dateLabel } from './api';

type News = { signals: SignalRow[]; alerts: AlertRow[]; quarantine: QuarantineRow[] };
export function NewsPanel(): React.ReactElement {
  const [data, setData] = useState<News | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  async function reload(): Promise<void> {
    const [signals, alerts, quarantine] = await Promise.all([
      listSignals(),
      listAlerts(),
      listQuarantine(),
    ]);
    setData({ signals, alerts, quarantine });
  }
  useEffect(() => {
    void reload().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Signal records unavailable');
    });
  }, []);
  async function run(stage: 'ingest' | 'verify'): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (stage === 'ingest') {
        const result = await runIngest();
        setOutcome(
          `${result.signalsStored} signals stored. ${result.sourceFailures.length} source failures. ${result.sourceFailures.map((one) => `${one.source}: ${one.error}`).join(' ')}`,
        );
      } else {
        const result = await runVerify();
        setOutcome(
          `${result.clustersConsidered} clusters considered; ${result.alertsPublished} alerts published; ${result.quarantined} quarantined. ${result.corroborationBudget.note}`,
        );
      }
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Signal processing failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="op-news">
      <summary>Signal corroboration & quarantine</summary>
      <p className="op-muted">
        FDA records in the monitor are official regulatory evidence. News signals use a separate
        corroboration gate. Unverified signals are never presented as confirmed disruptions.
      </p>
      <div className="op-actions">
        <button
          disabled={busy}
          onClick={() => {
            void run('ingest');
          }}
        >
          Fetch signals
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void run('verify');
          }}
        >
          Run verification
        </button>
      </div>
      {busy && <p role="status">Checking public sources…</p>}
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {outcome && <p className="op-callout">{outcome}</p>}
      <h3>Published alerts</h3>
      {data?.alerts.length === 0 && (
        <p className="op-muted">
          No published alerts. Absence of an alert does not establish safety.
        </p>
      )}
      {data?.alerts.map((alert) => (
        <div className="op-source" key={alert.id}>
          <span className={`op-tag ${alert.verified ? 'cyan' : 'amber'}`}>
            {alert.verified ? 'CORROBORATED' : 'UNVERIFIED'}
          </span>
          <p>{alert.insight}</p>
          <small>
            {alert.independentSourceCount} independent sources · {alert.resolutionBasis}
          </small>
          <p>
            <QuantityValue quantity={alert.veracity} />
          </p>
          {alert.corroborations.map((source) => (
            <p key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.independence_key} ↗
              </a>
            </p>
          ))}
        </div>
      ))}
      <h3>Recent quarantined signals</h3>
      {data?.quarantine.length === 0 && (
        <p className="op-muted">
          No quarantine records yet. Fetch and verify signals to evaluate them.
        </p>
      )}
      {data?.quarantine.map((one) => (
        <div className="op-source" key={one.id}>
          <span className="op-tag amber">{one.reason}</span>
          <p>{one.extraction?.insight ?? one.detail}</p>
          <small>
            {one.detail} · {one.independentSourceCount} independent sources
          </small>
        </div>
      ))}
      <h3>Recent source signals</h3>
      {data?.signals.length === 0 && <p className="op-muted">No signals ingested yet.</p>}
      {data?.signals.map((one) => (
        <div className="op-source" key={one.id}>
          <small>
            {one.source} · {dateLabel(one.publishedAt)} · {one.extractionMethod}
          </small>
          <p>
            <a href={one.url} target="_blank" rel="noreferrer">
              {one.title} ↗
            </a>
          </p>
          <small>{one.extractionBasis}</small>
        </div>
      ))}
    </details>
  );
}
