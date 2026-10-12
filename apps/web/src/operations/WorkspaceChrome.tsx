import type { RefObject } from 'react';

import { dateLabel } from './api';
import type { DrawerMode } from './MonitorRail';

export function WorkspaceHeader({
  query,
  onQuery,
  onRecords,
  drawer,
  onDrawer,
  openCases,
  onSignOut,
  onCloseDrawer,
  search,
}: {
  query: string;
  onQuery: (value: string) => void;
  onRecords: () => void;
  drawer: DrawerMode | null;
  onDrawer: (mode: DrawerMode) => void;
  openCases: number;
  onSignOut: () => void;
  onCloseDrawer: () => void;
  search: RefObject<HTMLInputElement>;
}): React.ReactElement {
  return (
    <header className="op-header">
      <div className="op-brand">
        <span className="op-brand-icon" aria-hidden="true">
          ⌁
        </span>
        <div>
          VITALINK<small>Medicine supply intelligence</small>
        </div>
      </div>
      <div className="op-global-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={search}
          aria-label="Search medicine, company or NDC"
          placeholder="Search medicine, company or NDC"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
          }}
          onFocus={() => {
            if (query) onRecords();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onRecords();
            }
            if (event.key === 'Escape') {
              event.stopPropagation();
              event.currentTarget.blur();
              onCloseDrawer();
            }
          }}
        />
        {query ? (
          <button
            aria-label="Clear search"
            onClick={() => {
              onQuery('');
              search.current?.focus();
            }}
          >
            ×
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>
      <nav className="op-header-actions" aria-label="Workspace views">
        <button
          aria-pressed={drawer === 'events'}
          onClick={() => {
            onDrawer('events');
          }}
        >
          Records
        </button>
        <button
          aria-pressed={drawer === 'cases'}
          onClick={() => {
            onDrawer('cases');
          }}
        >
          Cases <span className="op-nav-count">{openCases}</span>
        </button>
        <button
          aria-pressed={drawer === 'sources'}
          onClick={() => {
            onDrawer('sources');
          }}
        >
          Sources
        </button>
        <button className="op-signout" aria-label="Sign out" onClick={onSignOut}>
          ↪
        </button>
      </nav>
    </header>
  );
}
export function LayerControl({
  open,
  onToggle,
  enabled,
  onEnabled,
  mapped,
  places,
  onMapped,
  onNational,
}: {
  open: boolean;
  onToggle: () => void;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  mapped: number;
  places: number;
  onMapped: () => void;
  onNational: () => void;
}): React.ReactElement {
  return (
    <section className="op-layer-control op-panel" aria-label="Globe layers">
      <button className="op-layer-heading" aria-expanded={open} onClick={onToggle}>
        Globe layers <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="op-layer-content">
          <label className="op-layer-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                onEnabled(event.target.checked);
              }}
            />
            <span>
              Recall locations<small>Reported firm cities</small>
            </span>
            <b>{mapped}</b>
          </label>
          <div className="op-layer-legend">
            <span>
              <i className="critical" />
              Includes Class I
            </span>
            <span>
              <i />
              Other / unclassified
            </span>
          </div>
          <button className="op-quiet-link" onClick={onMapped}>
            Inspect {places} mapped places
          </button>
          <button className="op-national-layer" onClick={onNational}>
            <span className="op-coverage-swatch" />
            US regulatory coverage<span aria-hidden="true">↗</span>
          </button>
          <p>Coverage outline; not an impact area.</p>
        </div>
      )}
    </section>
  );
}
export function WorkspaceFooter({
  online,
  loaded,
  freshness,
  sourceErrors,
  onSources,
  onTools,
}: {
  online: boolean;
  loaded: boolean;
  freshness: string | null;
  sourceErrors: number;
  onSources: () => void;
  onTools: () => void;
}): React.ReactElement {
  const monitor = !loaded ? 'Connecting' : online ? 'Monitor online' : 'Worker offline';
  return (
    <footer className="op-dock">
      <div>
        <span className={`op-dot ${online ? 'cyan' : 'amber'}`} />
        <b>{monitor}</b>
        <span>FDA / US records</span>
      </div>
      <button onClick={onSources}>
        {sourceErrors
          ? `${String(sourceErrors)} source ${sourceErrors === 1 ? 'error' : 'errors'}`
          : 'Source health'}{' '}
        <span>
          {freshness ? `Last ingestion ${dateLabel(freshness)}` : 'No successful ingestion'}
        </span>
      </button>
      <button className="op-tools-link" onClick={onTools}>
        Analysis tools ↗
      </button>
    </footer>
  );
}
export function ExplorePrompt({
  shortages,
  loaded,
  onNational,
}: {
  shortages: number;
  loaded: boolean;
  onNational: () => void;
}): React.ReactElement {
  return (
    <>
      <div className="op-explore-hint">
        <span className="op-crosshair" aria-hidden="true">
          ⌖
        </span>
        <div>
          <strong>Explore the evidence.</strong>
          <p>Select a city marker to inspect reported recalls.</p>
          <small>Markers show record counts at firm cities, not factories.</small>
        </div>
      </div>
      <button className="op-unmapped-tray" onClick={onNational}>
        <span className="op-tray-icon" aria-hidden="true">
          ≋
        </span>
        <span>
          <strong>National shortage evidence</strong>
          <small>
            {loaded ? `${String(shortages)} published presentations` : 'Loading source records…'} ·
            No site coordinates
          </small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
    </>
  );
}
