/**
 * Layout primitives: panel, table, stat, note, button, empty state.
 *
 * ## Structure here, appearance in `theme.css`
 *
 * These components used to carry inline style objects. They no longer do, and
 * the reason is written at the top of `theme.css`: a style object cannot express
 * `:hover`, `:focus-visible`, a sticky table header, a media query or a
 * keyframe, and this UI needs all five. What lives here is the *structure* — the
 * markup a panel is made of — and the class names that select into the token
 * layer.
 *
 * ## The rules these primitives exist to keep
 *
 * `Empty` takes a `reason`, not an optional one. "No alerts" and "we could not
 * corroborate anything we saw" look identical on screen and are opposite claims,
 * so a panel is not allowed to be empty without saying which it is.
 *
 * `Stat` takes either a `value` or an `unavailable` reason and cannot take
 * both — the same refusal as `<QuantityValue>`, applied to the big number at the
 * top of a screen, which is exactly where a fabricated zero would do the most
 * damage.
 */

import type { CSSProperties, ReactNode } from 'react';

/**
 * The token values, for the places that genuinely cannot use a class: SVG
 * `fill`/`stroke` attributes, and a CSS custom property set per element.
 *
 * Everything else should use a class. If this object starts appearing in
 * `style={{ ... }}` on ordinary elements again, the stylesheet has a gap.
 */
export const COLOURS = {
  background: '#070a0f',
  panel: '#10161f',
  border: '#1b2331',
  text: '#b9c5d4',
  muted: '#8494a8',
  heading: '#eaf0f7',
  accent: '#2dd4bf',
  danger: '#fb7185',
  real: '#34d399',
  derived: '#60a5fa',
  modelled: '#fbbf24',
  scenario: '#c084fc',
} as const;

export type Tone = 'accent' | 'real' | 'derived' | 'modelled' | 'scenario' | 'danger' | 'neutral';

const TONE_COLOUR: Record<Tone, string> = {
  accent: COLOURS.accent,
  real: COLOURS.real,
  derived: COLOURS.derived,
  modelled: COLOURS.modelled,
  scenario: COLOURS.scenario,
  danger: COLOURS.danger,
  neutral: '#2b3749',
};

