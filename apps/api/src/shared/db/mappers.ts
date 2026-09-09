/**
 * Mapping a stored `Quantity` to and from its wire form.
 *
 * Shared because every module's repository needs exactly this, and the one real
 * difference between the two representations — `fetched_at` is a `Date` in Mongo
 * and an ISO string on the wire — should be handled in one place rather than
 * re-derived per module.
 *
 * These are the *generic* mappers. Each module's repository still writes its own
 * document mappers by hand, because those are where the module's snake_case
 * field names live and a recursive key transformer would hide the line where the
 * shape changes.
 */

import type { Quantity } from '@vitalink/contracts';

import type { ProvenanceDoc, QuantityDoc } from './document-types';

export function toProvenance(doc: ProvenanceDoc): Quantity['provenance'] {
  // Built field by field rather than by filtering entries, because
  // `exactOptionalPropertyTypes` makes "absent" and "present but undefined"
  // genuinely different types and a spread of nulls satisfies neither.
  return {
    source_name: doc.source_name,
    source_url: doc.source_url,
    query: doc.query,
    fetched_at: doc.fetched_at.toISOString(),
    ...(doc.calculation_method === null ? {} : { calculation_method: doc.calculation_method }),
    ...(doc.assumptions === null ? {} : { assumptions: doc.assumptions }),
    ...(doc.confidence === null ? {} : { confidence: doc.confidence }),
    ...(doc.llm_model === null ? {} : { llm_model: doc.llm_model }),
    ...(doc.prompt_hash === null ? {} : { prompt_hash: doc.prompt_hash }),
  };
}

export function fromProvenance(provenance: Quantity['provenance']): ProvenanceDoc {
  return {
    source_name: provenance.source_name,
    source_url: provenance.source_url,
    query: provenance.query,
    fetched_at: new Date(provenance.fetched_at),
    calculation_method: provenance.calculation_method ?? null,
    assumptions: provenance.assumptions ?? null,
    confidence: provenance.confidence ?? null,
    llm_model: provenance.llm_model ?? null,
    prompt_hash: provenance.prompt_hash ?? null,
  };
}

export function toQuantity(doc: QuantityDoc | null): Quantity | null {
  if (doc === null) return null;
  return {
    value: doc.value,
    unit: doc.unit,
    tag: doc.tag,
    provenance: toProvenance(doc.provenance),
    ...(doc.band === null ? {} : { band: doc.band }),
  };
}

export function fromQuantity(quantity: Quantity | null): QuantityDoc | null {
  if (quantity === null) return null;
  return {
    value: quantity.value,
    unit: quantity.unit,
    tag: quantity.tag,
    provenance: fromProvenance(quantity.provenance),
    band: quantity.band ?? null,
  };
}
