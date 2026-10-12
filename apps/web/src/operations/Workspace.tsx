import { useCallback, useEffect, useState } from 'react';

import type { Investigation } from '@vitalink/contracts';

import { isWatched, operations, type Dashboard } from './api';
import { Evidence } from './Evidence';
import { Globe } from './Globe';
import { InvestigationPanel } from './InvestigationPanel';
import { MonitorRail } from './MonitorRail';
import './operations.css';
import './candidates.css';

const POLL_MS = 15000;
export function Workspace({
  onSignOut,
  onTools,
}: {
  onSignOut: () => void;
  onTools: () => void;
}): React.ReactElement {
  const [data, setData] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<Investigation | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('ALL');
  const [sourceStatus, setSourceStatus] = useState('ALL');
  const [watchOnly, setWatchOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setData(await operations.dashboard());
  }, []);
  useEffect(() => {
    const load = (): void => {
      void reload().catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load workspace');
      });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [reload]);
  async function act(task: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed');
    } finally {
      setBusy(false);
    }
  }
  function choose(id: string): void {
    setSelected(id);
    setRecord(null);
  }
  const incidents = data?.incidents ?? [];
  const visible = incidents.filter(
    (one) =>
      (kind === 'ALL' || one.kind === kind) &&
      (sourceStatus === 'ALL' || one.status === sourceStatus) &&
      (!watchOnly || isWatched(one, data?.watches ?? [])) &&
      `${one.title} ${one.company} ${one.reason} ${one.genericNames.join(' ')} ${one.productNdcs.join(' ')} ${one.substances.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const incident = incidents.find((one) => one.id === selected) ?? null;
  return (
    <div className="op-workspace">
      <Globe
        incidents={visible}
        selected={record?.incidentSnapshot ?? incident}
        onSelect={choose}
      />
      <header className="op-header">
        <div className="op-brand">
          <span className="op-brand-icon">⌁</span>
          <div>
            VITALINK<small>PHARMACEUTICAL SUPPLY INTELLIGENCE</small>
          </div>
        </div>
        <div className="op-header-center">
          <span className={`op-dot ${data?.worker.online ? 'cyan' : 'amber'}`} />
          {monitorLabel(data)}
          <span className="op-divider" />
          FDA / US REGULATORY COVERAGE
        </div>
        <div className="op-header-actions">
          <button onClick={onTools}>Analysis tools ↗</button>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <MonitorRail
        data={data}
        visible={visible}
        selected={selected}
        record={record}
        query={query}
        kind={kind}
        sourceStatus={sourceStatus}
        setSourceStatus={setSourceStatus}
        watchOnly={watchOnly}
        setQuery={setQuery}
        setKind={(value) => {
          setKind(value);
          setSourceStatus('ALL');
        }}
        setWatchOnly={setWatchOnly}
        choose={choose}
        openCase={(one) => {
          setRecord(one);
          setSelected(one.incidentId);
        }}
        busy={busy}
        act={act}
        notice={setNotice}
      />
      {(incident || record) && (
        <aside className="op-detail op-panel">
          <div className="op-detail-top">
            <span>DISRUPTION WORKSPACE</span>
            <button
              aria-label="Close detail panel"
              onClick={() => {
                setSelected(null);
                setRecord(null);
              }}
            >
              ×
            </button>
          </div>
          <div className="op-detail-body">
            {record ? (
              <InvestigationPanel
                key={record.id}
                record={record}
                busy={busy}
                change={(body, action) => {
                  void act(async () => {
                    setRecord(await operations.change(record.id, body, action));
                  });
                }}
              />
            ) : (
              incident && (
                <Evidence
                  incident={incident}
                  busy={busy}
                  onInvestigate={() => {
                    void act(async () => {
                      const existing = data?.investigations.find(
                        (one) => one.incidentId === incident.id && one.status !== 'CLOSED',
                      );
                      setRecord(existing ?? (await operations.create(incident.id)));
                    });
                  }}
                />
              )
            )}
          </div>
        </aside>
      )}
      {!incident && !record && (
        <div className="op-map-title">
          <div className="op-section-label">OBSERVE → INVESTIGATE → RESPOND</div>
          <h2>
            Medicine supply,
            <br />
            <em>in context.</em>
          </h2>
          <p>
            Select a regulatory event to inspect the evidence
            <br />
            and begin a traceable investigation.
          </p>
        </div>
      )}
      {(error || notice || busy) && (
        <div className={`op-toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
          {messageLabel(error, busy, notice)}
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
          >
            ×
          </button>
        </div>
      )}
      <footer className="op-dock">
        <span className="op-dot cyan" />
        <b>REGULATORY INTELLIGENCE</b>
        <span>FDA records</span>
        <span>Evidence-linked analysis</span>
        <span>Operator decisions</span>
        <span className="op-dock-end">PUBLIC DATA ≠ PRIVATE INVENTORY</span>
      </footer>
    </div>
  );
}

function monitorLabel(data: Dashboard | null): string {
  if (!data) return 'CONNECTING';
  return data.worker.online ? 'MONITOR ONLINE' : 'WORKER OFFLINE';
}

function messageLabel(error: string | null, busy: boolean, notice: string | null): string | null {
  if (error) return error;
  return busy ? 'Working… Requests to public sources may take a moment.' : notice;
}
