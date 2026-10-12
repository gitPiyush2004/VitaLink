/**
 * The control tower shell: session, navigation, and the shared counts.
 *
 * ## One screen per stage, in loop order
 *
 * The tabs are the loop. That is not decoration — the spec's whole claim is that
 * these nine stages are one pipeline rather than nine features, and a UI that
 * grouped them by data type ("alerts", "carriers", "reports") would hide the
 * only interesting thing about the architecture. The ordering decision, and the
 * dependency it deliberately ignores, is written up in `nav.ts`.
 *
 * ## Why the shell holds the counts
 *
 * The sidebar shows how many signals, drugs, cascades and runs exist, and the
 * overview screen needs the same eight lists. Fetching them once here and
 * passing them down is not a cache — it is the difference between eight
 * requests and sixteen on every tab change. Views that own a *detail* still
 * fetch it themselves; what lives here is only the summary.
 *
 * ## No router
 *
 * `react-router` is a dependency of this workspace and is deliberately unused.
 * There are seven views, no deep links to share yet, and no code splitting to
 * gain — a router would add a layer to explain for nothing. When a shareable
 * `/cascade/:id` URL becomes worth having, the router is already installed.
 * Recorded here rather than left as an apparent oversight.
 */

import { useCallback, useEffect, useState } from 'react';

import { Button, ProvenanceLegend } from '@vitalink/ui';

import { hasAccessToken, logout, restoreSession } from './api/client';
import { loadOverview, type Overview } from './api/overview';
import { NavIcon } from './components/icons';
import { ScreenGuide } from './components/ScreenGuide';
import { TABS, tabMeta, type TabId } from './nav';
import { Workspace } from './operations/Workspace';
import { CascadeView } from './views/CascadeView';
import { CatalogView } from './views/CatalogView';
import { DecideView } from './views/DecideView';
import { LearnView } from './views/LearnView';
import { LoginView } from './views/LoginView';
import { LogisticsView } from './views/LogisticsView';
import { OverviewView } from './views/OverviewView';
import { SenseView } from './views/SenseView';
import type { ViewProps } from './views/types';
import { useApi } from './views/useApi';

const VIEWS: Record<TabId, (props: ViewProps) => React.ReactElement> = {
  overview: OverviewView,
  sense: SenseView,
  catalog: CatalogView,
  cascade: CascadeView,
  decide: DecideView,
  logistics: LogisticsView,
  learn: LearnView,
};

export function App(): React.ReactElement {
  const [signedIn, setSignedIn] = useState(hasAccessToken());
  const [checking, setChecking] = useState(true);
  // Skipped outright when the reader has asked for less motion. Checked here
  // rather than in CSS: the global reduce rule collapses durations to nothing,
  // which would leave a motionless truck on screen instead of removing it.
  const [tools, setTools] = useState(false);

  // One refresh attempt on load, so a page reload does not need a re-login.
  // The access token is held in memory and lost on refresh by design; the
  // HttpOnly cookie is what survives. See `api/client.ts`.
  useEffect(() => {
    void restoreSession().then((restored) => {
      setSignedIn(restored);
      setChecking(false);
    });
  }, []);

  return (
    <>
      <Session
        tools={tools}
        onTools={() => {
          setTools(!tools);
        }}
        checking={checking}
        signedIn={signedIn}
        onSignedIn={() => {
          setSignedIn(true);
        }}
        onSignOut={() => {
          void logout().then(() => {
            setSignedIn(false);
          });
        }}
      />
    </>
  );
}

function Session({
  tools,
  onTools,
  checking,
  signedIn,
  onSignedIn,
  onSignOut,
}: {
  tools: boolean;
  onTools: () => void;
  checking: boolean;
  signedIn: boolean;
  onSignedIn: () => void;
  onSignOut: () => void;
}): React.ReactElement {
  if (checking) return <Booting />;
  if (!signedIn) return <LoginView onSignedIn={onSignedIn} />;
  if (!tools) return <Workspace onSignOut={onSignOut} onTools={onTools} />;
  return (
    <>
      <button onClick={onTools} style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 20 }}>
        ← Disruption workspace
      </button>
      <SignedIn onSignOut={onSignOut} />
    </>
  );
}

