/**
 * Rendering a number so its origin travels with it.
 *
 * `<QuantityValue>` takes a `Quantity`, not a number. That is the whole point of
 * the component: a source-less figure becomes a **type error** rather than a
 * code-review comment. There is no prop that accepts a bare number, so a
 * developer who wants to show one has to go and find its provenance first.
 *
 * ## The four tags, and why each looks different
 *
 * A reader has to be able to tell, at a glance and without hovering, which
 * numbers on a screen are measurements and which are assumptions. So the tag is
 * a visible chip and not a tooltip:
 *
 *   REAL      a source published this figure
 *   DERIVED   we computed it from published figures
 *   MODELLED  we modelled it — and it renders as a BAND, never as a point
 *   SCENARIO  the operator assumed it
 *
 * A MODELLED value with no band cannot be constructed — `quantitySchema`
 * rejects it — so the band rendering below has no "if it exists" branch by
 * accident. It has one because a stored document from an older schema version
 * could lack it, and that case shows the tag with a warning rather than a
 * plausible-looking point.
 */

import type { Quantity } from '@vitalink/contracts';

const TAG_TONE: Record<Quantity['tag'], string> = {
  REAL: 'real',
  DERIVED: 'derived',
  MODELLED: 'modelled',
  SCENARIO: 'scenario',
};

const TAG_TITLE: Record<Quantity['tag'], string> = {
  REAL: 'REAL — a source published this figure. Hover the value for the source and the URL.',
  DERIVED:
    'DERIVED — computed by Vitalink from published figures. The full formula, with every ' +
    'term substituted, is in the calculation method.',
  MODELLED:
    'MODELLED — Vitalink modelled this. It is shown as a low-high band because a point ' +
    'estimate would imply precision the model does not have.',
  SCENARIO:
    "SCENARIO — an operator's assumption, not a measurement. No public source states this, " +
    'so somebody had to supply it.',
};

/** The provenance chip. Always rendered next to a value, never instead of one. */
export function ProvenanceTag({ tag }: { tag: Quantity['tag'] }): React.ReactElement {
  return (
    <span className={`vl-chip vl-chip--${TAG_TONE[tag]} vl-tag`} title={TAG_TITLE[tag]}>
      {tag}
    </span>
  );
}

/** All four tags at once, for the header. The key to every number on screen. */
export function ProvenanceLegend(): React.ReactElement {
  return (
    <div className="vl-legend">
      {(Object.keys(TAG_TONE) as Quantity['tag'][]).map((tag) => (
        <ProvenanceTag key={tag} tag={tag} />
      ))}
    </div>
  );
}

/** Decimals for a fraction, where two would round a 0.0184 exposure to 0.02. */
const FRACTION_DECIMALS = 4;
const DEFAULT_DECIMALS = 2;

/**
 * Indian digit grouping, because every rupee figure in this system is INR.
 *
 * `unit` is nullable on a `Quantity` — a dimensionless count has no unit — so
 * the null case is a real one rather than defensive.
 */
function formatNumber(value: number, unit: string | null): string {
  if (unit === 'INR') return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const decimals = Math.abs(value) < 1 && value !== 0 ? FRACTION_DECIMALS : DEFAULT_DECIMALS;
  return value.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

/**
 * Units that read better as a suffix, or as nothing at all.
 *
 * `INR` is absent from the rendered string because the whole system is rupees
 * and the panel headings say so; `score_0_1` is absent because "0.42 score_0_1"
 * is worse than "0.42".
 */
const UNIT_SUFFIX: Record<string, string> = {
  percent: '%',
  score_0_1: '',
  INR: '',
};

function formatUnit(unit: string | null): string {
  if (unit === null) return '';
  return UNIT_SUFFIX[unit] ?? ` ${unit}`;
}

export type QuantityValueProps = {
  quantity: Quantity;
  /** Hides the chip where a whole column shares one tag, shown in its header. */
  showTag?: boolean;
};

/**
 * A number with its tag, its unit, and its whole provenance in the title.
 *
 * The `title` carries the source name, the exact URL queried, the fetch instant
 * and the calculation method. That is deliberately everything: the alternative
 * — a drawer the reader has to open — means the provenance is available and not
 * *present*, and only one of those changes how a number is read.
 */
export function QuantityValue({
  quantity,
  showTag = true,
}: QuantityValueProps): React.ReactElement {
  const { provenance } = quantity;
  const detail = [
    `source: ${provenance.source_name}`,
    `url: ${provenance.source_url}`,
    provenance.query === null ? null : `query: ${provenance.query}`,
    `fetched: ${provenance.fetched_at}`,
    provenance.calculation_method === undefined ? null : `method: ${provenance.calculation_method}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  // A MODELLED value renders as a band. `quantitySchema` refuses to construct
  // one without a band, so the fallback below is for documents written by an
  // older schema — and it says so rather than showing a bare point.
  if (quantity.tag === 'MODELLED') {
    return (
      <span className="vl-value" title={detail}>
        {quantity.band === undefined ? (
          <span style={{ color: 'var(--vl-modelled)' }}>
            {formatNumber(quantity.value, quantity.unit)}
            {formatUnit(quantity.unit)} (band missing)
          </span>
        ) : (
          <>
            {formatNumber(quantity.band.low, quantity.unit)}–
            {formatNumber(quantity.band.high, quantity.unit)}
            {formatUnit(quantity.unit)}
          </>
        )}
        {showTag ? <ProvenanceTag tag={quantity.tag} /> : null}
      </span>
    );
  }

  return (
    <span className="vl-value" title={detail}>
      {formatNumber(quantity.value, quantity.unit)}
      {formatUnit(quantity.unit)}
      {showTag ? <ProvenanceTag tag={quantity.tag} /> : null}
    </span>
  );
}

/**
 * The empty state for a value that could not be computed, with the reason.
 *
 * Never a zero and never a dash. "Zero facilities at risk" and "we do not know
 * how many facilities are at risk" are opposite claims, and a dash makes the
 * reader guess which one they are looking at.
 */
export function UnavailableValue({ reason }: { reason: string }): React.ReactElement {
  return (
    <span className="vl-unavailable" title={reason}>
      not available — why?
    </span>
  );
}
