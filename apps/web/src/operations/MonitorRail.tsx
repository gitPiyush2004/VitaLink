import { useState } from 'react';

import type { Incident, Investigation } from '@vitalink/contracts';

import { dateLabel, isWatched, type Dashboard } from './api';
import { SourcePanel } from './SourcePanel';

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
  setQuery,
  setKind,
  setWatchOnly,
  choose,
  openCase,
  busy,
  act,
  notice,
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
  setQuery: (value: string) => void;
  setKind: (value: string) => void;
  setWatchOnly: (value: boolean) => void;
  choose: (id: string) => void;
  openCase: (one: Investigation) => void;
  busy: boolean;
  act: (task: () => Promise<unknown>) => Promise<void>;
  notice: (message: string) => void;
}): React.ReactElement {
  const [mode, setMode] = useState<'events' | 'cases' | 'sources'>('events');
  const openCases = data?.investigations.filter((one) => one.status !== 'CLOSED').length ?? 0;
  const located = visible.filter((one) => one.location?.coordinates).length;
  return (
    <aside className="op-rail op-panel">
      <div className="op-rail-head">
        <div className="op-section-label">OPERATIONS / PUBLIC SOURCES</div>
        <h1>
          Disruption monitor<span>{data ? data.incidents.length : '…'}</span>
        </h1>
        <p>Find the event. Trace the medicine. Record the response.</p>
      </div>
      <nav className="op-tabs">
        {(['events', 'cases', 'sources'] as const).map((one) => (
          <button
            key={one}
            aria-pressed={mode === one}
            onClick={() => {
              setMode(one);
            }}
          >
            {one === 'cases' ? `Investigations (${String(openCases)})` : one}
          </button>
        ))}
      </nav>
      {mode === 'events' && (
        <>
          <div className="op-filters">
            <input
              aria-label="Search events"
              placeholder="Search medicine, company, reason…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
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
                ☆ Watchlist
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
                  ? 'No events match these filters. If the catalogue is empty, open Sources to refresh.'
                  : 'Loading regulatory records…'}
              </p>
            )}
          </div>
          <div className="op-rail-foot">
            {visible.length} records · {located} geolocated
            <br />
            Unlocated events stay in this list.
          </div>
        </>
      )}
      {mode === 'cases' && (
        <div className="op-event-list">
          {data?.investigations.map((one) => (
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
          {data?.investigations.length === 0 && (
            <p className="op-empty">
              Select an event and open an investigation to preserve evidence and start analysis.
            </p>
          )}
        </div>
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
      </div>
      <strong>{incident.title}</strong>
      <span className="op-event-company">{incident.company}</span>
      <div className="op-event-meta">
        <span>{incident.location?.city ?? 'No reported location'}</span>
        <span>{incident.status}</span>
      </div>
    </button>
  );
}
