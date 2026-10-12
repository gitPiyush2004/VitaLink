import { useState } from 'react';

import type { Investigation } from '@vitalink/contracts';

import { Analysis } from './Analysis';
import { dateLabel } from './api';
import { CandidatesPanel } from './CandidatesPanel';
import { Evidence } from './Evidence';
import { LogisticsPanel } from './LogisticsPanel';
import { ResponsePlanner } from './ResponsePlanner';
import { TracePanel } from './TracePanel';

export function InvestigationPanel({
  record,
  busy,
  change,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
}): React.ReactElement {
  const [generic, setGeneric] = useState(
    record.analysis?.drugName ?? record.incidentSnapshot.genericNames[0] ?? '',
  );
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<
    'analysis' | 'alternatives' | 'trace' | 'logistics' | 'response' | 'record'
  >('analysis');
  function exportRecord(): void {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitalink-${record.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="op-section-label">INVESTIGATION / {record.id.slice(0, 8)}</div>
      <h2>{record.analysis?.drugName ?? record.title}</h2>
      <div className="op-title-row">
        <span className="op-tag cyan">{record.status}</span>
        <button onClick={exportRecord}>Export evidence ↓</button>
      </div>
      <nav className="op-tabs">
        {(['analysis', 'alternatives', 'trace', 'logistics', 'response', 'record'] as const).map(
          (one) => (
            <button
              key={one}
              aria-pressed={tab === one}
              onClick={() => {
                setTab(one);
              }}
            >
              {one}
            </button>
          ),
        )}
      </nav>
      {tab === 'analysis' && (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              change({ generic }, '/analyse');
            }}
          >
            <label>
              Medicine to investigate
              <input
                required
                minLength={2}
                maxLength={200}
                list="generic-names"
                value={generic}
                placeholder="Exact generic name from FDA"
                onChange={(event) => {
                  setGeneric(event.target.value);
                }}
              />
            </label>
            <datalist id="generic-names">
              {record.incidentSnapshot.genericNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <button className="op-primary" disabled={busy}>
              {busy
                ? 'Fetching and analysing…'
                : record.analysis
                  ? 'Refresh medicine analysis'
                  : 'Trace medicine exposure →'}
            </button>
          </form>
          <p className="op-muted">
            Checks product identifiers, exact generic names, ingredients and company relationships.
            A company match alone does not establish an affected product.
          </p>
          {record.analysis && <Analysis analysis={record.analysis} />}
          <details>
            <summary>Preserved source evidence</summary>
            <Evidence incident={record.incidentSnapshot} busy onInvestigate={() => undefined} />
          </details>
        </>
      )}
      {tab === 'alternatives' &&
        (record.analysis ? (
          <CandidatesPanel
            set={record.candidates}
            busy={busy}
            refresh={() => {
              change({}, '/candidates');
            }}
          />
        ) : (
          <p className="op-empty">Identify a related medicine before discovering alternatives.</p>
        ))}
      {tab === 'trace' &&
        (record.analysis ? (
          <TracePanel record={record} busy={busy} change={change} />
        ) : (
          <p className="op-empty">Identify a related medicine before tracing impact.</p>
        ))}
      {tab === 'logistics' && <LogisticsPanel record={record} busy={busy} change={change} />}
      {tab === 'response' &&
        (record.analysis ? (
          <ResponsePlanner
            key={record.analysis.analysedAt}
            record={record}
            busy={busy}
            save={(input) => {
              change(input, '/plan');
            }}
            select={(id) => {
              change({ selectedOptionId: id });
            }}
          />
        ) : (
          <p className="op-empty">
            Identify a related medicine in Analysis before comparing responses.
          </p>
        ))}
      {tab === 'record' && (
        <>
          <label>
            Workflow status
            <select
              value={record.status}
              disabled={busy}
              onChange={(event) => {
                change({ status: event.target.value });
              }}
            >
              {['OPEN', 'INVESTIGATING', 'ACTIONED', 'CLOSED'].map((one) => (
                <option key={one}>{one}</option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              change({ note });
              setNote('');
            }}
          >
            <label>
              Analyst note
              <textarea
                required
                maxLength={4000}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Record inventory findings, supplier contact, or the reason for your decision."
              />
            </label>
            <button disabled={busy || !note.trim()}>Save note</button>
          </form>
          <h3>Notes</h3>
          {record.notes.length === 0 && <p className="op-muted">No notes yet.</p>}
          {record.notes.map((one) => (
            <div key={one.id} className="op-audit">
              <time>{dateLabel(one.at)}</time>
              <p>{one.text}</p>
            </div>
          ))}
          <h3>Activity history</h3>
          {[...record.history].reverse().map((one, index) => (
            <div className="op-audit" key={`${one.at}-${String(index)}`}>
              <time>{dateLabel(one.at)}</time>
              <p>{one.action}</p>
              <small>Analyst {one.author.slice(0, 8)}</small>
            </div>
          ))}
        </>
      )}
    </>
  );
}
