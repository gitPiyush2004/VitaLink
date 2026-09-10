/**
 * The seven navigation icons, drawn rather than installed.
 *
 * An icon set is a dependency, a licence and a build step for about ninety
 * lines of path data. These seven are the only ones the product needs, they all
 * share one stroke weight and one grid, and drawing them here means the sidebar
 * has no runtime dependency at all.
 *
 * They are decoration: every nav item carries its text label, and each icon is
 * `aria-hidden`. An icon that is the only label is a guessing game, and this is
 * a tool someone uses under pressure.
 */

import type { TabId } from '../nav';

const PATHS: Record<TabId, React.ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  // Broadcast arcs: the stage listens rather than acts.
  sense: (
    <>
      <circle cx="12" cy="12" r="2.3" />
      <path d="M7.9 16.1a5.8 5.8 0 0 1 0-8.2M16.1 7.9a5.8 5.8 0 0 1 0 8.2" />
      <path d="M5 19a9.9 9.9 0 0 1 0-14M19 5a9.9 9.9 0 0 1 0 14" />
    </>
  ),
  // A shipping carton, seen in three-quarter — the catalogue of what moves.
  catalog: (
    <>
      <path d="M12 3.2 20.3 7.6v8.8L12 20.8 3.7 16.4V7.6Z" />
      <path d="M3.7 7.6 12 12l8.3-4.4M12 12v8.8" />
    </>
  ),
  // One node breaking into two: the knock-on effect.
  cascade: (
    <>
      <circle cx="12" cy="4.8" r="2.1" />
      <circle cx="6" cy="19.2" r="2.1" />
      <circle cx="18" cy="19.2" r="2.1" />
      <path d="M12 6.9v3.4M6 17.1v-5a1.8 1.8 0 0 1 1.8-1.8h8.4A1.8 1.8 0 0 1 18 12.1v5" />
    </>
  ),
  // Sliders: the weights are a policy somebody sets, not a fact.
  decide: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.1" />
      <circle cx="15.5" cy="12" r="2.1" />
      <circle cx="7.5" cy="17" r="2.1" />
    </>
  ),
  logistics: (
    <>
      <path d="M2.8 6.2h10.4v10H2.8zM13.2 9.6h3.9l3.6 3.3v3.3h-7.5z" />
      <circle cx="6.6" cy="18.4" r="1.9" />
      <circle cx="17.2" cy="18.4" r="1.9" />
    </>
  ),
  // A loop that closes — which is exactly what stage 9 would do.
  learn: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20.4 3.4v4.2h-4.2" />
    </>
  ),
};

export function NavIcon({ name }: { name: TabId }): React.ReactElement {
  return (
    <svg
      className="vl-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
