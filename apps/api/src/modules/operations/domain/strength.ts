/**
 * Strength parsing and comparison.
 *
 * openFDA prints a strength as free text on the product listing: `5000
 * [USP'U]/mL`, `5,000 UNITS/100ML`, `500 mg`, `25 mg/5 mL`. Comparing those as
 * strings is wrong in the direction that matters — `5000 [USP'U]/mL` and `5,000
 * UNITS/100ML` are not the same concentration, they differ by a factor of a
 * hundred, and a string comparison reports them as merely "different text"
 * while a careless numeric comparison reports them as equal because both read
 * 5000.
 *
 * So strengths are parsed into a canonical concentration and compared there.
 * The third verdict, `unknown`, is the important one: when either side fails to
 * parse, or the units are not commensurable, the answer is *not known*, never
 * "same". A candidate screen that quietly promotes unknown to match would be
 * the exact failure this project exists to avoid.
 *
 * ## On activity units
 *
 * `[USP'U]`, `USP'U`, `USP UNITS`, `UNITS`, `UNIT` and `U` are treated as one
 * family. That is defensible *here* because candidates are only ever compared
 * within a single active ingredient — the discovery query is by ingredient — so
 * an unqualified "UNITS" on a heparin listing is a USP unit. It would not be
 * defensible across ingredients.
 *
 * `IU` is deliberately kept in its own family. International Units and USP
 * Units are not interchangeable for every substance, so a comparison across the
 * two returns `unknown` rather than guessing. `ACTIVITY_NOTE` states this
 * wherever the comparison is displayed.
 */

export const ACTIVITY_NOTE =
  'Activity units are compared as printed on the listing. USP Units and International Units are not interchangeable for every substance.';

/** Canonical unit families. Two strengths only compare when their families match. */
type Family = 'mass' | 'volume' | 'usp_unit' | 'iu' | 'percent' | 'dose_unit';

type Unit = { family: Family; /** Multiplier onto the family's base unit. */ factor: number };

const UNITS: Record<string, Unit> = {
  // Mass, base milligram.
  kg: { family: 'mass', factor: 1_000_000 },
  g: { family: 'mass', factor: 1000 },
  mg: { family: 'mass', factor: 1 },
  mcg: { family: 'mass', factor: 0.001 },
  ug: { family: 'mass', factor: 0.001 },
  µg: { family: 'mass', factor: 0.001 },
  ng: { family: 'mass', factor: 0.000001 },
  // Volume, base millilitre.
  l: { family: 'volume', factor: 1000 },
  dl: { family: 'volume', factor: 100 },
  ml: { family: 'volume', factor: 1 },
  // Activity. See the note above on why these two families stay apart.
  "[usp'u]": { family: 'usp_unit', factor: 1 },
  "usp'u": { family: 'usp_unit', factor: 1 },
  'usp u': { family: 'usp_unit', factor: 1 },
  'usp unit': { family: 'usp_unit', factor: 1 },
  'usp units': { family: 'usp_unit', factor: 1 },
  unit: { family: 'usp_unit', factor: 1 },
  units: { family: 'usp_unit', factor: 1 },
  u: { family: 'usp_unit', factor: 1 },
  '[iu]': { family: 'iu', factor: 1 },
  iu: { family: 'iu', factor: 1 },
  'international unit': { family: 'iu', factor: 1 },
  'international units': { family: 'iu', factor: 1 },
  '%': { family: 'percent', factor: 1 },
};

export type ParsedStrength = {
  raw: string;
  /** Quantity in the numerator's base unit. */
  amount: number;
  amountFamily: Family;
  /** Null when the listing states an absolute amount rather than a concentration. */
  per: number | null;
  perFamily: Family | null;
};

/** `5,000` and `5000` are the same number; `1.5` keeps its fraction. */
function toNumber(text: string): number | null {
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function toUnit(text: string): Unit | null {
  return UNITS[text.trim().toLowerCase()] ?? null;
}

// `.5mL` appears verbatim on real heparin listings — a leading decimal point
// with no integer part — so the integer part is optional.
const NUMBER = String.raw`(?:[0-9][0-9,]*(?:\.[0-9]+)?|\.[0-9]+)`;
/**
 * `<amount> <unit>` optionally followed by `/ [count] <unit>`.
 *
 * The denominator's count is optional because `5 mg/mL` means `per 1 mL` while
 * `5,000 UNITS/100ML` states the volume explicitly. Requiring a digit there was
 * the first version's bug: every plain `mg/mL` listing failed to parse and was
 * reported as `unknown`.
 */
const STRENGTH = new RegExp(
  String.raw`^\s*(${NUMBER})\s*([^/]+?)\s*(?:/\s*(${NUMBER})?\s*([^/]+?)\s*)?$`,
  'i',
);

type Denominator = Pick<ParsedStrength, 'per' | 'perFamily'>;

function denominator(count: string | undefined, unitText: string | undefined): Denominator | null {
  // No `/` in the text at all: an absolute amount such as `500 mg`.
  if (unitText === undefined) return { per: null, perFamily: null };
  // NDC uses /1 for one dosage unit (for example a tablet), not one mL.
  if (unitText.trim() === '1' && count === undefined) return { per: 1, perFamily: 'dose_unit' };
  const unit = toUnit(unitText);
  if (unit === null) return null;
  // An omitted count means one, as in `mg/mL`.
  const value = count === undefined ? 1 : toNumber(count);
  if (value === null || value === 0) return null;
  return { per: value * unit.factor, perFamily: unit.family };
}

/**
 * Parses a printed strength, or returns null when it cannot be read with
 * confidence. Null is a result — it drives the `unknown` verdict.
 */
export function parseStrength(raw: string | null | undefined): ParsedStrength | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const match = STRENGTH.exec(raw.trim());
  if (match === null) return null;

  const amount = toNumber(match[1] ?? '');
  const amountUnit = toUnit(match[2] ?? '');
  if (amount === null || amountUnit === null) return null;

  const per = denominator(match[3], match[4]);
  if (per === null) return null;

  return { raw, amount: amount * amountUnit.factor, amountFamily: amountUnit.family, ...per };
}

/**
 * Relative tolerance for the concentration comparison. Unit conversion is
 * floating-point (`250 mcg` becomes `0.25 mg`), so two strengths that are equal
 * in principle can differ in the last bits.
 */
const FLOAT_TOLERANCE = 1e-9;

export type StrengthVerdict = 'same' | 'differs' | 'unknown';

/**
 * Compares two printed strengths.
 *
 * Returns `unknown` whenever either side fails to parse or the units are not
 * commensurable. It never returns `same` on an assumption.
 */
export function compareStrength(
  reference: string | null | undefined,
  candidate: string | null | undefined,
): StrengthVerdict {
  const left = parseStrength(reference);
  const right = parseStrength(candidate);
  if (left === null || right === null) return 'unknown';
  if (left.amountFamily !== right.amountFamily) return 'unknown';
  // An absolute amount and a concentration are different statements, even when
  // the numbers coincide: `500 mg` is not `500 mg/mL`.
  if ((left.per === null) !== (right.per === null)) return 'differs';
  if (left.perFamily !== right.perFamily) return 'unknown';

  const a = left.amount / (left.per ?? 1);
  const b = right.amount / (right.per ?? 1);
  const tolerance = Math.max(Math.abs(a), Math.abs(b)) * FLOAT_TOLERANCE;
  return Math.abs(a - b) <= tolerance ? 'same' : 'differs';
}
