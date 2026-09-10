/**
 * Charts, hand-rolled in SVG.
 *
 * `recharts` is a dependency of `apps/web` and is deliberately unused, for the
 * same reason there is no component library: a chart library has opinions about
 * how to draw a value it was handed, and the two charts this system needs are
 * both about *distinguishing* kinds of value — a dominated scenario from one on
 * the Pareto front, a modelled band from a point estimate. Expressing that
 * through a general-purpose library's theming API is more code than the eighty
 * lines of SVG below, and less precise.
 *
 * Every chart here is a rendering of numbers that already exist and are already
 * provenance-tagged. None of them interpolates, smooths, or extends a series
 * past its last real point: a curve drawn beyond the data is a fabricated
 * number wearing a different costume.
 */

import type { ReactNode } from 'react';

import { type Tone, toneVariable } from './layout';

// ---------------------------------------------------------------------------
// Meter — a proportion, shown as a bar
// ---------------------------------------------------------------------------

export function Meter({
  label,
  value,
  max,
  display,
  tone = 'accent',
}: {
  label: ReactNode;
  value: number;
  max: number;
  /** What to print on the right. Defaults to the raw value. */
  display?: string;
  tone?: Tone;
}): React.ReactElement {
  const fraction = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));

  return (
    <div className="vl-meter" style={toneVariable(tone)}>
      <span className="vl-meter-label">{label}</span>
      <span className="vl-meter-value">{display ?? String(value)}</span>
      <span className="vl-meter-track">
        <span className="vl-meter-fill" style={{ width: `${String(fraction * PERCENT)}%` }} />
      </span>
    </div>
  );
}

const PERCENT = 100;

export function MeterList({ children }: { children: ReactNode }): React.ReactElement {
  return <div className="vl-meters">{children}</div>;
}

// ---------------------------------------------------------------------------
// Shared plotting arithmetic
// ---------------------------------------------------------------------------

const PAD = { left: 58, right: 14, top: 14, bottom: 32 };
const SIZE = { width: 680, height: 280 };
const TICKS = 4;

type Range = { min: number; max: number };

/**
 * The extent of a series, widened by a tenth so points do not sit on the axis.
 *
 * A degenerate range — every value identical, which happens when one carrier
 * quotes and the rest do not — would divide by zero, so it becomes a unit-wide
 * window centred on the value. The points then plot in the middle of the chart,
 * which is the honest picture: they do not differ.
 */
function extentOf(values: number[]): Range {
  if (values.length === 0) return { min: 0, max: 1 };

  const low = Math.min(...values);
  const high = Math.max(...values);
  if (high === low) return { min: low - 0.5, max: high + 0.5 };

  const margin = (high - low) / 10;
  return { min: low - margin, max: high + margin };
}

function scaleX(value: number, range: Range): number {
  const span = range.max - range.min;
  const usable = SIZE.width - PAD.left - PAD.right;
  return PAD.left + ((value - range.min) / span) * usable;
}

function scaleY(value: number, range: Range): number {
  const span = range.max - range.min;
  const usable = SIZE.height - PAD.top - PAD.bottom;
  return SIZE.height - PAD.bottom - ((value - range.min) / span) * usable;
}

function ticksOf(range: Range): number[] {
  const step = (range.max - range.min) / TICKS;
  return Array.from({ length: TICKS + 1 }, (_unused, index) => range.min + step * index);
}

