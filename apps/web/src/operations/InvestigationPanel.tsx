import { useState } from 'react';

import type { Investigation } from '@vitalink/contracts';

import { Analysis } from './Analysis';
import { ArchiveHistoryPanel } from './ArchiveHistoryPanel';
import { CandidatesPanel } from './CandidatesPanel';
import { DecisionPanel } from './DecisionPanel';
import { Evidence } from './Evidence';
import { HistoryPanel } from './HistoryPanel';
import { downloadEvidence, ReportPanel } from './ReportPanel';
import { ScenarioTools } from './ScenarioTools';

const tabs = [
  'evidence',
  'analysis',
  'alternatives',
  'history',
  'decision',
  'report',
  'scenarios',
] as const;
export function InvestigationPanel({
  record,
  busy,
  change,
  onSectionChange,
}: {
  record: Investigation;
  busy: boolean;
  change: (body: unknown, action?: string) => void;
  onSectionChange?: (section: (typeof tabs)[number]) => void;
}): React.ReactElement {
  const [generic, setGeneric] = useState(
    record.analysis?.drugName ?? record.incidentSnapshot.genericNames[0] ?? '',
  );
  const [tab, setTab] = useState<(typeof tabs)[number]>('evidence');
  return (
    <>
      <div className="op-section-label">Investigation / {record.id.slice(0, 8)}</div>
      <h2>{record.analysis?.drugName ?? record.title}</h2>
      <div className="op-title-row">
        <span className="op-tag cyan">
          {record.status === 'ACTIONED' ? 'Decision recorded' : record.status}
        </span>
        <button
          onClick={() => {
            downloadEvidence(
              JSON.stringify(record, null, 2),
              'application/json',
              `vitalink-${record.id}.json`,
            );
          }}
        >
          Case JSON
        </button>
      </div>
      <nav className="op-tabs" aria-label="Investigation sections">
        {tabs.map((name) => (
          <button
            key={name}
            aria-pressed={tab === name}
            onClick={(event) => {
              setTab(name);
              onSectionChange?.(name);
              event.currentTarget.closest('.op-detail-body')?.scrollTo({ top: 0 });
            }}
          >
            {name === 'alternatives'
              ? 'Candidates'
              : name === 'scenarios'
                ? 'Optional tools'
                : name}
          </button>
        ))}
      </nav>
      {tab === 'evidence' && (
        <Evidence
          incident={record.incidentSnapshot}
          busy
          onInvestigate={() => undefined}
          preserved
        />
      )}
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
                  : 'Identify related medicine'}
            </button>
          </form>
          <p className="op-muted">
            Checks product identifiers, exact generic names, ingredients and company relationships.
            A company match alone does not establish an affected product.
          </p>
          {record.analysis && <Analysis analysis={record.analysis} />}
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
          <p className="op-empty">
            Identify a related medicine in Analysis before discovering candidates.
          </p>
        ))}
      {tab === 'history' && (
        <>
          <HistoryPanel incidentId={record.incidentId} refreshKey={record.updatedAt} />
          <ArchiveHistoryPanel id={record.id} />
        </>
      )}
      {tab === 'decision' && <DecisionPanel record={record} busy={busy} change={change} />}
      {tab === 'report' && <ReportPanel id={record.id} updatedAt={record.updatedAt} />}
      {tab === 'scenarios' && <ScenarioTools record={record} busy={busy} change={change} />}
    </>
  );
}
