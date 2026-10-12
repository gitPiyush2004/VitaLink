import { Globe } from './Globe';
import { MonitorRail } from './MonitorRail';
import { useWorkspace } from './useWorkspace';
import { ExplorePrompt, LayerControl, WorkspaceFooter, WorkspaceHeader } from './WorkspaceChrome';
import { WorkspaceInspector } from './WorkspaceInspector';
import './operations.css';
import './candidates.css';
import './globe-workspace.css';
export function Workspace({
  onSignOut,
  onTools,
}: {
  onSignOut: () => void;
  onTools: () => void;
}): React.ReactElement {
  const state = useWorkspace();
  const {
    data,
    selected,
    setSelected,
    record,
    setRecord,
    query,
    setQuery,
    kind,
    setKind,
    sourceStatus,
    setSourceStatus,
    watchOnly,
    setWatchOnly,
    busy,
    notice,
    setNotice,
    error,
    setError,
    drawer,
    setDrawer,
    scope,
    setScope,
    place,
    setPlace,
    locationsEnabled,
    setLocationsEnabled,
    layersOpen,
    setLayersOpen,
    expanded,
    setExpanded,
    command,
    search,
    act,
    closeDetail,
    choose,
    openRecords,
    national,
    camera,
    matches,
    visible,
    focused,
    summary,
    toggleDrawer,
  } = state;

  return (
    <div
      className={workspaceClass(Boolean(drawer), Boolean(focused), expanded)}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        if (event.key === '/' && !editing) {
          event.preventDefault();
          search.current?.focus();
        }
        if (event.key === 'Escape' && !editing) {
          if (focused) closeDetail();
          else setDrawer(null);
        }
      }}
    >
      <Globe
        incidents={matches}
        selected={focused}
        locationsEnabled={locationsEnabled}
        command={command}
        onPlace={(ids, label) => {
          closeDetail();
          setPlace({ ids, label });
          setScope('place');
          setDrawer('events');
        }}
        onNational={national}
      />
      <WorkspaceHeader
        query={query}
        search={search}
        drawer={drawer}
        openCases={summary.openCases}
        onSignOut={onSignOut}
        onQuery={(value) => {
          closeDetail();
          setQuery(value);
          setKind('ALL');
          setSourceStatus('ALL');
          setWatchOnly(false);
          setScope('all');
          setDrawer('events');
        }}
        onRecords={() => {
          closeDetail();
          openRecords();
        }}
        onDrawer={toggleDrawer}
        onCloseDrawer={() => {
          setDrawer(null);
        }}
      />
      {!drawer && (
        <LayerControl
          open={layersOpen}
          onToggle={() => {
            setLayersOpen(!layersOpen);
          }}
          enabled={locationsEnabled}
          onEnabled={setLocationsEnabled}
          mapped={summary.mapped}
          places={summary.places}
          onMapped={() => {
            closeDetail();
            openRecords('mapped');
          }}
          onNational={national}
        />
      )}
      {drawer && (
        <MonitorRail
          data={data}
          visible={visible}
          selected={selected}
          record={record}
          kind={kind}
          sourceStatus={sourceStatus}
          setSourceStatus={setSourceStatus}
          watchOnly={watchOnly}
          setKind={(value) => {
            setKind(value);
            setSourceStatus('ALL');
            setScope('all');
          }}
          setWatchOnly={setWatchOnly}
          choose={choose}
          openCase={(one) => {
            setRecord(one);
            setSelected(one.incidentId);
            setExpanded(false);
            setDrawer(null);
          }}
          busy={busy}
          act={act}
          notice={setNotice}
          mode={drawer}
          setMode={setDrawer}
          scope={scope}
          setScope={setScope}
          placeLabel={place.label}
          close={() => {
            setDrawer(null);
          }}
          query={query}
        />
      )}
      {focused && <WorkspaceInspector state={state} />}
      {!focused && !drawer && (
        <ExplorePrompt shortages={summary.shortages} loaded={Boolean(data)} onNational={national} />
      )}
      {!drawer && !focused && (
        <nav className="op-camera-controls" aria-label="Globe camera">
          <button
            onClick={() => {
              camera('overview');
            }}
          >
            Overview
          </button>
          <button
            disabled={summary.mapped === 0 || !locationsEnabled}
            onClick={() => {
              camera('fit');
            }}
          >
            Fit locations
          </button>
          <button
            onClick={() => {
              openRecords('unmapped');
            }}
          >
            Unmapped records
          </button>
        </nav>
      )}
      {focused && (
        <button className="op-return-globe" onClick={closeDetail}>
          ← Return to globe
        </button>
      )}
      {(error || notice || busy) && (
        <div className={`op-toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
          <span>{error ?? (busy ? 'Fetching public evidence…' : notice)}</span>
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
      <WorkspaceFooter
        online={summary.online}
        loaded={Boolean(data)}
        freshness={summary.freshness}
        sourceErrors={summary.sourceErrors}
        onSources={() => {
          closeDetail();
          setDrawer('sources');
        }}
        onTools={onTools}
      />
    </div>
  );
}

function workspaceClass(drawer: boolean, focused: boolean, expanded: boolean): string {
  return [
    'op-workspace',
    'op-globe-workspace',
    drawer ? 'has-drawer' : '',
    focused ? 'has-inspector' : '',
    expanded ? 'inspector-expanded' : '',
  ].join(' ');
}
