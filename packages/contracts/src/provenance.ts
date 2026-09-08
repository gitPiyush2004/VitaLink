/**
 * The data covenant (spec PART 2, Rule 1), expressed as a zod schema.
 *
 * Every number Vitalink stores or returns is wrapped in a `Quantity`, never a
 * bare `number`. A `Quantity` carries the value, its unit, how we know it
 * (`tag`), and where it came from (`provenance`).
 *
 * The `superRefine` at the bottom is the important part: it makes the covenant a
 * *validation error* rather than a code-review comment.
 *
 *   - a DERIVED value without a `calculation_method` will not parse
 *   - a MODELLED value without assumptions, confidence and a low-high band will
 *     not parse
 *
 * So it is structurally impossible to persist a modelled figure that pretends to
 * be a precise fact. That is enforced here, once, for the whole system.
 */

import { z } from 'zod';

/**
 * The only four ways Vitalink is allowed to know a number.
 * There is no fifth tag, and in particular there is no SYNTHETIC.
 */
export const PROVENANCE_TAGS = ['REAL', 'DERIVED', 'MODELLED', 'SCENARIO'] as const;

export const provenanceTagSchema = z.enum(PROVENANCE_TAGS);
export type ProvenanceTag = z.infer<typeof provenanceTagSchema>;

/** Where a value came from, in enough detail that a reader can re-run the query. */
export const provenanceSchema = z.object({
  /** Human-readable source name, e.g. "openFDA", "UN Comtrade", "DSV Quote API". */
  source_name: z.string().min(1),
  /** A URL a human can open. For DERIVED values, the URL of the upstream source. */
  source_url: z.url(),
  /** The exact query issued, so the number is reproducible. Null for static constants. */
  query: z.string().nullable(),
  /** When the underlying REAL data was fetched. */
  fetched_at: z.iso.datetime(),
  /** Required for DERIVED and MODELLED: the formula, in words or notation. */
  calculation_method: z.string().min(1).optional(),
  /** Required for MODELLED: everything the model assumed that the data did not say. */
  assumptions: z.record(z.string(), z.unknown()).optional(),
  /** Required for MODELLED: 0..1. Honest uncertainty, not decoration. */
  confidence: z.number().min(0).max(1).optional(),
  /** Set when an LLM touched any *categorical* field on the record (Rule 2). */
  llm_model: z.string().optional(),
  /** Hash of the prompt, so an LLM-derived classification is auditable. */
  prompt_hash: z.string().optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

/** A low-high interval. MODELLED values are always reported as one of these. */
export const bandSchema = z.object({ low: z.number(), high: z.number() });
export type Band = z.infer<typeof bandSchema>;

const quantityShape = {
  value: z.number(),
  /** SI or currency unit, e.g. "kg", "hours", "INR", "days". Null for unitless indices. */
  unit: z.string().nullable(),
  tag: provenanceTagSchema,
  provenance: provenanceSchema,
  band: bandSchema.optional(),
};

/**
 * Enforces the parts of the covenant that depend on the tag.
 * Applied to every Quantity, so the rules cannot be forgotten at a call site.
 */
function refineCovenant(
  quantity: { tag: ProvenanceTag; provenance: Provenance; band?: Band | undefined },
  ctx: z.RefinementCtx,
): void {
  const needsMethod = quantity.tag === 'DERIVED' || quantity.tag === 'MODELLED';

  if (needsMethod && quantity.provenance.calculation_method === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['provenance', 'calculation_method'],
      message: `A ${quantity.tag} value must state how it was calculated.`,
    });
  }

  if (quantity.tag !== 'MODELLED') return;

  if (quantity.provenance.assumptions === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['provenance', 'assumptions'],
      message: 'A MODELLED value must declare its assumptions.',
    });
  }
  if (quantity.provenance.confidence === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['provenance', 'confidence'],
      message: 'A MODELLED value must carry a confidence in 0..1.',
    });
  }
  // The rule that stops the project overclaiming: a model output is a range.
  if (quantity.band === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['band'],
      message: 'A MODELLED value must be reported as a low-high band, never as a point.',
    });
  } else if (quantity.band.low > quantity.band.high) {
    ctx.addIssue({
      code: 'custom',
      path: ['band'],
      message: 'Band low must not exceed band high.',
    });
  }
}

export const quantitySchema = z.object(quantityShape).superRefine(refineCovenant);
export type Quantity = z.infer<typeof quantitySchema>;

// A generic `quantityOf(valueSchema)` factory was considered here, for wrapping
// non-numeric values in the same envelope. It is deliberately absent: nothing in
// the system needs one yet, and a generic zod factory costs more to explain than
// it saves. Add a concrete schema in the file that needs it, when one does.

// ---------------------------------------------------------------------------
// Constructors.
//
// Nothing in the codebase builds a Quantity by hand. These four functions are
// the only way to make one, which is why a source-less number cannot exist:
// each constructor requires exactly the provenance its tag demands.
// ---------------------------------------------------------------------------

type RealInput = {
  value: number;
  unit: string | null;
  source: { name: string; url: string; query: string | null; fetchedAt: string };
};

/** A value fetched from a public source and stored unmodified. */
export function real({ value, unit, source }: RealInput): Quantity {
  return {
    value,
    unit,
    tag: 'REAL',
    provenance: {
      source_name: source.name,
      source_url: source.url,
      query: source.query,
      fetched_at: source.fetchedAt,
    },
  };
}

type DerivedInput = RealInput & { method: string };

/** A deterministic function of REAL inputs. The formula travels with the number. */
export function derived({ value, unit, source, method }: DerivedInput): Quantity {
  return {
    value,
    unit,
    tag: 'DERIVED',
    provenance: {
      source_name: source.name,
      source_url: source.url,
      query: source.query,
      fetched_at: source.fetchedAt,
      calculation_method: method,
    },
  };
}

type ModelledInput = DerivedInput & {
  band: Band;
  assumptions: Record<string, unknown>;
  confidence: number;
};

/** Output of a published model. Always a band, always with its assumptions attached. */
export function modelled({
  value,
  unit,
  source,
  method,
  band,
  assumptions,
  confidence,
}: ModelledInput): Quantity {
  return {
    value,
    unit,
    tag: 'MODELLED',
    band,
    provenance: {
      source_name: source.name,
      source_url: source.url,
      query: source.query,
      fetched_at: source.fetchedAt,
      calculation_method: method,
      assumptions,
      confidence,
    },
  };
}

type ScenarioInput = {
  value: number;
  unit: string | null;
  /** Who or what set this value, e.g. "user:scenario-form", "default:z_line=1". */
  setBy: string;
  at: string;
};

/** A what-if value a user entered. Never presented as fact. */
export function scenario({ value, unit, setBy, at }: ScenarioInput): Quantity {
  return {
    value,
    unit,
    tag: 'SCENARIO',
    provenance: {
      source_name: `Scenario input (${setBy})`,
      source_url: 'https://github.com/gitPiyush2004/VitaLink/blob/main/docs/SPEC.md#scenario',
      query: null,
      fetched_at: at,
    },
  };
}

/**
 * Narrows a mixed list to the values a chart may plot as points.
 * MODELLED values are excluded on purpose — they render as bands.
 */
export function isPointValue(quantity: Quantity): boolean {
  return quantity.tag !== 'MODELLED';
}