/** `--vl-tone` is read by the stat card's left rule and the meter's fill. */
export function toneVariable(tone: Tone): CSSProperties {
  return { '--vl-tone': TONE_COLOUR[tone] } as CSSProperties;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export type PanelProps = {
  title: string;
  /** A short label above the title. The stage number goes here. */
  eyebrow?: string;
  /** One line. Anything longer belongs in a `<Note>` or a `<Disclosure>`. */
  subtitle?: string;
  actions?: ReactNode;
  /** Removes body padding, for a panel that is nothing but a table. */
  flush?: boolean;
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  subtitle,
  actions,
  flush = false,
  children,
}: PanelProps): React.ReactElement {
  return (
    <section className="vl-panel">
      <header className="vl-panel-head">
        <div style={{ minWidth: 0 }}>
          {eyebrow === undefined ? null : <p className="vl-panel-eyebrow">{eyebrow}</p>}
          <h2 className="vl-panel-title">{title}</h2>
          {subtitle === undefined ? null : <p className="vl-panel-sub">{subtitle}</p>}
        </div>
        {actions === undefined ? null : <div className="vl-panel-actions">{actions}</div>}
      </header>
      <div className={flush ? 'vl-panel-body vl-panel-body--flush' : 'vl-panel-body'}>
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({
  headers,
  children,
}: {
  headers: (string | ReactNode)[];
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="vl-table-wrap">
      <table className="vl-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              // Headers are static per table, so the index is a stable key.
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * A table row.
 *
 * `highlighted` is for the one row that is the answer — the chosen scenario, the
 * winning carrier. `total` is for a summary row. Both are classes rather than
 * props on every cell so the emphasis stays consistent between tables.
 */
export function Row({
  children,
  highlighted = false,
  total = false,
}: {
  children: ReactNode;
  highlighted?: boolean;
  total?: boolean;
}): React.ReactElement {
  const classes = ['', highlighted ? 'is-highlighted' : '', total ? 'is-total' : '']
    .filter((one) => one !== '')
    .join(' ');

  return <tr className={classes === '' ? undefined : classes}>{children}</tr>;
}

export function Cell({
  children,
  align = 'left',
  colSpan,
  nowrap = false,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  colSpan?: number;
  nowrap?: boolean;
}): React.ReactElement {
  return (
    <td colSpan={colSpan} style={{ textAlign: align, whiteSpace: nowrap ? 'nowrap' : undefined }}>
      {children}
    </td>
  );
}

/** The primary line of a cell, with an optional quieter second line under it. */
export function CellStack({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}): React.ReactElement {
  return (
    <>
      <span className="vl-cell-strong">{primary}</span>
      {secondary === undefined ? null : <span className="vl-cell-sub">{secondary}</span>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

export function StatGrid({ children }: { children: ReactNode }): React.ReactElement {
  return <div className="vl-stats">{children}</div>;
}

export type StatProps = {
  label: string;
  /** The figure. Omit it and pass `unavailable` instead — never pass zero for unknown. */
  value?: ReactNode;
  /** Why there is no figure. Renders in place of the value, in the muted style. */
  unavailable?: string;
  note?: ReactNode;
  tone?: Tone;
};

export function Stat({
  label,
  value,
  unavailable,
  note,
  tone = 'neutral',
}: StatProps): React.ReactElement {
  return (
    <div className="vl-stat" style={toneVariable(tone)}>
      <p className="vl-stat-label">{label}</p>
      {value === undefined ? (
        <p className="vl-stat-value vl-stat-value--muted" title={unavailable}>
          not available
        </p>
      ) : (
        <p className="vl-stat-value">{value}</p>
      )}
      {note === undefined ? null : <p className="vl-stat-note">{note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Button({
  onClick,
  children,
  disabled = false,
  variant = 'default',
  busy = false,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  busy?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={variant === 'primary' ? 'vl-btn vl-btn--primary' : 'vl-btn'}
    >
      {busy ? <span className="vl-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** One option in a row of mutually exclusive choices. */
export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): React.ReactElement {
  return (
    <button type="button" className="vl-pill" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Notes, empty states, disclosures
// ---------------------------------------------------------------------------

/**
 * A caveat, a caution, or a piece of reasoning that must stay visible.
 *
 * This is where the long justifications went when the panels were tightened.
 * They are subordinate to the data now, not deleted: a reader who wants to know
 * why a number is missing still finds the answer on the same screen as the gap.
 */
export function Note({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'warn' | 'danger' | 'accent';
  title?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className={tone === 'neutral' ? 'vl-note' : `vl-note vl-note--${tone}`}>
      {title === undefined ? null : <span className="vl-note-title">{title}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ reason }: { reason: string }): React.ReactElement {
  return (
    <div className="vl-empty">
      <span className="vl-empty-mark" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" />
          <path d="M3.5 12.5 12.5 3.5" stroke="currentColor" />
        </svg>
      </span>
      <p>{reason}</p>
    </div>
  );
}

/** Collapsed by default. For derivations, term-by-term breakdowns, long prose. */
export function Disclosure({
  summary,
  children,
  open = false,
}: {
  summary: string;
  children: ReactNode;
  open?: boolean;
}): React.ReactElement {
  return (
    <details className="vl-disclosure" open={open}>
      <summary>{summary}</summary>
      <div className="vl-disclosure-body">{children}</div>
    </details>
  );
}

/** A calculation method, monospaced, for reading the arithmetic. */
export function Method({ children }: { children: ReactNode }): React.ReactElement {
  return <pre className="vl-method">{children}</pre>;
}

/** An error the operator should read. Never swallowed into a generic boundary. */
export function ErrorNote({ text }: { text: string }): React.ReactElement {
  return (
    <Note tone="danger" title="Failed">
      {text}
    </Note>
  );
}

/** Placeholder blocks while a panel's first load is in flight. */
export function Skeleton({ rows = 3 }: { rows?: number }): React.ReactElement {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {Array.from({ length: rows }, (_unused, index) => (
        <div
          // Placeholders have no identity beyond their position.
          key={index}
          className="vl-skeleton"
          style={{ height: 14, width: `${String(100 - index * 12)}%` }}
        />
      ))}
    </div>
  );
}
