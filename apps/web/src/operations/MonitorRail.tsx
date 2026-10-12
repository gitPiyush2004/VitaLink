import { useState } from 'react';

import type { Incident, Investigation } from '@vitalink/contracts';

import { dateLabel, isWatched, type Dashboard } from './api';
import { hasMappedLocation, type RecordScope } from './globe-data';
import { SourcePanel } from './SourcePanel';

export type DrawerMode = 'events' | 'cases' | 'sources';
export function MonitorRail({
  data,
  visible,
  selected,
  record,
  query,
  kind,
  sourceStatus,
  setSourceStatus,
  watchOnly,
  setKind,
  setWatchOnly,
  choose,
  openCase,
  busy,
  act,
  notice,
  mode,
  setMode,
  scope,
  setScope,
  placeLabel,
  close,
}: {
  data: Dashboard | null;
  visible: Incident[];
  selected: string | null;
  record: Investigation | null;
  query: string;
  kind: string;
  sourceStatus: string;
  setSourceStatus: (value: string) => void;
  watchOnly: boolean;
  setKind: (value: string) => void;
  setWatchOnly: (value: boolean) => void;
  choose: (id: string) => void;
  openCase: (one: Investigation) => void;
  busy: boolean;
  act: (task: () => Promise<unknown>) => Promise<void>;
  notice: (message: string) => void;
  mode: DrawerMode;
  setMode: (mode: DrawerMode) => void;
  scope: RecordScope;
  setScope: (scope: RecordScope) => void;
  placeLabel: string;
  close: () => void;
}): React.ReactElement {
  const [showClosed, setShowClosed] = useState(false);
  const cases = data?.investigations.filter((one) => showClosed || one.status !== 'CLOSED') ?? [];
  const located = visible.filter(hasMappedLocation).length;
  const heading = { events: 'Source records', cases: 'Investigations', sources: 'Source health' }[
    mode
  ];
  return (
    <aside className="op-rail op-panel" aria-label="Record drawer">
      <div className="op-rail-head">
        <div>
          <span className="op-section-label">FDA evidence</span>
          <h1>
            {heading}
            <span>
              {mode === 'events'
                ? visible.length
                : mode === 'cases'
                  ? cases.length
                  : (data?.feeds.length ?? '…')}
            </span>
          </h1>
        </div>
        <button aria-label="Close record drawer" onClick={close}>
          ×
        </button>
      </div>
      <nav className="op-tabs" aria-label="Record drawer sections">
        {(['events', 'cases', 'sources'] as const).map((one) => (
          <button
            key={one}
            aria-pressed={mode === one}
            onClick={() => {
              setMode(one);
            }}
          >
            {one === 'events' ? 'Records' : one === 'cases' ? 'Cases' : 'Sources'}
          </button>
        ))}
      </nav>
      {mode === 'events' && (
        <>
          {scope === 'place' && (
            <div className="op-place-scope">
              <strong>{placeLabel}</strong>
              <small>Reported firm cities; not manufacturing sites.</small>
              <button
                onClick={() => {
                  setScope('all');
                }}
              >
                Clear place selection
              </button>
            </div>
          )}
          <div className="op-filters">
            {query && (
              <p className="op-search-context">
                Results for <strong>“{query}”</strong>
              </p>
            )}
            <div className="op-title-row">
              <select
                aria-label="Event type"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                }}
              >
                <option value="ALL">All events</option>
                <option value="RECALL">Recalls</option>
                <option value="SHORTAGE">Shortages</option>
              </select>
              <button
                aria-pressed={watchOnly}
                onClick={() => {
                  setWatchOnly(!watchOnly);
                }}
              >
                ☆ Watches
              </button>
            </div>
            <select
              aria-label="Source status"
              value={sourceStatus}
              onChange={(event) => {
                setSourceStatus(event.target.value);
              }}
            >
              <option value="ALL">All source statuses</option>
              {[
                ...new Set(
                  (data?.incidents ?? [])
                    .filter((one) => kind === 'ALL' || one.kind === kind)
                    .map((one) => one.status),
                ),
              ]
                .sort()
                .map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
            </select>
            {scope !== 'place' && (
              <div className="op-scope-tabs" aria-label="Location filter">
                {(['all', 'mapped', 'unmapped'] as const).map((one) => (
                  <button
                    key={one}
                    aria-pressed={scope === one}
                    onClick={() => {
                      setScope(one);
                    }}
                  >
                    {one === 'all' ? 'All' : one === 'mapped' ? 'Mapped' : 'No location'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="op-event-list">
            {visible.map((one) => (
              <EventRow
                key={one.id}
                incident={one}
                selected={selected === one.id && !record}
                watched={isWatched(one, data?.watches ?? [])}
                onClick={() => {
                  choose(one.id);
                }}
              />
            ))}
            {visible.length === 0 && (
              <p className="op-empty">
                {data
                  ? 'No records match these filters. Clear the filters or check Sources.'
                  : 'Loading FDA records…'}
              </p>
            )}
          </div>
          <div className="op-rail-foot">
            {visible.length} source records · {located} with mapped firm cities
            <br />
            Shortage presentations have national evidence scope.
          </div>
        </>
      )}
      {mode === 'cases' && (
        <>
          <div className="op-filters">
            <button
              aria-pressed={showClosed}
              onClick={() => {
                setShowClosed(!showClosed);
              }}
            >
              {showClosed ? 'Hide closed cases' : 'Show closed cases'}
            </button>
          </div>
          <div className="op-event-list">
            {cases.map((one) => (
              <button
                className={`op-event ${record?.id === one.id ? 'active' : ''}`}
                key={one.id}
                onClick={() => {
                  openCase(one);
                }}
              >
                <span className="op-tag cyan">
                  {one.status === 'ACTIONED' ? 'Decision recorded' : one.status}
                </span>
                <strong>{one.analysis?.drugName ?? one.title}</strong>
                <small>{dateLabel(one.updatedAt)}</small>
              </button>
            ))}
            {cases.length === 0 && (
              <p className="op-empty">
                Select a source record and open an investigation to preserve its evidence.
              </p>
            )}
          </div>
        </>
      )}
      {mode === 'sources' && <SourcePanel data={data} busy={busy} act={act} notice={notice} />}
    </aside>
  );
}
function EventRow({
  incident,
  selected,
  watched,
  onClick,
}: {
  incident: Incident;
  selected: boolean;
  watched: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button className={`op-event ${selected ? 'active' : ''}`} onClick={onClick}>
      <div className="op-title-row">
        <span
          className={`op-tag ${incident.classification === 'Class I' ? 'red' : incident.kind === 'RECALL' ? 'amber' : 'cyan'}`}
        >
          {incident.kind}
          {incident.classification ? ` / ${incident.classification}` : ''}
        </span>
        {watched && <span className="op-watch-star">★</span>}
        <small>
          {incident.publishedAt
            ? new Date(incident.publishedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : 'Date unknown'}
        </small>
      </div>
      <strong>{incident.title}</strong>
      <span className="op-event-company">{incident.company}</span>
      <div className="op-event-meta">
        <span>
          {hasMappedLocation(incident)
            ? incident.location?.city
            : incident.kind === 'SHORTAGE'
              ? 'National evidence'
              : 'Unmapped firm'}
        </span>
        <span>{incident.status}</span>
      </div>
    </button>
  );
}
