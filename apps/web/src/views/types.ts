/**
 * What every view is handed.
 *
 * One shape for all seven, so the tab table in `App.tsx` can be a plain map
 * from id to component rather than a switch with a different call per branch.
 * A view that needs none of these — the catalogue, for instance — simply
 * ignores them, which is cheaper than three slightly different view contracts.
 *
 * `overview` is `null` only while the first load is in flight. After that it is
 * always an object, and its `failures` array carries anything that could not be
 * read, so "loading" and "unreadable" never collapse into the same state.
 */

import type { Overview } from '../api/overview';
import type { TabId } from '../nav';

export type ViewProps = {
  overview: Overview | null;
  /** Re-reads the shared counts. Called after a command changes stored data. */
  reloadOverview: () => void;
  navigate: (tab: TabId) => void;
};
