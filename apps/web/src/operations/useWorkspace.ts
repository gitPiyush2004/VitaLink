import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Incident, Investigation } from '@vitalink/contracts';

import { isWatched, operations, type Dashboard } from './api';
import type { CameraCommand } from './Globe';
import {
  groupPlaces,
  hasMappedLocation,
  scopeRecords,
  sourceFreshness,
  type RecordScope,
} from './globe-data';
import type { DrawerMode } from './MonitorRail';
const POLL_MS = 15000;
const EMPTY_RECORDS: Incident[] = [];

function useMonitor(setData: (data: Dashboard) => void, setError: (message: string) => void): void {
  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void operations
        .dashboard()
        .then((data) => {
          if (alive) setData(data);
        })
        .catch((cause: unknown) => {
          if (alive) setError(cause instanceof Error ? cause.message : 'Could not load workspace');
        });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [setData, setError]);
}
function useData() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useMonitor(setData, setError);
  const reload = useCallback(async () => {
    setData(await operations.dashboard());
  }, []);
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
  return { data, busy, notice, setNotice, error, setError, act };
}
function useSelection() {
  const [selected, setSelected] = useState<string | null>(null);
  const [record, setRecord] = useState<Investigation | null>(null);
  const [expanded, setExpanded] = useState(false);
  function closeDetail(): void {
    setSelected(null);
    setRecord(null);
    setExpanded(false);
  }
  return { selected, setSelected, record, setRecord, expanded, setExpanded, closeDetail };
}
function useFilters() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('ALL');
  const [sourceStatus, setSourceStatus] = useState('ALL');
  const [watchOnly, setWatchOnly] = useState(false);
  return { query, setQuery, kind, setKind, sourceStatus, setSourceStatus, watchOnly, setWatchOnly };
}
function useShell() {
  const [drawer, setDrawer] = useState<DrawerMode | null>(null);
  const [scope, setScope] = useState<RecordScope>('all');
  const [place, setPlace] = useState({ label: '', ids: [] as string[] });
  const [locationsEnabled, setLocationsEnabled] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [command, setCommand] = useState<CameraCommand>({ sequence: 0, kind: 'overview' });
  const search = useRef<HTMLInputElement>(null);
  return {
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
    command,
    setCommand,
    search,
  };
}
function openNational(
  selection: ReturnType<typeof useSelection>,
  filters: ReturnType<typeof useFilters>,
  shell: ReturnType<typeof useShell>,
): void {
  selection.closeDetail();
  filters.setQuery('');
  filters.setKind('SHORTAGE');
  filters.setSourceStatus('ALL');
  filters.setWatchOnly(false);
  shell.setScope('all');
  shell.setDrawer('events');
}
function workspaceActions(
  selection: ReturnType<typeof useSelection>,
  filters: ReturnType<typeof useFilters>,
  shell: ReturnType<typeof useShell>,
) {
  return {
    choose: (id: string): void => {
      selection.setSelected(id);
      selection.setRecord(null);
      selection.setExpanded(false);
      shell.setDrawer(null);
    },
    openRecords: (scope: RecordScope = 'all'): void => {
      shell.setScope(scope);
      shell.setDrawer('events');
    },
    national: (): void => {
      openNational(selection, filters, shell);
    },
    camera: (kind: CameraCommand['kind']): void => {
      selection.closeDetail();
      shell.setDrawer(null);
      shell.setCommand((current) => ({ sequence: current.sequence + 1, kind }));
    },
    toggleDrawer: (next: DrawerMode): void => {
      selection.closeDetail();
      if (shell.drawer === next) shell.setDrawer(null);
      else {
        if (next === 'events') shell.setScope('all');
        shell.setDrawer(next);
      }
    },
  };
}
export function useWorkspace() {
  const live = useData();
  const selection = useSelection();
  const filters = useFilters();
  const shell = useShell();
  const incidents = live.data?.incidents ?? EMPTY_RECORDS;
  const matches = useMemo(
    () =>
      incidents.filter(
        (one) =>
          (filters.kind === 'ALL' || one.kind === filters.kind) &&
          (filters.sourceStatus === 'ALL' || one.status === filters.sourceStatus) &&
          (!filters.watchOnly || isWatched(one, live.data?.watches ?? [])) &&
          `${one.title} ${one.company} ${one.reason} ${one.genericNames.join(' ')} ${one.productNdcs.join(' ')} ${one.substances.join(' ')}`
            .toLowerCase()
            .includes(filters.query.toLowerCase()),
      ),
    [
      incidents,
      live.data?.watches,
      filters.kind,
      filters.sourceStatus,
      filters.watchOnly,
      filters.query,
    ],
  );
  const visible = scopeRecords(matches, shell.scope, shell.place.ids);
  const focused =
    selection.record?.incidentSnapshot ??
    incidents.find((one) => one.id === selection.selected) ??
    null;
  const summary = workspaceSummary(live.data, matches);
  return {
    ...live,
    ...selection,
    ...filters,
    ...shell,
    ...workspaceActions(selection, filters, shell),
    matches,
    visible,
    focused,
    summary,
  };
}
function workspaceSummary(data: Dashboard | null, matches: Incident[]) {
  const present = data ?? {
    incidents: [],
    investigations: [],
    feeds: [],
    worker: { online: false },
  };
  return {
    mapped: matches.filter(hasMappedLocation).length,
    places: groupPlaces(matches).length,
    shortages: present.incidents.filter((one) => one.kind === 'SHORTAGE').length,
    openCases: present.investigations.filter((one) => one.status !== 'CLOSED').length,
    freshness: sourceFreshness(present.feeds),
    sourceErrors: present.feeds.filter((feed) => feed.state === 'error').length,
    online: present.worker.online,
  };
}
export type WorkspaceState = ReturnType<typeof useWorkspace>;
