/**
 * Form controls.
 *
 * Separated from `layout.tsx` because they are the only primitives that own
 * state-adjacent concerns — labels tied to inputs, `autoComplete` hints, the
 * focus ring. Keeping them apart makes it obvious that a panel is presentation
 * and a field is an affordance.
 */

import type { ReactNode } from 'react';

export function Toolbar({ children }: { children: ReactNode }): React.ReactElement {
  return <div className="vl-toolbar">{children}</div>;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  autoComplete,
  width,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  /** A word about where the value comes from. Rendered under the input. */
  hint?: string;
  autoComplete?: string;
  width?: number;
}): React.ReactElement {
  return (
    <label className="vl-field" style={width === undefined ? undefined : { width }}>
      <span className="vl-label">{label}</span>
      <input
        className="vl-input"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {hint === undefined ? null : (
        <span className="vl-stat-note" style={{ margin: 0 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  /** Visually hidden when the surrounding panel header already names the control. */
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
}): React.ReactElement {
  return (
    <label className="vl-field">
      {label === undefined ? null : <span className="vl-label">{label}</span>}
      <select
        className="vl-select"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