/**
 * The signed-in shell.
 *
 * Split from `App` so that the overview fetch is mounted by signing in and
 * unmounted by signing out, rather than living above the session boundary and
 * needing a manual clear.
 */
function SignedIn({ onSignOut }: { onSignOut: () => void }): React.ReactElement {
  const [tab, setTab] = useState<TabId>('overview');
  const overview = useApi(() => loadOverview(), []);
  const meta = tabMeta(tab);
  const ActiveView = VIEWS[tab];

  const navigate = useCallback((next: TabId) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="vl-app">
      <Sidebar active={tab} onNavigate={navigate} overview={overview.data} onSignOut={onSignOut} />

      <div className="vl-main">
        <header className="vl-topbar">
          <div style={{ minWidth: 0 }}>
            <h1>{meta.title}</h1>
            <p>{meta.blurb}</p>
          </div>
          <div className="vl-topbar-right">
            <span
              className="vl-muted"
              style={{ fontSize: '0.6875rem' }}
              title={
                'Every number on these screens carries one of these four tags. Hover any value ' +
                'for its source, the exact URL queried and the full calculation. A field that ' +
                'cannot be computed says so and explains why — it is never shown as zero.'
              }
            >
              every number is tagged
            </span>
            <ProvenanceLegend />
          </div>
        </header>

        <main className="vl-content">
          {/* Rendered by the shell, not by each view, so a new screen cannot
              ship without a plain-English explanation of what it is for. */}
          <ScreenGuide tab={tab} />
          <ActiveView
            overview={overview.data}
            reloadOverview={overview.reload}
            navigate={navigate}
          />
        </main>
      </div>
    </div>
  );
}

/** How many rows each stage has stored, shown on its nav item. */
function navCount(id: TabId, overview: Overview | null): string | null {
  if (overview === null) return null;

  const counts: Partial<Record<TabId, number>> = {
    sense: overview.signals.length,
    catalog: overview.drugs.length,
    cascade: overview.cascades.length,
    decide: overview.runs.length,
    logistics: overview.recommendations.length,
  };

  const count = counts[id];
  return count === undefined ? null : String(count);
}

function Sidebar({
  active,
  onNavigate,
  overview,
  onSignOut,
}: {
  active: TabId;
  onNavigate: (tab: TabId) => void;
  overview: Overview | null;
  onSignOut: () => void;
}): React.ReactElement {
  return (
    <aside className="vl-sidebar">
      <div className="vl-brand">
        <span className="vl-brand-mark" aria-hidden="true">
          <VitalsMark />
        </span>
        <span style={{ minWidth: 0 }}>
          <p className="vl-brand-name">Vitalink</p>
          <p className="vl-brand-sub">Supply-chain resilience</p>
        </span>
      </div>

      <p className="vl-nav-heading">The loop</p>
      <nav style={{ display: 'grid', gap: 2 }}>
        {TABS.map((one) => {
          const count = navCount(one.id, overview);

          return (
            <button
              key={one.id}
              type="button"
              className="vl-nav-item"
              aria-current={one.id === active ? 'page' : undefined}
              onClick={() => {
                onNavigate(one.id);
              }}
            >
              <NavIcon name={one.id} />
              <span className="vl-nav-label">{one.label}</span>
              {count === null ? null : <span className="vl-nav-count">{count}</span>}
              <span className="vl-nav-step" title={`Stage ${one.step} of the nine-stage loop`}>
                {one.step}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="vl-sidebar-foot">
        <p className="vl-org">
          {overview === null
            ? 'Loading…'
            : `${String(overview.signals.length)} signals · ${String(overview.drugs.length)} drugs`}
        </p>
        <Button onClick={onSignOut}>Sign out</Button>
      </div>
    </aside>
  );
}

/** An ECG trace crossed with a link. Drawn rather than imported, so no asset. */
function VitalsMark(): React.ReactElement {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12.5h4l2.2-5.5 3.6 11 2.4-6.5h6.8" />
    </svg>
  );
}

/** Shown for the one round trip that decides whether there is a session. */
function Booting(): React.ReactElement {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="vl-row" style={{ color: 'var(--vl-ink-3)', fontSize: '0.8125rem' }}>
        <span className="vl-spinner" aria-hidden="true" />
        Restoring your session
      </div>
    </div>
  );
}
