import type { Incident } from '@vitalink/contracts';

import { operations } from './api';
import { Evidence } from './Evidence';
import { hasMappedLocation } from './globe-data';
import { InvestigationPanel } from './InvestigationPanel';
import type { WorkspaceState } from './useWorkspace';

export function WorkspaceInspector({
  state,
}: {
  state: WorkspaceState;
}): React.ReactElement | null {
  const { focused, record, busy, expanded, setExpanded, closeDetail, act, setRecord, data } = state;
  if (!focused) return null;
  return (
    <aside
      className={`op-detail op-panel ${record ? 'op-case-detail' : ''}`}
      aria-label={record ? 'Investigation inspector' : 'Event inspector'}
    >
      <div className="op-detail-top">
        <span>{record ? 'Investigation' : 'Event evidence'}</span>
        <div>
          {record && (
            <button
              aria-label={expanded ? 'Compact investigation' : 'Expand investigation'}
              aria-pressed={expanded}
              onClick={() => {
                setExpanded(!expanded);
              }}
            >
              {expanded ? '↙' : '↗'}
            </button>
          )}
          <button aria-label="Close detail panel" onClick={closeDetail}>
            ×
          </button>
        </div>
      </div>
      <div className={`op-location-context ${hasMappedLocation(focused) ? '' : 'national'}`}>
        <span className="op-dot cyan" />
        {locationContext(focused)}
      </div>
      <div className="op-detail-body">
        {record ? (
          <InvestigationPanel
            key={record.id}
            record={record}
            busy={busy}
            onSectionChange={(section) => {
              setExpanded(section === 'alternatives' || section === 'report');
            }}
            change={(body, action) => {
              void act(async () => {
                setRecord(await operations.change(record.id, body, action));
              });
            }}
          />
        ) : (
          <Evidence
            incident={focused}
            busy={busy}
            onInvestigate={() => {
              void act(async () => {
                const existing = data?.investigations.find(
                  (one) => one.incidentId === focused.id && one.status !== 'CLOSED',
                );
                setRecord(existing ?? (await operations.create(focused.id)));
              });
            }}
          />
        )}
      </div>
    </aside>
  );
}
function locationContext(incident: Incident): string {
  if (hasMappedLocation(incident)) {
    return `${incident.location?.city ?? 'Firm city'} · City-level context`;
  }
  return incident.kind === 'SHORTAGE'
    ? 'US national evidence · No site location supplied'
    : 'Unmapped record · Firm coordinates unavailable';
}