function Axes({
  x,
  y,
  formatX,
  formatY,
  xLabel,
  yLabel,
}: {
  x: Range;
  y: Range;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  xLabel: string;
  yLabel: string;
}): React.ReactElement {
  return (
    <g>
      {ticksOf(y).map((tick) => (
        <g key={`y${String(tick)}`}>
          <line
            className="vl-chart-grid"
            x1={PAD.left}
            x2={SIZE.width - PAD.right}
            y1={scaleY(tick, y)}
            y2={scaleY(tick, y)}
          />
          <text className="vl-chart-axis" x={PAD.left - 8} y={scaleY(tick, y) + 3} textAnchor="end">
            {formatY(tick)}
          </text>
        </g>
      ))}
      {ticksOf(x).map((tick) => (
        <text
          key={`x${String(tick)}`}
          className="vl-chart-axis"
          x={scaleX(tick, x)}
          y={SIZE.height - PAD.bottom + 15}
          textAnchor="middle"
        >
          {formatX(tick)}
        </text>
      ))}
      <text
        className="vl-chart-axis"
        x={(SIZE.width + PAD.left) / 2}
        y={SIZE.height - 2}
        textAnchor="middle"
      >
        {xLabel}
      </text>
      <text
        className="vl-chart-axis"
        transform={`translate(11 ${String((SIZE.height - PAD.bottom) / 2)}) rotate(-90)`}
        textAnchor="middle"
      >
        {yLabel}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scatter — the Pareto front
// ---------------------------------------------------------------------------

export type ScatterPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** On the Pareto front: not dominated by any other point. */
  onFront: boolean;
  /** The one the weighted objective picked off the front. */
  chosen: boolean;
};

/**
 * Cost against shortage, with the front drawn as a frontier.
 *
 * The visual claim is exactly the one the Pareto panel makes in words: the
 * filled points are the genuine trade-offs and the hollow ones are strictly
 * worse than something. Reading that off a table takes a minute; reading it off
 * this takes a second, and it is the same fact.
 */
export function ScatterChart({
  points,
  xLabel,
  yLabel,
  formatX,
  formatY,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
}): React.ReactElement {
  const x = extentOf(points.map((one) => one.x));
  const y = extentOf(points.map((one) => one.y));

  const frontier = points
    .filter((one) => one.onFront)
    .slice()
    .sort((left, right) => left.x - right.x);

  return (
    <svg
      className="vl-chart"
      viewBox={`0 0 ${String(SIZE.width)} ${String(SIZE.height)}`}
      role="img"
      aria-label={`${yLabel} against ${xLabel}, ${String(points.length)} scenarios`}
    >
      <Axes x={x} y={y} formatX={formatX} formatY={formatY} xLabel={xLabel} yLabel={yLabel} />

      {frontier.length < 2 ? null : (
        <polyline
          fill="none"
          stroke="var(--vl-accent)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.55"
          points={frontier
            .map((one) => `${String(scaleX(one.x, x))},${String(scaleY(one.y, y))}`)
            .join(' ')}
        />
      )}

      {points.map((point) => (
        <g key={point.id}>
          <title>
            {point.label}
            {'\n'}
            {xLabel}: {formatX(point.x)}
            {'\n'}
            {yLabel}: {formatY(point.y)}
            {'\n'}
            {point.onFront ? 'on the Pareto front' : 'dominated — strictly worse than another row'}
          </title>
          {point.chosen ? (
            <circle
              cx={scaleX(point.x, x)}
              cy={scaleY(point.y, y)}
              r="10"
              fill="none"
              stroke="var(--vl-accent)"
              strokeWidth="1"
              opacity="0.5"
            />
          ) : null}
          <circle
            cx={scaleX(point.x, x)}
            cy={scaleY(point.y, y)}
            r={point.onFront ? 5 : 4}
            fill={point.onFront ? 'var(--vl-accent)' : 'transparent'}
            stroke={point.onFront ? 'var(--vl-accent)' : '#4c5a6d'}
            strokeWidth="1.5"
          />
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Band — days of cover over time
// ---------------------------------------------------------------------------

/**
 * A modelled series, drawn as the band it is.
 *
 * There is no centre line. `quantitySchema` refuses to store a MODELLED point
 * estimate, and drawing one here would reintroduce exactly the false precision
 * that rule exists to prevent — a reader's eye follows a line and ignores a
 * shaded region around it.
 */
export function BandChart({
  days,
  low,
  high,
  stockoutBand,
  yLabel,
}: {
  days: number[];
  low: number[];
  high: number[];
  /** The window in which cover reaches zero, shaded on the x axis. */
  stockoutBand: { low: number; high: number } | null;
  yLabel: string;
}): React.ReactElement {
  const x = { min: days[0] ?? 0, max: days[days.length - 1] ?? 1 };
  const y = extentOf([0, ...low, ...high]);

  const upper = days.map(
    (day, index) => `${String(scaleX(day, x))},${String(scaleY(high[index] ?? 0, y))}`,
  );
  const lower = days
    .map((day, index) => `${String(scaleX(day, x))},${String(scaleY(low[index] ?? 0, y))}`)
    .reverse();

  return (
    <svg
      className="vl-chart"
      viewBox={`0 0 ${String(SIZE.width)} ${String(SIZE.height)}`}
      role="img"
      aria-label={`${yLabel} over ${String(days.length)} days, as a band`}
    >
      <Axes
        x={x}
        y={y}
        formatX={(value) => `d${String(Math.round(value))}`}
        formatY={(value) => value.toFixed(0)}
        xLabel="days after the shock"
        yLabel={yLabel}
      />

      {stockoutBand === null ? null : (
        <rect
          x={scaleX(stockoutBand.low, x)}
          width={Math.max(2, scaleX(stockoutBand.high, x) - scaleX(stockoutBand.low, x))}
          y={PAD.top}
          height={SIZE.height - PAD.top - PAD.bottom}
          fill="var(--vl-danger)"
          opacity="0.12"
        >
          <title>
            Cover reaches zero somewhere between day {stockoutBand.low} and day {stockoutBand.high}.
          </title>
        </rect>
      )}

      <polygon
        points={[...upper, ...lower].join(' ')}
        fill="var(--vl-modelled)"
        opacity="0.22"
        stroke="var(--vl-modelled)"
        strokeWidth="1"
        strokeOpacity="0.55"
      />

      <line
        className="vl-chart-grid"
        x1={PAD.left}
        x2={SIZE.width - PAD.right}
        y1={scaleY(0, y)}
        y2={scaleY(0, y)}
        stroke="var(--vl-danger)"
        strokeOpacity="0.5"
      />
    </svg>
  );
}
